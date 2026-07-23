import { contientVisageIdentifiable, genererPersona } from "../_shared/gemini.ts";
import { scrapeProfile } from "../_shared/apify.ts";
import { assertAuthorised, json, messageErreur, serviceClient } from "../_shared/supabase.ts";

type Supabase = ReturnType<typeof serviceClient>;

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
 * Un pseudo LIBRE sur TikTok : on part du pseudo choisi ; si TikTok l'a déjà, on
 * ajoute quelques chiffres au hasard jusqu'à en trouver un de libre.
 */
async function trouverHandleLibre(base: string): Promise<string> {
  if (await handleLibre(base)) return base;
  for (let i = 0; i < 4; i += 1) {
    const candidat = `${base}${Math.floor(Math.random() * 900) + 100}`; // 3 chiffres
    if (await handleLibre(candidat)) return candidat;
  }
  return `${base}${Math.floor(Math.random() * 9000) + 1000}`; // dernier recours
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
      .select("*, comptes_reference(handle_tiktok, niche)")
      .eq("id", compteId)
      .single();
    if (error || !compte) return json({ error: "Compte introuvable" }, 404);

    // deno-lint-ignore no-explicit-any
    const reference = (compte as any).comptes_reference;

    const proposition = await genererPersona({
      niche: reference?.niche ?? "",
      langue: compte.langue,
    });
    if (!proposition) return json({ error: "Génération impossible" }, 502);

    const pseudos = await filtrerPseudos(
      supabase,
      proposition.pseudos,
      reference?.handle_tiktok ?? "",
    );

    const avatar = await choisirAvatar(supabase, compte.compte_reference_id);

    // Le @ RÉELLEMENT posé : le pseudo choisi, mais garanti LIBRE sur TikTok
    // (sinon on ajoute des chiffres). Calculé seulement si on applique.
    let handleApplique: string | null = null;

    if (appliquer && pseudos.length > 0) {
      handleApplique = await trouverHandleLibre(pseudos[0]);

      await supabase
        .from("comptes")
        .update({
          handle_tiktok: handleApplique,
          persona_nom: compte.persona_nom ?? handleApplique,
          persona_bio: proposition.bio,
          avatar_url: avatar?.url ?? compte.avatar_url,
          avatar_source: avatar ? "bibliotheque" : compte.avatar_source,
        })
        .eq("id", compteId);

      if (avatar) {
        await supabase
          .from("media_library")
          .update({ used_count: avatar.used_count + 1 })
          .eq("id", avatar.id);
      }
    }

    return json({
      ok: true,
      pseudos,
      bio: proposition.bio,
      avatarUrl: avatar?.url ?? null,
      handle: handleApplique,
      applique: appliquer && pseudos.length > 0,
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

/**
 * Le moins utilisé parmi les visuels sans visage identifiable.
 *
 * Le test de visage se fait ICI, et non à la préparation : il ne sert qu'au
 * choix d'une photo de profil, une fois par compte, alors qu'à la préparation
 * il tournait sur chaque slide — des centaines d'appels facturés pour des
 * visuels qui ne deviendront jamais un avatar. On examine donc quelques
 * candidats à la demande, et on garde le verdict pour ne pas le repayer.
 */
const CANDIDATS_AVATAR = 6;

async function choisirAvatar(supabase: Supabase, compteReferenceId: string | null) {
  // Déjà jugés sans visage : utilisables tels quels, aucun appel à passer.
  let connus = supabase
    .from("media_library")
    .select("id, url, used_count")
    .eq("visage_identifiable", false)
    .order("used_count")
    .limit(1);
  if (compteReferenceId) connus = connus.eq("compte_reference_id", compteReferenceId);

  const { data: dejaSur } = await connus;
  if (dejaSur?.[0]) return dejaSur[0];

  // Sinon on juge quelques visuels encore non examinés.
  let aJuger = supabase
    .from("media_library")
    .select("id, url, used_count")
    .is("visage_identifiable", null)
    .order("used_count")
    .limit(CANDIDATS_AVATAR);
  if (compteReferenceId) aJuger = aJuger.eq("compte_reference_id", compteReferenceId);

  const { data: candidats } = await aJuger;

  for (const media of candidats ?? []) {
    const visage = await contientVisageIdentifiable(media.url);
    // Le doute vaut refus : un indécis est marqué comme portant un visage.
    await supabase
      .from("media_library")
      .update({ visage_identifiable: visage === null ? true : visage })
      .eq("id", media.id);

    if (visage === false) return media;
  }

  return null;
}
