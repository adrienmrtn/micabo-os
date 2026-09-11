/**
 * Verdict « pourquoi le quota du jour n'est pas rempli », partagé par l'Edge
 * (minuit / assignation) et la page admin Minuit — les deux doivent dire la
 * même chose, et surtout la même chose que le tireur (`choisirContenu`).
 *
 * Le pool se juge en relatif : ce qui compte est le nombre de slideshows encore
 * disponibles pour CE créateur face au nombre de posts qui lui manquent, pas un
 * seuil absolu.
 *
 * Depuis la tierlist, ce verdict ne baisse plus jamais le quota d'un créateur :
 * quand il n'y a plus de passage dû, l'assignation repêche un slideshow en D
 * pour remplir. Un trou vient donc d'un pool vraiment vide (aucun slideshow
 * tagué / prêt) ou d'un deck impossible à fabriquer.
 */

export interface EtatPoolCompte {
  /** Labels du créateur, déjà mis en forme pour le message. */
  labelsTxt: string;
  langue: string;
  /** Pool labels ∩ famille : slideshows valides, import terminé. */
  candidats: number;
  /** Slideshows du pool déjà assignés à ce créateur pour ce jour. */
  dejaAssignes: number;
  /** Posts encore à créer pour atteindre le quota du jour. */
  manquants: number;
  /** Decks qui n'ont pas pu être fabriqués pendant le passage (traduction / Sophia). */
  echecsDeck?: number;
}

export type VerdictPool = "epuise" | "mince" | "suffisant";

/** Slideshows encore piochables pour ce créateur aujourd'hui. */
export function poolDisponible(etat: EtatPoolCompte): number {
  return Math.max(0, etat.candidats - etat.dejaAssignes);
}

export function verdictPool(etat: EtatPoolCompte): VerdictPool {
  const dispo = poolDisponible(etat);
  if (dispo <= 0) return "epuise";
  return dispo < Math.max(1, etat.manquants) ? "mince" : "suffisant";
}

/** Message admin — même texte côté Edge (raison d'assignation) et page Minuit. */
export function messagePool(etat: EtatPoolCompte): string {
  const dispo = poolDisponible(etat);
  const entete = `Pool « ${etat.labelsTxt} » × ${etat.langue.toUpperCase()}`;
  const verdict = verdictPool(etat);

  if (verdict === "epuise") {
    return (
      `${entete} épuisé pour ce créateur (${etat.candidats} slideshow(s), ` +
      `tous déjà assignés ce jour) — importe / labellise d'autres slideshows.`
    );
  }

  if (verdict === "mince") {
    return (
      `${entete} trop mince (${dispo} slideshow(s) dispo pour ${etat.manquants} ` +
      `post(s) manquant(s), ${etat.candidats} au total) — importe / labellise ` +
      `d'autres slideshows.`
    );
  }

  const suite = etat.echecsDeck
    ? `deck impossible sur ${etat.echecsDeck} slideshow(s) (traduction / Sophia). ` +
      `Quota inchangé — relance l'assignation de ce créateur.`
    : `soit aucun passage n'a tourné pour ce créateur (warmup fini après les ` +
      `passes de minuit, ou drain interrompu), soit les decks n'ont pas pu être ` +
      `fabriqués (traduction / Sophia). Quota inchangé — clique « Assigner ».`;

  return (
    `${entete} suffisant (${dispo} slideshow(s) dispo pour ${etat.manquants} ` +
    `post(s) manquant(s)) — le pool n'est pas la cause : ${suite}`
  );
}
