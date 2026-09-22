/**
 * Un pas d'import a-t-il vraiment avancé, et que faire quand il n'avance pas.
 *
 * Module **PUR** : aucune base, aucun réseau, aucun import qui tire
 * `supabase.ts` (son specifier `jsr:` n'est pas résoluble par Vite, donc un
 * module impur serait intestable côté front). Réexporté par
 * `src/features/moteur/importProgres.ts` et testé là.
 *
 * POURQUOI CE MODULE EXISTE — 22/09/2026.
 *
 * `avancerImport` faisait déjà le bon geste :
 *
 *     import_tentatives: r.progres ? 0 : tentatives + 1
 *
 * et `claimContenu` trie sur `import_tentatives` en premier critère,
 * précisément pour qu'« un diaporama qui enchaîne les passages stériles passe
 * derrière les imports frais au lieu d'aspirer tous les workers ».
 *
 * Le garde-fou n'a jamais servi, parce que sa mesure mentait : des pas
 * rendaient `progres: true` en laissant `import_etape` inchangée. Le compteur
 * repartait donc à zéro à chaque tour, `relacherContenuApresPas` repassait la
 * ligne en `pending` avec un bail nul — re-réclamable dans la seconde — et son
 * compteur à 0 la gardait en tête du tri. 24 contenus ont occupé la fenêtre de
 * claim (8 lignes) pendant des heures : ~120 workers/minute, aucune ligne de
 * log applicatif, aucun progrès, et les 62 contenus derrière eux jamais
 * atteints. Débit mesuré : 1,33 contenu/min en régime normal, 0,00 sous la
 * boucle.
 *
 * La leçon tient en une phrase : **le progrès se constate, il ne se déclare
 * pas.** Un pas peut se tromper sur ce qu'il a fait ; `import_etape` avant et
 * après, non.
 */

/** Pas sans changement d'étape tolérés avant de sortir la ligne de la file. */
export const MAX_PAS_STERILES = 5;

/**
 * Le pas a-t-il fait avancer le pipeline ?
 *
 * Les deux conditions sont exigées ensemble, et c'est volontaire :
 * - `progres` seul ment (c'est le défaut du 22/09) ;
 * - le changement d'étape seul ne suffit pas non plus — un pas peut signaler
 *   un échec en restant sur place, et un pas honnête qui rend `progres: false`
 *   ne doit pas être crédité parce qu'une autre passe a bougé l'étape.
 */
export function pasAAvance(
  etapeAvant: string | null | undefined,
  resultat: { etape: string; progres: boolean },
): boolean {
  return resultat.progres && resultat.etape !== String(etapeAvant ?? "");
}

export interface DecisionPas {
  /** Nouvelle valeur d'`import_tentatives`. */
  steriles: number;
  /** La ligne doit-elle quitter la file (boucle avérée) ? */
  sortDeLaFile: boolean;
}

/**
 * Fin de pas : compteur à jour, et sortie de file au-delà du plafond.
 *
 * Un pas qui avance remet le compteur à zéro — une ligne lente mais qui
 * progresse ne doit jamais être pénalisée, sinon elle finirait par sortir de
 * la file alors qu'elle travaille.
 */
export function decisionPas(
  tentatives: number,
  avance: boolean,
  max: number = MAX_PAS_STERILES,
): DecisionPas {
  if (avance) return { steriles: 0, sortDeLaFile: false };
  const steriles = Math.max(0, Math.floor(tentatives)) + 1;
  return { steriles, sortDeLaFile: steriles >= max };
}
