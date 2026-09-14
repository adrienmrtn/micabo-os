/**
 * Exemples « feed » d'un label : un exemple par paragraphe.
 *
 * Vient de `creationManuelle.ts`, retiré avec « Create a post » (14/09/2026) —
 * le Pilotage s'en sert toujours pour éditer les exemples d'un label.
 */

export function exemplesFeedDepuisTexte(brut: string): string[] {
  return brut
    .split(/\n\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 20);
}

export function exemplesFeedVersTexte(feed: unknown): string {
  if (!Array.isArray(feed)) return "";
  return feed
    .map((f) => String(f ?? "").trim())
    .filter(Boolean)
    .join("\n\n");
}
