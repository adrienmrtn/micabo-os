import type { ContenuLangueSlide } from "./types";

/**
 * Garde-fou de saisie, pas une règle produit. Le plus long texte en base fait
 * ~1500 caractères : couper plus court tronquerait du contenu existant à la
 * première correction.
 */
export const TEXTE_SLIDE_MAX = 2000;

/**
 * Remplace le texte d'une slide dans un deck de langue.
 *
 * Les retours à la ligne sont gardés (un texte de slide est mis en forme),
 * seuls les blancs de bord partent. Vide = `null`, comme à l'import : c'est ce
 * que l'affichage lit pour dire « sans texte ». Une position absente du deck
 * est ajoutée — un deck peut être plus court que la structure des slides.
 */
export function fusionnerTexteSlide(
  slides: ContenuLangueSlide[],
  position: number,
  texte: string,
): ContenuLangueSlide[] {
  const propre = texte.replace(/\r\n?/g, "\n").trim().slice(0, TEXTE_SLIDE_MAX);
  const texteOverlay = propre || null;
  const connue = slides.some((s) => s.position === position);
  const suite = connue
    ? slides.map((s) => (s.position === position ? { ...s, texte_overlay: texteOverlay } : s))
    : [...slides, { position, texte_overlay: texteOverlay, position_sophia: false }];
  return [...suite].sort((a, b) => a.position - b.position);
}
