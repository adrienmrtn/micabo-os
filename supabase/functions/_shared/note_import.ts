/**
 * Note d'import d'un TikTok — module PUR, sans réseau.
 *
 * Sorti d'`import_contenu.ts` le 06/10/2026 pour que l'import des slideshows à
 * texte incrusté (0306) note exactement comme l'import ordinaire sans embarquer
 * tout le moteur de deck : deux formules qui divergent finissent toujours par
 * se contredire. `import_contenu.ts` le réexporte, aucun appelant ne change.
 */

/**
 * Score « force » du TikTok à partir des vues (0..100).
 * log^1.3 : plus d'écart entre 1k et 20k qu'un log pur (qui compressait le milieu).
 */
export function scoreDepuisVues(
  vues: number | null | undefined,
  plafond = 80_000,
): number {
  const p = Math.max(1, plafond);
  const exp = 1.3;
  const num = Math.log(1 + (vues ?? 0)) ** exp;
  const den = Math.log(1 + p) ** exp;
  return Math.min(100, Math.max(0, (num / den) * 100));
}

/**
 * Note d'import /100 — un seul score, plus de note par langue.
 *
 * Attention : la note seule ne décide pas du tier. `tierImport` plafonne à C
 * tant que le TikTok d'origine n'a pas atteint `VUES_SOURCE_MIN_B_PLUS` vues.
 *
 *   base = (1−poidsVues)×pertinence + poidsVues×scoreVues   (défaut 30/70)
 *   note = (kk × prior + base) / (kk + 1)   avec kk = k/2
 *
 * `kk = k/2` est l'ancienne régularisation « langue d'origine » : la note se
 * juge sur la performance du TikTok chez son auteur, donc dans sa langue.
 */
export function noteImport(opts: {
  pertinence: number;
  vues: number | null | undefined;
  prior: number;
  k: number;
  poidsVues?: number;
  vuesPlafond?: number;
}): number {
  const poidsVues = Math.min(1, Math.max(0, opts.poidsVues ?? 0.7));
  const vuesPlafond = opts.vuesPlafond ?? 80_000;
  const vuesScore = scoreDepuisVues(opts.vues, vuesPlafond);
  const pertinence = Math.min(100, Math.max(0, opts.pertinence));
  const base = (1 - poidsVues) * pertinence + poidsVues * vuesScore;
  const kk = opts.k / 2;
  return (kk * opts.prior + base) / (kk + 1);
}
