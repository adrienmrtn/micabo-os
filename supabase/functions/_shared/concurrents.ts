/**
 * Les concurrents dans les slides (0286, 0287) — module PUR, sans réseau.
 *
 * Nos slideshows viennent de TikTok, parfois de comptes de concurrents
 * (`jeanne.wilgo` est le compte de l'appli Wilgo). Le placement micabo réécrit
 * UNE slide, dans les dernières ; les autres gardaient la publicité d'origine :
 * « Benutz die WILGO App », « la méthode WILGO », « Wilgo'dan test çöz ». Au
 * 01/10/2026, sur les decks de `jeanne.wilgo`, 27 decks en langue d'origine sur
 * 48 (56 %) et 27 traduits sur 105 (26 %) citaient encore un concurrent : la
 * traduction en retire la plupart (son prompt interdit les produits tiers), le
 * chemin source n'a aucun traducteur (0268) et `retirerMentionConcurrent` ne
 * coupe que Hustly, exprès.
 *
 * Décision d'Adrien : **un classement ou un comparatif reste, une
 * recommandation devient micabo.** Trancher entre les deux est un travail de
 * lecture, donc d'un modèle (`corrigerMentionsConcurrents`, gemini.ts) ; ce
 * module fait tout le reste, sans modèle : repérer les slides à juger, refuser
 * une réécriture qui cite encore un concurrent, retirer les hashtags.
 *
 * La liste vit dans la table `concurrents` (0286), éditable en base. Ses motifs
 * sont POSIX, en mots entiers (`\m … \M`) : « Ranking » contient « anki ».
 */

export interface Concurrent {
  nom: string;
  /** Motif POSIX insensible à la casse, mots entiers (`\m … \M`). */
  motif: string;
}

/**
 * Repli si la table est illisible : la liste semée par 0286, à l'identique (un
 * test le vérifie contre la migration). La table fait foi ; ce repli n'existe
 * que pour qu'une lecture ratée ne laisse pas passer Wilgo.
 */
export const CONCURRENTS_DEFAUT: Concurrent[] = [
  { nom: "Wilgo", motif: "\\mwilgo\\M" },
  { nom: "Astra AI", motif: "\\mastra(\\s?ai)?\\M" },
  { nom: "Knowunity", motif: "\\mknowunity\\M" },
  { nom: "Quizlet", motif: "\\mquizlet\\M" },
  { nom: "Anki", motif: "\\manki\\M" },
  { nom: "StudySmarter", motif: "\\mstudy\\s?smarter\\M" },
  { nom: "Studocu", motif: "\\mstudocu\\M" },
  { nom: "Brainly", motif: "\\mbrainly\\M" },
  { nom: "Gauth", motif: "\\mgauth(math)?\\M" },
  { nom: "Photomath", motif: "\\mphotomath\\M" },
  { nom: "Turbo AI", motif: "\\mturbo\\s?ai\\M" },
  { nom: "StudyFetch", motif: "\\mstudy\\s?fetch\\M" },
  { nom: "Revisely", motif: "\\mrevisely\\M" },
  { nom: "Mindgrasp", motif: "\\mmindgrasp\\M" },
];

const DEBUT_MOT = "(?<![\\p{L}\\p{N}_])";
const FIN_MOT = "(?![\\p{L}\\p{N}_])";

/**
 * Motif POSIX → RegExp JS. `\m` / `\M` deviennent des bornes Unicode : le `\b`
 * de JS ne connaît que l'ASCII, et « Wilgo'dan » ou « WILGO-Methode » doivent
 * matcher comme en base.
 */
export function regexConcurrent(motif: string): RegExp {
  return new RegExp(motif.replace(/\\m/g, DEBUT_MOT).replace(/\\M/g, FIN_MOT), "iu");
}

/** Les concurrents qu'un texte cite, dans l'ordre de la liste. */
export function concurrentsCites(texte: string | null | undefined, concurrents: Concurrent[]): string[] {
  if (!texte) return [];
  return concurrents.filter((c) => regexConcurrent(c.motif).test(texte)).map((c) => c.nom);
}

export interface SlideConcurrents {
  position: number;
  texte_overlay: string | null;
  /**
   * Texte que le modèle a jugé « classement, on laisse ». On ne le rejuge que
   * si le texte change : sans cette mémoire, chaque assignation repaierait un
   * appel pour un comparatif légitime.
   */
  concurrent_laisse?: string | null;
}

export interface SlideAJuger {
  position: number;
  cites: string[];
}

/** Les slides qui citent un concurrent et n'ont pas déjà été jugées sur CE texte. */
export function slidesAJuger(deck: SlideConcurrents[], concurrents: Concurrent[]): SlideAJuger[] {
  return deck
    .filter((s) => s.texte_overlay && s.concurrent_laisse !== s.texte_overlay)
    .map((s) => ({ position: s.position, cites: concurrentsCites(s.texte_overlay, concurrents) }))
    .filter((s) => s.cites.length > 0);
}

const nbLignes = (t: string) => t.split("\n").length;

/**
 * Une réécriture du modèle ne s'écrit que si elle tient : non vide, plus aucun
 * concurrent, aucun tiret long, et pas plus longue que l'originale d'une ligne
 * ou de moitié. Le remplacement touche un nom, pas la slide : une sortie qui
 * gonfle a réécrit autre chose.
 */
export function reecritureAcceptable(avant: string, apres: string | null | undefined, concurrents: Concurrent[]): boolean {
  if (!apres || !apres.trim()) return false;
  if (concurrentsCites(apres, concurrents).length > 0) return false;
  if (/[—–]/.test(apres)) return false;
  if (nbLignes(apres) > nbLignes(avant) + 1) return false;
  return apres.length <= avant.length * 1.5 + 30;
}

export interface VerdictConcurrent {
  position: number;
  decision: "laisser" | "remplacer";
  texte: string | null;
}

/**
 * Applique les verdicts du modèle à un deck. Ne touche qu'aux positions
 * soumises ; une réécriture refusée laisse la slide telle quelle (le brief du
 * matin la verra). `finir` repasse les règles mécaniques de la marque sur le
 * texte remplacé (casse, tirets, ordre allemand) — idempotentes.
 */
export function appliquerVerdicts<S extends SlideConcurrents>(
  deck: S[],
  aJuger: SlideAJuger[],
  verdicts: VerdictConcurrent[],
  concurrents: Concurrent[],
  finir: (texte: string) => string = (t) => t,
): { slides: S[]; remplacees: number[]; laissees: number[]; refusees: number[] } {
  const soumises = new Set(aJuger.map((s) => s.position));
  const parPos = new Map(verdicts.filter((v) => soumises.has(v.position)).map((v) => [v.position, v]));
  const remplacees: number[] = [];
  const laissees: number[] = [];
  const refusees: number[] = [];
  const slides = deck.map((s) => {
    const v = parPos.get(s.position);
    if (!v || !s.texte_overlay) return s;
    if (v.decision === "laisser") {
      laissees.push(s.position);
      return { ...s, concurrent_laisse: s.texte_overlay };
    }
    const texte = v.texte == null ? null : finir(v.texte);
    if (!reecritureAcceptable(s.texte_overlay, texte, concurrents)) {
      refusees.push(s.position);
      return s;
    }
    remplacees.push(s.position);
    return { ...s, texte_overlay: texte, concurrent_laisse: null };
  });
  for (const p of soumises) {
    if (!parPos.has(p)) refusees.push(p);
  }
  return { slides, remplacees, laissees, refusees };
}

/**
 * Retire d'une légende les hashtags d'un concurrent (`#Wilgo`, `#ankicards`).
 * Un hashtag se teste par son DÉBUT, sans borne de fin : « #wilgoapp » est du
 * Wilgo, alors que « #ranking » ne commence pas par « anki ».
 */
export function retirerHashtagsConcurrents(hashtags: string, concurrents: Concurrent[]): string {
  if (!hashtags) return hashtags;
  const debuts = concurrents.map(
    (c) => new RegExp("^" + c.motif.replace(/\\[mM]/g, ""), "iu"),
  );
  const mots = hashtags.split(/\s+/).filter(Boolean);
  const gardes = mots.filter((m) => !(m.startsWith("#") && debuts.some((r) => r.test(m.slice(1)))));
  return gardes.length === mots.length ? hashtags : gardes.join(" ");
}
