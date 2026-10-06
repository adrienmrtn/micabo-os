/**
 * Couleur d'un label, utilisable pour PEINDRE une puce sur le fond blanc de
 * l'OS — module pur.
 *
 * Les puces de label prennent la couleur du label pour leur texte et leur
 * bordure (filtres et cartes de `/admin/slideshows`), ou pour leur fond sous un
 * texte blanc (`LabelPicker` actif). Une couleur très claire y disparaît : le
 * label `white-post` (#ffffff, 06/10/2026) s'écrivait blanc sur blanc, et la
 * page Slideshows semblait ne pas l'avoir.
 *
 * `couleurLabelLisible` rend la couleur quand elle se lit sur du blanc, `null`
 * sinon : l'appelant retombe alors sur le style par défaut de la puce, comme
 * pour un label sans couleur. La couleur enregistrée n'est pas touchée.
 */

/** Contraste minimal avec le blanc. Bas exprès : on ne refuse que ce qu'on ne
 *  voit plus (blanc, crème, jaune très pâle). L'ambre du label Hook (#f59e0b,
 *  ~2,1) reste coloré. */
export const CONTRASTE_MIN_SUR_BLANC = 1.8;

function rgbDepuisHex(couleur: string): [number, number, number] | null {
  const m = couleur.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  const hex = m[1].length === 3 ? m[1].replace(/./g, (c) => c + c) : m[1];
  return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
}

/** Luminance relative WCAG 2.x, de 0 (noir) à 1 (blanc). */
function luminance([r, g, b]: [number, number, number]): number {
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** Rapport de contraste WCAG entre la couleur et le blanc (1 à 21), ou `null`
 *  si la couleur n'est pas un hex `#rgb` / `#rrggbb`. */
export function contrasteSurBlanc(couleur: string): number | null {
  const rgb = rgbDepuisHex(couleur);
  if (!rgb) return null;
  return 1.05 / (luminance(rgb) + 0.05);
}

/**
 * La couleur si elle se lit sur du blanc, sinon `null`.
 *
 * Une valeur qui n'est pas un hex (nom CSS, `rgb()`) est rendue telle quelle :
 * on ne refuse que ce qu'on sait mesurer. Les labels de l'OS sont saisis au
 * sélecteur de couleur, qui rend toujours `#rrggbb`.
 */
export function couleurLabelLisible(couleur: string | null | undefined): string | null {
  if (!couleur || !couleur.trim()) return null;
  const c = contrasteSurBlanc(couleur);
  if (c === null) return couleur;
  return c >= CONTRASTE_MIN_SUR_BLANC ? couleur : null;
}
