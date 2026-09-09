/**
 * En turc, micabo.app doit se lire comme un site, pas une appli.
 * « site micabo.app » (mot site avant le nom) est interdit.
 */
export function assurerCtaSiteTurc(texte: string): string {
  if (!/micabo\.app|\bmicabo\b/i.test(texte)) return texte;
  let t = texte.replace(/\bsite\s+micabo\.app\s+ile\b/gi, "micabo.app sitesiyle");
  t = t.replace(/\bsite\s+micabo\.app\b/gi, "micabo.app sitesi");
  if (/\bsite/i.test(t)) return t;
  t = t.replace(/micabo\.app'i\b/gi, "micabo.app sitesini");
  t = t.replace(/micabo\.app ile\b/gi, "micabo.app sitesiyle");
  if (/\bsite/i.test(t)) return t;
  return t.replace(/micabo\.app\b/i, "micabo.app sitesi");
}
