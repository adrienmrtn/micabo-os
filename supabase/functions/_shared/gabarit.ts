/**
 * Gabarit d'une slide (02/10/2026) — module PUR, réexporté par
 * `src/features/moteur/gabarit.ts` pour Vitest.
 *
 * Une variante d'un slideshow gagnant doit avoir la FORME du parent, slide par
 * slide : autant de paragraphes, autant de lignes par paragraphe, des lignes
 * de la même largeur. Au premier essai sur 835c1781, les slides du parent en
 * quatre paragraphes revenaient en trois, le bloc de douze lignes revenait en
 * paragraphes, et la slide micabo tenait sur une seule ligne de 130
 * caractères. Le prompt le demandait déjà : comme la numérotation du placement
 * (0292), c'est le code qui le tient.
 *
 * La slide micabo du parent est souvent elle-même hors gabarit — c'est le
 * placement qui l'a écrite, pas l'auteur du TikTok. Son modèle est donc celui
 * d'une voisine de la liste (`modeleMicabo`).
 */

export interface Gabarit {
  /** Lignes de chaque paragraphe (blocs séparés par une ligne vide). */
  paragraphes: number[];
  /** Plus longue ligne, en caractères. */
  largeur: number;
  /** Caractères hors sauts de ligne. */
  longueur: number;
}

/** Tolérance sur le nombre de lignes d'un paragraphe. */
export const ECART_LIGNES = 1;
/** Une ligne peut dépasser la plus longue du modèle de si peu. */
export const MARGE_LARGEUR = 4;
/** Longueur totale admise, en proportion du modèle. */
export const LONGUEUR_MIN = 0.6;
export const LONGUEUR_MAX = 1.5;

function longueurVisible(s: string): number {
  return [...s].length;
}

export function gabarit(texte: string | null | undefined): Gabarit {
  const propre = String(texte ?? "").replace(/\r/g, "").trim();
  if (!propre) return { paragraphes: [], largeur: 0, longueur: 0 };
  const blocs = propre.split(/\n[ \t]*\n+/).map((b) => b.split("\n").map((l) => l.trim()).filter(Boolean));
  const paragraphes = blocs.filter((b) => b.length > 0);
  return {
    paragraphes: paragraphes.map((b) => b.length),
    largeur: Math.max(0, ...paragraphes.flat().map(longueurVisible)),
    longueur: longueurVisible(paragraphes.flat().join("")),
  };
}

/** Le gabarit en mots, pour le prompt. */
export function decrireGabarit(g: Gabarit): string {
  const n = g.paragraphes.length;
  if (n === 0) return "aucun texte";
  const lignes = g.paragraphes.join(", ");
  const total = g.paragraphes.reduce((a, b) => a + b, 0);
  if (total === 1) return `une seule ligne d'environ ${g.longueur} caractères`;
  return `${n} paragraphe${n > 1 ? "s" : ""} (${lignes} ligne${total > 1 ? "s" : ""}), ` +
    `${g.largeur} caractères au plus par ligne`;
}

/** Ce qui sépare une slide de son modèle ; vide si elle le tient. */
export function ecartsGabarit(modele: Gabarit, slide: Gabarit): string[] {
  const d: string[] = [];
  if (modele.paragraphes.length === 0) return d;
  if (slide.paragraphes.length !== modele.paragraphes.length) {
    d.push(`${slide.paragraphes.length} paragraphe(s) au lieu de ${modele.paragraphes.length}`);
  } else {
    modele.paragraphes.forEach((n, i) => {
      const m = slide.paragraphes[i];
      if (Math.abs(m - n) > ECART_LIGNES) d.push(`paragraphe ${i + 1} : ${m} ligne(s) au lieu de ${n}`);
    });
  }
  const multiLignes = modele.paragraphes.some((n) => n > 1);
  if (multiLignes && slide.largeur > modele.largeur + MARGE_LARGEUR) {
    d.push(`ligne de ${slide.largeur} caractères, le modèle n'en dépasse pas ${modele.largeur}`);
  }
  const ratio = slide.longueur / Math.max(modele.longueur, 1);
  if (ratio < LONGUEUR_MIN) d.push(`trop courte (${slide.longueur} caractères pour ${modele.longueur})`);
  if (ratio > LONGUEUR_MAX) d.push(`trop longue (${slide.longueur} caractères pour ${modele.longueur})`);
  return d;
}

/**
 * Le modèle de la slide micabo : son propre gabarit si l'auteur l'a écrite,
 * sinon celui de la voisine de liste (avant ou après, jamais la couverture) dont
 * le nombre de paragraphes est le plus proche de la médiane de la liste.
 */
export function modeleMicabo(
  deck: Array<{ position: number; texte: string; placement: boolean }>,
  position: number,
): Gabarit {
  const ici = deck.find((s) => s.position === position);
  if (ici && !ici.placement) return gabarit(ici.texte);
  const premiere = Math.min(...deck.map((s) => s.position));
  const liste = deck.filter((s) => s.position !== premiere && s.position !== position && !s.placement);
  if (liste.length === 0) return ici ? gabarit(ici.texte) : gabarit("");
  const nb = liste.map((s) => gabarit(s.texte).paragraphes.length).sort((a, b) => a - b);
  const mediane = nb.length % 2 ? nb[(nb.length - 1) / 2] : (nb[nb.length / 2 - 1] + nb[nb.length / 2]) / 2;
  const voisines = liste.filter((s) => Math.abs(s.position - position) === 1);
  const candidats = voisines.length > 0 ? voisines : liste;
  const choisie = candidats.reduce((a, b) =>
    Math.abs(gabarit(a.texte).paragraphes.length - mediane) <= Math.abs(gabarit(b.texte).paragraphes.length - mediane)
      ? a
      : b
  );
  return gabarit(choisie.texte);
}
