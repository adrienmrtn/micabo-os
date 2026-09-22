/**
 * Un pas d'import a-t-il avancé, et quand sortir une ligne qui tourne en rond.
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
 * Le garde-fou n'a jamais servi, parce que sa mesure était inatteignable : des
 * pas rendaient `progres: true` en boucle sur la même étape. Le compteur
 * repartait donc à zéro à chaque tour, `relacherContenuApresPas` repassait la
 * ligne en `pending` avec un bail nul — re-réclamable dans la seconde — et son
 * compteur à 0 la gardait en tête du tri. 24 contenus ont occupé la fenêtre de
 * claim (8 lignes) pendant des heures : ~120 workers/minute, aucune ligne de
 * log applicatif, aucun progrès, et les 62 contenus derrière eux jamais
 * atteints. Débit : 1,33 contenu/min en régime sain, 0,00 sous la boucle.
 *
 * CE QU'ON NE PEUT PAS FAIRE, et c'est le piège de ce correctif : exiger un
 * changement d'étape à chaque pas. `nettoyage` et `caption` restent
 * **volontairement** sur leur étape en traitant les slides par lots
 * (`slidesEpuisees`, `SLIDES_CAPTION_PAR_PASSAGE`) — ils progressent sans
 * bouger d'`import_etape`. Un plafond serré les sortirait de la file en plein
 * travail, ce qui serait pire que la boucle.
 *
 * D'où la règle retenue : le compteur ne mesure plus « le pas s'est-il déclaré
 * productif » (un pas peut se tromper) mais **le nombre de passes consécutives
 * sur la même étape**, remis à zéro dès que l'étape bouge. Un slideshow a au
 * plus quelques dizaines de slides ; une boucle, elle, ne s'arrête jamais. Le
 * plafond sépare les deux sans avoir à croire le pas sur parole.
 */

/**
 * Passes consécutives sur la MÊME étape avant de sortir la ligne de la file.
 *
 * Large exprès. Le coût d'un plafond trop haut est ~80 s de boucle avant
 * éjection ; celui d'un plafond trop bas est un slideshow sain jeté au milieu
 * de son nettoyage. Les deux ne se valent pas.
 */
export const MAX_PASSES_MEME_ETAPE = 40;

/**
 * L'étape a-t-elle bougé ?
 *
 * C'est la seule preuve de progrès qu'un pas ne peut pas inventer. Elle ne
 * suffit pas à dire qu'un pas est improductif (cf. nettoyage / caption), mais
 * elle suffit à dire qu'il a franchi une étape.
 */
export function etapeAChange(
  etapeAvant: string | null | undefined,
  resultat: { etape: string },
): boolean {
  return resultat.etape !== String(etapeAvant ?? "");
}

export interface DecisionPas {
  /** Nouvelle valeur d'`import_tentatives` : passes sur l'étape courante. */
  passes: number;
  /** La ligne doit-elle quitter la file (boucle avérée) ? */
  sortDeLaFile: boolean;
}

/**
 * Fin de pas : compteur à jour, et sortie de file au-delà du plafond.
 *
 * Le compteur repart à zéro **au changement d'étape**, pas sur la déclaration
 * du pas : une étape multi-passes accumule donc pendant son travail, puis se
 * remet à zéro en franchissant l'étape suivante.
 */
export function decisionPas(
  passes: number,
  etapeChangee: boolean,
  max: number = MAX_PASSES_MEME_ETAPE,
): DecisionPas {
  if (etapeChangee) return { passes: 0, sortDeLaFile: false };
  const n = Math.max(0, Math.floor(passes)) + 1;
  return { passes: n, sortDeLaFile: n >= max };
}
