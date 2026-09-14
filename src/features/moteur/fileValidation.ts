/**
 * File de validation des slideshows.
 *
 * Le pipeline d'import tourne comme avant, mais il ne débouche plus sur le
 * pool : il s'arrête sur `statut = 'brouillon'` + `import_statut = 'done'`.
 * Cette paire — et elle seule — veut dire « en file » (migration 0257).
 *
 * Module pur côté règles, pour que l'écran et les requêtes comptent pareil.
 */

export type EtatFile = "file" | "valide" | "rejete" | "import";

export interface LigneEtat {
  statut: string;
  import_statut: string;
}

/**
 * Où en est un slideshow, du seul point de vue de la file.
 *
 * - `import` : le pipeline n'a pas fini (ou a échoué) — pas encore présentable ;
 * - `file`   : prêt, en attente d'un admin ;
 * - `valide` : dans le pool d'assignation ;
 * - `rejete` : refusé à l'import (note < seuil), jamais passé par la file.
 */
export function etatFile(ligne: LigneEtat): EtatFile {
  if (ligne.statut === "rejete") return "rejete";
  if (ligne.statut === "valide") return "valide";
  return ligne.import_statut === "done" ? "file" : "import";
}

export function estEnFile(ligne: LigneEtat): boolean {
  return etatFile(ligne) === "file";
}

/** Un calque PNG posé sur une slide, en coordonnées relatives à l'image. */
export interface CalquePng {
  /** Id du bloc dans la bibliothèque (`blocs_png`). */
  blocId: string;
  url: string;
  /** Position du coin haut-gauche, en fraction de la largeur / hauteur. */
  x: number;
  y: number;
  /** Largeur en fraction de la largeur de l'image. La hauteur suit le ratio. */
  largeur: number;
  /** Ordre de superposition : le plus grand est devant. */
  z: number;
}

export function calqueParDefaut(bloc: { id: string; url: string }, z: number): CalquePng {
  return { blocId: bloc.id, url: bloc.url, x: 0.25, y: 0.4, largeur: 0.5, z };
}

/** Borne un calque dans l'image : jamais entièrement hors cadre, jamais nul. */
export function borner(calque: CalquePng): CalquePng {
  const largeur = Math.min(1, Math.max(0.02, calque.largeur));
  return {
    ...calque,
    largeur,
    x: Math.min(1 - 0.02, Math.max(largeur - 1, calque.x)),
    y: Math.min(1 - 0.02, Math.max(-1, calque.y)),
  };
}

/** Remonte un calque au premier plan sans laisser de trou dans les z. */
export function auPremierPlan(calques: CalquePng[], index: number): CalquePng[] {
  if (index < 0 || index >= calques.length) return calques;
  const tries = [...calques].sort((a, b) => a.z - b.z);
  const cible = calques[index]!;
  const sans = tries.filter((c) => c !== cible);
  return [...sans, cible].map((c, i) => ({ ...c, z: i }));
}

/** Redescend un calque au fond, même logique. */
export function auDernierPlan(calques: CalquePng[], index: number): CalquePng[] {
  if (index < 0 || index >= calques.length) return calques;
  const tries = [...calques].sort((a, b) => a.z - b.z);
  const cible = calques[index]!;
  const sans = tries.filter((c) => c !== cible);
  return [cible, ...sans].map((c, i) => ({ ...c, z: i }));
}

/**
 * Renumérote des slides après une suppression ou un déplacement.
 *
 * Les positions doivent rester 1..n sans trou : `post_slides` et les decks
 * `contenu_langues` s'alignent dessus par `position`, pas par index.
 *
 * L'ORDRE DU TABLEAU fait foi, pas les positions qu'il porte — sans quoi un
 * déplacement serait annulé par un tri sur les anciennes positions. Aux
 * appelants de trier avant s'ils partent d'une liste en désordre (`triees`).
 */
export function renumeroter<T extends { position: number }>(slides: T[]): T[] {
  return slides.map((s, i) => ({ ...s, position: i + 1 }));
}

/** Remet une liste dans l'ordre des positions. */
export function triees<T extends { position: number }>(slides: T[]): T[] {
  return slides.slice().sort((a, b) => a.position - b.position);
}

/** Déplace une slide d'un cran, puis renumérote. */
export function deplacerSlide<T extends { position: number }>(
  slides: T[],
  position: number,
  sens: -1 | 1,
): T[] {
  const ordre = triees(slides);
  const i = ordre.findIndex((s) => s.position === position);
  const j = i + sens;
  if (i < 0 || j < 0 || j >= ordre.length) return slides;
  [ordre[i], ordre[j]] = [ordre[j]!, ordre[i]!];
  return renumeroter(ordre);
}

/** Retire une slide et renumérote ce qui reste. */
export function retirerSlide<T extends { position: number }>(
  slides: T[],
  position: number,
): T[] {
  return renumeroter(triees(slides).filter((s) => s.position !== position));
}

/** Slug d'un format : stable, minuscule, sans accent. */
export function slugFormat(nom: string): string {
  return (
    nom
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "format"
  );
}
