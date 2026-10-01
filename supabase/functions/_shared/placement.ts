/**
 * Où micabo entre dans un deck (0289) — module PUR, sans réseau.
 *
 * Deux règles, décidées par Adrien le 01/10/2026 après la relecture des
 * placements (doc « Placement micabo : réflexion et propositions ») :
 *
 * 1. **La seconde moitié du deck, pas seulement les trois dernières slides.**
 *    Le verrou « 2-3 dernières » faisait tomber micabo sur la plus mauvaise
 *    note d'un classement décroissant, ou sur l'outro écrasée, alors que la
 *    bonne slide était deux crans plus haut. On ouvre, on ne resserre jamais :
 *    les trois dernières restent permises (sur un deck de 4, la moitié seule
 *    n'en laisserait que deux).
 *
 * 2. **Une mention par deck.** Au 01/10, 67 decks sur 304 (22 %) citaient
 *    micabo sur deux slides, 38 % en turc. Ce n'était presque jamais le
 *    placement qui doublait : c'était un concurrent remplacé par micabo (0287),
 *    ou une appli tierce que la traduction avait remplacée, ou un CTA écrit à la
 *    main sans cocher la case — puis le placement automatique en ajoutait un
 *    second. Une slide qui cite déjà micabo EST le placement.
 */

/**
 * « micabo » en mot entier : « micabo-App » et « micabo uygulaması » comptent.
 * Un littéral et non un `new RegExp` : esbuild l'élague des bundles qui ne s'en
 * servent pas, alors qu'un constructeur au niveau du module y restait et les
 * faisait tous « changer ».
 */
export const MOTIF_MICABO = /(?<![\p{L}\p{N}_])micabo(?![\p{L}\p{N}_])/iu;

export function citeMicabo(texte: string | null | undefined): boolean {
  return !!texte && MOTIF_MICABO.test(texte);
}

/**
 * Les positions où le placement peut tomber : la seconde moitié du deck, plus
 * les trois dernières, jamais la couverture (la plus petite position).
 */
export function positionsPermises(positions: number[]): number[] {
  const triees = [...new Set(positions)].sort((a, b) => a - b);
  if (triees.length < 2) return [];
  const couverture = triees[0];
  const secondeMoitie = triees.slice(Math.floor(triees.length / 2));
  const dernieres = triees.filter((p) => p !== couverture).slice(-3);
  const permises = new Set([...secondeMoitie, ...dernieres]);
  return triees.filter((p) => p !== couverture && permises.has(p));
}

/**
 * La slide qui porte déjà micabo, s'il y en a une : la plus loin dans le deck,
 * là où un CTA se trouve d'ordinaire. `null` si aucune.
 */
export function slideCitantMicabo(
  deck: Array<{ position: number; texte_overlay?: string | null }>,
): number | null {
  const citantes = deck.filter((s) => citeMicabo(s.texte_overlay)).map((s) => s.position);
  return citantes.length > 0 ? Math.max(...citantes) : null;
}

/** Marque `position` comme slide du placement, et elle seule. */
export function marquerPlacement<S extends { position: number; position_sophia?: boolean }>(
  deck: S[],
  position: number,
): S[] {
  return deck.map((s) => ({ ...s, position_sophia: s.position === position }));
}
