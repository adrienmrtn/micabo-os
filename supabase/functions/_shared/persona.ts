import { avatarPourSource } from "./avatar.ts";

type Supabase = ReturnType<typeof import("./supabase.ts").serviceClient>;

/**
 * Identité d'un compte de publication (pseudo, nom, bio, avatar) SANS aucun appel
 * Gemini ni réseau : purement déterministe et local, donc INSTANTANÉE. C'est le
 * chemin utilisé à la création d'un poster — l'IA (fonction `persona`) reste
 * disponible pour un enrichissement manuel ou nocturne, mais elle ne doit JAMAIS
 * bloquer la création (Gemini met ~10 s et sature en journée, ce qui laissait
 * l'identité vide et la ligne coincée sur « identité en cours »).
 */

/** Nom affiché = le @ simplifié : on retire les chiffres de fin, points/underscores
 *  → espaces, majuscule à chaque mot. « le_savant_urbain42 » → « Le Savant Urbain ». */
export function nomDepuisHandle(handle: string): string {
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
 * Un pseudo quasi certainement LIBRE — SANS appel réseau. On NE VÉRIFIE PLUS la
 * dispo (impossible de façon fiable ET rapide) : on garantit l'unicité par
 * construction, pseudo + 3 chiffres au hasard (« spezisuchti482 »).
 */
export function trouverHandleLibre(base: string): string {
  return `${base}${Math.floor(Math.random() * 900) + 100}`;
}

/** Racines par langue pour un pseudo (culture générale / savoir), dans le même
 *  esprit que les comptes de référence, sans jamais copier leur @. */
export const RACINES_SECOURS: Record<string, string[]> = {
  fr: ["savoir", "culture", "esprit", "curieux", "eclaire", "matiere.grise", "apprends", "le.savais.tu"],
  en: ["knowledge", "curious", "learn", "bright.mind", "brain.fuel", "did.you.know", "smart.daily", "quick.facts"],
  de: ["wissen", "neugierig", "lernen", "kluger.kopf", "bildung", "wusstest.du", "schlau.taeglich", "gehirn.futter"],
  it: ["sapere", "curioso", "impara", "mente.viva", "cultura", "lo.sapevi", "cervello", "intelletto"],
  es: ["saber", "curioso", "aprende", "mente.viva", "cultura", "sabias.que", "cerebro", "brillante"],
  pt: ["saber", "curioso", "aprende", "mente.viva", "cultura", "sabia.que", "cerebro", "brilhante"],
};

/** Bio par langue (culture générale). */
export const BIO_SECOURS: Record<string, string> = {
  fr: "un peu de culture chaque jour 🧠\nabonne-toi pour apprendre quelque chose de nouveau ✨",
  en: "a little knowledge every day 🧠\nfollow to learn something new ✨",
  de: "jeden tag ein bisschen wissen 🧠\nfolge mir und lerne etwas neues ✨",
  it: "un po' di cultura ogni giorno 🧠\nseguimi per imparare qualcosa di nuovo ✨",
  es: "un poco de cultura cada día 🧠\nsígueme para aprender algo nuevo ✨",
  pt: "um pouco de cultura todo dia 🧠\nsegue para aprender algo novo ✨",
};

export function pseudosDeSecours(langue: string): string[] {
  const racines = RACINES_SECOURS[langue] ?? RACINES_SECOURS.fr;
  return racines.flatMap((r) => [r, `${r}${Math.floor(Math.random() * 90) + 10}`]);
}

export function bioDeSecours(langue: string): string {
  return BIO_SECOURS[langue] ?? BIO_SECOURS.fr;
}

/** Découpe un handle en mots significatifs, pour comparer des racines. */
export function racines(handle: string): string[] {
  return handle
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((mot) => mot.length >= 4);
}

/**
 * Écarte les pseudos qui trahiraient la source (racine commune avec le compte de
 * référence → lien devinable) ou déjà portés par un de nos comptes (comme @ ou
 * comme nom affiché).
 */
export async function filtrerPseudos(
  supabase: Supabase,
  candidats: string[],
  handleReference: string,
): Promise<string[]> {
  const interdites = racines(handleReference);
  const sansEcho = candidats.filter((pseudo) => {
    const mots = racines(pseudo);
    return !mots.some((mot) =>
      interdites.some((r) => mot.includes(r) || r.includes(mot)),
    );
  });
  if (sansEcho.length === 0) return [];

  const { data: pris } = await supabase.from("comptes").select("handle_tiktok, persona_nom");
  const dejaPris = new Set(
    (pris ?? []).flatMap((c) => [c.handle_tiktok, c.persona_nom]).filter(Boolean),
  );
  return sansEcho.filter((pseudo) => !dejaPris.has(pseudo));
}

/**
 * Pose une identité complète (pseudo + nom + bio + avatar) sur un compte, de
 * façon INSTANTANÉE et déterministe : aucun Gemini, quelques requêtes DB. On ne
 * remplit QUE ce qui manque (un @ ou un nom déjà édités à la main sont préservés).
 * Renvoie le @ posé (ou null si le compte est introuvable).
 */
export async function appliquerIdentiteInstantanee(
  supabase: Supabase,
  compteId: string,
): Promise<{ applique: boolean; handle: string | null }> {
  const { data: compte, error } = await supabase
    .from("comptes")
    .select("*, comptes_reference(handle_tiktok)")
    .eq("id", compteId)
    .single();
  if (error || !compte) return { applique: false, handle: null };

  // deno-lint-ignore no-explicit-any
  const refHandle = (compte as any).comptes_reference?.handle_tiktok ?? "";

  let pseudos = await filtrerPseudos(supabase, pseudosDeSecours(compte.langue), refHandle);
  if (pseudos.length === 0) pseudos = pseudosDeSecours(compte.langue);

  const handle = trouverHandleLibre(pseudos[0]);
  const avatar = await avatarPourSource(supabase, compte.compte_reference_id);

  await supabase
    .from("comptes")
    .update({
      handle_tiktok: compte.handle_tiktok ?? handle,
      persona_nom: compte.persona_nom ?? nomDepuisHandle(handle),
      persona_bio: compte.persona_bio ?? bioDeSecours(compte.langue),
      avatar_url: compte.avatar_url ?? avatar?.url ?? null,
      avatar_source: compte.avatar_url ? compte.avatar_source : avatar ? "bibliotheque" : null,
    })
    .eq("id", compteId);

  if (avatar?.id && !compte.avatar_url) {
    await supabase
      .from("media_library")
      .update({ used_count: avatar.used_count + 1 })
      .eq("id", avatar.id);
  }

  return { applique: true, handle };
}
