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
 * construction. Racine NICHE (composée) + 4 chiffres au hasard (10 000
 * combinaisons) : un mot courant type « knowledge » + 3 chiffres se retrouvait
 * pris, une racine composée + 4 chiffres ne l'est quasiment jamais.
 */
export function trouverHandleLibre(base: string): string {
  return `${base}${Math.floor(Math.random() * 9000) + 1000}`; // 4 chiffres
}

/** Racines par langue pour un pseudo (culture générale / savoir), dans le même
 *  esprit que les comptes de référence, sans jamais copier leur @.
 *  DÉLIBÉRÉMENT NICHE et composées (2-3 mots) : un mot courant seul (« savoir »,
 *  « knowledge ») est déjà pris partout sur TikTok, une tournure composée non. */
export const RACINES_SECOURS: Record<string, string[]> = {
  fr: [
    "notes.de.minuit", "petites.lumieres", "le.grenier.du.savoir", "curiosite.tardive",
    "esprit.vagabond", "le.carnet.oublie", "chouette.lucide", "la.parenthese.utile",
    "le.terrier.aux.idees", "savoir.de.poche", "lueurs.nocturnes", "le.doute.utile",
    "cerveau.lent", "la.note.de.bas.de.page",
  ],
  en: [
    "brain.snacks", "curio.cabinet", "the.knowing.hours", "quiet.curious",
    "facts.after.dark", "owl.reads", "tiny.wisdoms", "the.pondering",
    "midnight.marginalia", "the.rabbit.hole.diary", "slow.facts.club", "dust.and.wonder",
    "the.footnote.club", "pocket.of.facts",
  ],
  de: [
    "mitternacht.notizen", "kleine.wunder", "der.kaninchenbau", "leises.wissen",
    "eulen.stunden", "die.randnotiz", "spaete.neugier", "dachboden.gedanken",
    "funken.im.dunkeln", "wissen.zum.mitnehmen", "stille.neugier", "gehirn.snack",
    "die.fussnote", "kleiner.funke",
  ],
  it: [
    "note.di.mezzanotte", "piccole.luci", "la.tana.delle.idee", "curiosita.tarda",
    "gufo.lucido", "sapere.tascabile", "spirito.errante", "la.parentesi.utile",
    "polvere.e.meraviglia", "cervello.lento", "scintille.notturne", "il.taccuino.perso",
  ],
  es: [
    "notas.de.medianoche", "pequenas.luces", "la.madriguera.de.ideas", "curiosidad.tardia",
    "buho.lucido", "saber.de.bolsillo", "espiritu.errante", "chispas.nocturnas",
    "polvo.y.asombro", "cerebro.lento", "la.nota.al.pie", "luz.tenue",
  ],
  pt: [
    "notas.de.meia.noite", "pequenas.luzes", "a.toca.das.ideias", "curiosidade.tardia",
    "coruja.lucida", "saber.de.bolso", "espirito.errante", "faiscas.noturnas",
    "poeira.e.espanto", "cerebro.lento", "a.nota.de.rodape", "luz.tenue",
  ],
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
  // Toutes les racines NUES d'abord (handles propres : « notes.de.minuit » + 4
  // chiffres), puis des variantes suffixées en dernier recours si les ~14 racines
  // étaient toutes déjà prises par nos comptes (14+ posters d'une même langue).
  return [...racines, ...racines.map((r) => `${r}${Math.floor(Math.random() * 90) + 10}`)];
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
  // Le @ stocké porte 4 chiffres finaux (« brain.snacks9745 »), le candidat est
  // la racine nue (« brain.snacks ») : on compare donc SANS les chiffres de fin,
  // sinon deux posters récupéreraient la même racine ET le même nom affiché.
  const sansChiffres = (s: string) => s.replace(/\d+$/, "").toLowerCase();
  const dejaPris = new Set<string>();
  for (const c of pris ?? []) {
    if (c.handle_tiktok) dejaPris.add(sansChiffres(c.handle_tiktok));
    if (c.persona_nom) dejaPris.add(c.persona_nom.toLowerCase());
  }
  return sansEcho.filter(
    (pseudo) =>
      !dejaPris.has(sansChiffres(pseudo)) &&
      !dejaPris.has(nomDepuisHandle(pseudo).toLowerCase()),
  );
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
