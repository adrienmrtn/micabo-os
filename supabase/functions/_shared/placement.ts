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

/**
 * Le numéro en tête de slide : « 3. », « 3) », « conseil n°4 », « Tip #4 »,
 * « Astuce 4 », « #5 », « 4 ». `null` si la première ligne n'en porte pas.
 */
const PREFIXE_NUMERO = /^\s*(?:\p{L}{2,12}\s*)?(?:n°|nº|nr\.?|#)?\s*\d+(?:\s*[.):-])?/iu;
/** Un numéro AJOUTÉ par le modèle : « 5. », « 5) », « 5- » suivis d'un texte. */
const NUMERO_AJOUTE = /^\s*\d+\s*[.)-]\s+/u;
/** La note d'un classement : « 6/10 », « 9.5/10 ». */
const NOTE_CLASSEMENT = /(?<![\p{N}])\d+(?:[.,]\d+)?\s*\/\s*10(?![\p{N}])/u;

export function prefixeNumero(texte: string | null | undefined): string | null {
  const m = (texte ?? "").match(PREFIXE_NUMERO);
  return m ? m[0] : null;
}

const premiereLigne = (t: string | null | undefined) => (t ?? "").split("\n")[0].trim().toLowerCase();

/**
 * La numérotation du deck ne se discute pas (0292). Le modèle renumérotait
 * (« 4. » à la place du « 3. » qu'il remplaçait, d'où « 2, 4, 4 ») ou ajoutait
 * un « 5. » dans un deck qui n'a pas de numéros : 5 placements sur 30 à
 * l'essai. On remet le préfixe de la slide remplacée, mot pour mot.
 */
export function alignerPrefixe(original: string, variante: string): string {
  const po = prefixeNumero(original);
  const pv = prefixeNumero(variante);
  if (po && pv) return pv.trim() === po.trim() ? variante : po.trimEnd() + variante.slice(pv.trimEnd().length);
  if (po && !pv) {
    // Le numéro seul sur sa ligne (« conseil n°3 ») reste seul sur sa ligne.
    const seul = premiereLigne(original) === po.trim().toLowerCase();
    return po.trim() + (seul ? "\n" : " ") + variante.trimStart();
  }
  if (!po && NUMERO_AJOUTE.test(variante)) return variante.replace(NUMERO_AJOUTE, "");
  return variante;
}

/**
 * Une variante qui casse le deck même une fois le numéro remis : elle recopie
 * le titre d'une autre slide (« 4. keep a mistake diary » deux fois de suite),
 * ou elle perd la note d'un classement (« 6/10 » doit rester).
 */
export function casseLeDeck(
  original: string,
  variante: string,
  deck: Array<{ position: number; texte_overlay?: string | null }>,
  position: number,
): boolean {
  // Le titre se compare sans son numéro : « 3. keep a diary » recopie « 4. keep a diary ».
  const titreSeul = (t: string | null | undefined) =>
    premiereLigne((t ?? "").replace(PREFIXE_NUMERO, "")).replace(/^[\s.):-]+/u, "");
  const titre = titreSeul(variante);
  const copie = titre.length > 0 &&
    deck.some((s) => s.position !== position && titreSeul(s.texte_overlay) === titre);
  const noteDisparue = NOTE_CLASSEMENT.test(original) && !NOTE_CLASSEMENT.test(variante);
  return copie || noteDisparue;
}

/**
 * Choisit la variante à écrire : la meilleure selon le modèle si elle tient,
 * sinon la suivante qui tient, numéro remis dans tous les cas. Si aucune ne
 * tient (`tient: false`), l'appelant redemande au modèle ; au dernier essai il
 * garde la meilleure, numéro remis, et le contrôle de 08:49 la verra.
 */
export function choisirVariante(
  original: string,
  variantes: string[],
  meilleure: number,
  deck: Array<{ position: number; texte_overlay?: string | null }>,
  position: number,
): { texte: string; index: number; tient: boolean } {
  const ordre = [meilleure, ...variantes.map((_, i) => i).filter((i) => i !== meilleure)];
  for (const i of ordre) {
    const v = variantes[i];
    if (!v) continue;
    const alignee = alignerPrefixe(original, v);
    if (!casseLeDeck(original, alignee, deck, position)) return { texte: alignee, index: i, tient: true };
  }
  return {
    texte: alignerPrefixe(original, variantes[meilleure] ?? variantes[0] ?? ""),
    index: meilleure,
    tient: false,
  };
}
