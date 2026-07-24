import { avatarPourSource } from "../_shared/avatar.ts";
import { genererPersona } from "../_shared/gemini.ts";
import { scrapeProfile, scrapeProfileBio } from "../_shared/apify.ts";
import { assertAuthorised, json, messageErreur, serviceClient } from "../_shared/supabase.ts";

type Supabase = ReturnType<typeof serviceClient>;

/** Nom affiché = le @ simplifié : on retire les chiffres de fin, on remplace les
 *  points/underscores par des espaces, et on met une majuscule à chaque mot.
 *  Ex. « le_savant_urbain42 » → « Le Savant Urbain ». */
function nomDepuisHandle(handle: string): string {
  const mots = handle
    .replace(/\d+$/, "")
    .replace(/[._]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((m) => m.charAt(0).toUpperCase() + m.slice(1));
  return mots.join(" ") || handle;
}

/**
 * Le pseudo est-il libre sur TikTok ? On scrape le profil : s'il renvoie des
 * posts, le compte existe déjà (pris). Erreur / vide = on le considère libre.
 * Best-effort (un compte réel sans aucun post passerait pour libre), mais suffit
 * à éviter les collisions courantes.
 */
async function handleLibre(handle: string): Promise<boolean> {
  try {
    const posts = await scrapeProfile(handle, 1);
    return posts.length === 0;
  } catch {
    return true;
  }
}

/**
 * Un pseudo probablement LIBRE sur TikTok. On fait UN SEUL contrôle (un scrape
 * Apify coûte ~10-30 s ; en enchaîner cinq faisait timeout toute la création) :
 * si le pseudo de base est libre on le garde, sinon — ou si le contrôle échoue
 * — on lui colle 3 chiffres au hasard, ce qui suffit à éviter les collisions
 * courantes. La disponibilité fine est affinable à la main ensuite.
 */
async function trouverHandleLibre(base: string): Promise<string> {
  try {
    if (await handleLibre(base)) return base;
  } catch {
    // Apify indispo : on ne bloque pas, on suffixe directement.
  }
  return `${base}${Math.floor(Math.random() * 900) + 100}`; // 3 chiffres
}

/** Racines par langue pour un pseudo de SECOURS (culture générale / savoir),
 *  quand l'IA est indisponible : mieux vaut une identité correcte tout de suite
 *  qu'un compte vide. L'admin peut toujours « Générer une identité » ensuite. */
const RACINES_SECOURS: Record<string, string[]> = {
  fr: ["savoir", "culture", "esprit", "curieux", "eclaire", "matiere.grise", "apprends", "le.savais.tu"],
  en: ["knowledge", "curious", "learn", "bright.mind", "brain.fuel", "did.you.know", "smart.daily", "quick.facts"],
  de: ["wissen", "neugierig", "lernen", "kluger.kopf", "bildung", "wusstest.du", "schlau.taeglich", "gehirn.futter"],
  it: ["sapere", "curioso", "impara", "mente.viva", "cultura", "lo.sapevi", "cervello", "intelletto"],
  es: ["saber", "curioso", "aprende", "mente.viva", "cultura", "sabias.que", "cerebro", "brillante"],
  pt: ["saber", "curioso", "aprende", "mente.viva", "cultura", "sabia.que", "cerebro", "brilhante"],
};

/** Bio de SECOURS par langue (culture générale), quand l'IA est indisponible. */
const BIO_SECOURS: Record<string, string> = {
  fr: "un peu de culture chaque jour 🧠\nabonne-toi pour apprendre quelque chose de nouveau ✨",
  en: "a little knowledge every day 🧠\nfollow to learn something new ✨",
  de: "jeden tag ein bisschen wissen 🧠\nfolge mir und lerne etwas neues ✨",
  it: "un po' di cultura ogni giorno 🧠\nseguimi per imparare qualcosa di nuovo ✨",
  es: "un poco de cultura cada día 🧠\nsígueme para aprender algo nuevo ✨",
  pt: "um pouco de cultura todo dia 🧠\nsegue para aprender algo novo ✨",
};

function pseudosDeSecours(langue: string): string[] {
  const racines = RACINES_SECOURS[langue] ?? RACINES_SECOURS.fr;
  // Chaque racine + une variante suffixée : de quoi laisser filtrerPseudos
  // écarter les collisions et trouverHandleLibre suffixer sans être à court.
  return racines.flatMap((r) => [r, `${r}${Math.floor(Math.random() * 90) + 10}`]);
}

function bioDeSecours(langue: string): string {
  return BIO_SECOURS[langue] ?? BIO_SECOURS.fr;
}

/**
 * Propose une identité pour un compte de publication : pseudos, bio, avatar.
 *
 *   { compteId }              → propositions seulement
 *   { compteId, appliquer }   → applique la première proposition retenue
 */
Deno.serve(async (request) => {
  const denied = await assertAuthorised(request);
  if (denied) return denied;

  const supabase = serviceClient();

  let compteId: string | null = null;
  let appliquer = false;
  try {
    const body = await request.json();
    compteId = body?.compteId ?? null;
    appliquer = Boolean(body?.appliquer);
  } catch {
    return json({ error: "corps JSON attendu" }, 400);
  }

  if (!compteId) return json({ error: "compteId requis" }, 400);

  try {
    const { data: compte, error } = await supabase
      .from("comptes")
      .select("*, comptes_reference(id, handle_tiktok, niche, bio)")
      .eq("id", compteId)
      .single();
    if (error || !compte) return json({ error: "Compte introuvable" }, 404);

    // deno-lint-ignore no-explicit-any
    const reference = (compte as any).comptes_reference;

    // Bio du compte de référence : on la capture UNE fois via Apify puis on la
    // garde, pour inspirer la bio du poster sans re-scraper à chaque génération.
    let referenceBio: string = reference?.bio ?? "";
    if (!referenceBio && reference?.handle_tiktok) {
      const meta = await scrapeProfileBio(reference.handle_tiktok);
      if (meta?.bio) {
        referenceBio = meta.bio;
        await supabase.from("comptes_reference").update({ bio: meta.bio }).eq("id", reference.id);
      }
    }

    // L'IA d'abord ; mais si elle est indisponible (429 Gemini fréquent en
    // journée), on NE bloque PAS : on bascule sur une identité de secours
    // déterministe. Une identité correcte tout de suite vaut mieux qu'un compte
    // vide qu'il faut re-générer à la main.
    const proposition = await genererPersona({
      niche: reference?.niche ?? "",
      langue: compte.langue,
      referenceHandle: reference?.handle_tiktok ?? undefined,
      referenceBio: referenceBio || undefined,
    }).catch(() => null);

    const pseudosIA = proposition?.pseudos?.length
      ? proposition.pseudos
      : pseudosDeSecours(compte.langue);
    const bio = proposition?.bio?.trim() || bioDeSecours(compte.langue);

    // Écarte les pseudos trahissant la source ou déjà pris ; si tout est écarté,
    // on repart du pool de secours (jamais vide).
    let pseudos = await filtrerPseudos(supabase, pseudosIA, reference?.handle_tiktok ?? "");
    if (pseudos.length === 0) {
      pseudos = await filtrerPseudos(supabase, pseudosDeSecours(compte.langue), reference?.handle_tiktok ?? "");
    }
    // Ultime garde-fou : jamais aucun candidat.
    if (pseudos.length === 0) pseudos = pseudosDeSecours(compte.langue);

    const avatar = await avatarPourSource(supabase, compte.compte_reference_id);

    // Le @ RÉELLEMENT posé : le pseudo choisi, garanti probablement libre.
    let handleApplique: string | null = null;

    if (appliquer && pseudos.length > 0) {
      handleApplique = await trouverHandleLibre(pseudos[0]);

      await supabase
        .from("comptes")
        .update({
          // On ne REMPLIT que ce qui manque : un @ ou un nom déjà posés (souvent
          // édités à la main) ne sont jamais écrasés par une re-génération.
          handle_tiktok: compte.handle_tiktok ?? handleApplique,
          // Nom affiché = le @ simplifié (pas le @ brut).
          persona_nom: compte.persona_nom ?? nomDepuisHandle(handleApplique),
          persona_bio: compte.persona_bio ?? bio,
          avatar_url: avatar?.url ?? compte.avatar_url,
          avatar_source: avatar ? "bibliotheque" : compte.avatar_source,
        })
        .eq("id", compteId);

      if (avatar?.id) {
        await supabase
          .from("media_library")
          .update({ used_count: avatar.used_count + 1 })
          .eq("id", avatar.id);
      }
    }

    return json({
      ok: true,
      pseudos,
      bio,
      avatarUrl: avatar?.url ?? null,
      handle: handleApplique,
      applique: appliquer && pseudos.length > 0,
      secours: !proposition, // vrai si l'IA était indispo (identité de secours)
    });
  } catch (error) {
    return json({ ok: false, error: messageErreur(error) }, 500);
  }
});

/** Découpe un handle en mots significatifs, pour comparer des racines. */
function racines(handle: string): string[] {
  return handle
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((mot) => mot.length >= 4);
}

/**
 * Écarte les pseudos qui trahiraient la source ou qui existent déjà.
 *
 * Un pseudo partageant une racine avec le compte de référence rendrait le lien
 * devinable pour qui compare les deux comptes : c'est exactement ce que la
 * séparation stricte cherche à éviter.
 */
async function filtrerPseudos(
  supabase: Supabase,
  candidats: string[],
  handleReference: string,
): Promise<string[]> {
  const interdites = racines(handleReference);

  const sansEcho = candidats.filter((pseudo) => {
    const mots = racines(pseudo);
    return !mots.some((mot) =>
      interdites.some((racine) => mot.includes(racine) || racine.includes(mot)),
    );
  });

  if (sansEcho.length === 0) return [];

  // On écarte tout pseudo déjà porté par un de NOS comptes — que ce soit comme
  // @ OU comme nom affiché (deux posters avec le même nom, ça s'est produit).
  const { data: pris } = await supabase
    .from("comptes")
    .select("handle_tiktok, persona_nom");

  const dejaPris = new Set(
    (pris ?? []).flatMap((c) => [c.handle_tiktok, c.persona_nom]).filter(Boolean),
  );
  return sansEcho.filter((pseudo) => !dejaPris.has(pseudo));
}
