/**
 * Format des visuels d'un même TikTok.
 *
 * TikTok recadre chaque photo d'un diaporama dans le même cadre : deux ratios
 * différents dans un même post font sauter l'image d'une slide à l'autre. Trois
 * choses cassent l'uniformité, et elles se cumulent :
 *
 *   1. la source TikTok elle-même — un hook quasi carré (1080×1084) suivi de
 *      slides 3:4 (1080×1440) est un cas réel, pas une exception ;
 *   2. le text-removal, qui recale sa sortie sur ses propres paliers ~4 MP
 *      (1080×1084 → carré 1024×1024, 1080×1440 → 880×1184) ;
 *   3. l'assignation, qui pioche un visuel de secours dans la biblio du label
 *      (`resoudreVisuelsAssignation`) — donc dans un autre TikTok, donc dans un
 *      autre format.
 *
 * On aligne tout sur le ratio dominant du post, recadrage `cover` centré.
 *
 * Règle non négociable : **jamais d'agrandissement**. Le recadrage reste
 * inscrit dans la source (le transformateur Supabase refuse d'agrandir et
 * renverrait un ratio faux si on le lui demandait). Les tailles en pixels
 * peuvent donc rester différentes d'une slide à l'autre — seul le ratio compte
 * pour TikTok, et ne pas rééchantillonner préserve la qualité.
 *
 * Module pur : importé côté front (page poster) comme côté Edge.
 */

export interface DimensionsVisuel {
  largeur: number;
  hauteur: number;
}

/** Deux ratios comptent pour « le même format » en deçà de cet écart relatif. */
export const TOLERANCE_RATIO = 0.02;

/** Qualité de réencodage du recadrage (le transformateur défaut à 80). */
export const QUALITE_RECADRAGE = 95;

export function ratioVisuel(d: DimensionsVisuel): number {
  return d.largeur / d.hauteur;
}

function dimensionsValides(d: DimensionsVisuel): boolean {
  return (
    Number.isFinite(d.largeur) &&
    Number.isFinite(d.hauteur) &&
    d.largeur > 0 &&
    d.hauteur > 0
  );
}

export function memeFormat(a: number, b: number): boolean {
  if (!(a > 0) || !(b > 0)) return false;
  return Math.abs(a - b) <= b * TOLERANCE_RATIO;
}

/**
 * Ratio à imposer à tout le post : celui du plus gros groupe de slides déjà au
 * même format. À égalité de groupe, celui qui rogne le moins de pixels au
 * total — la part conservée par un recadrage `cover` vaut `min(r/rs, rs/r)`.
 *
 * Sur une égalité parfaite (deux slides d'un format, deux d'un autre : le cas
 * existe en prod), les deux critères sont symétriques et ne départagent rien.
 * On garde alors le format de la **première slide**, `dims` étant donné dans
 * l'ordre du diaporama : le hook est la vignette du feed, c'est le cadrage
 * qu'on ne veut surtout pas rogner.
 *
 * Le ratio renvoyé est toujours celui d'une slide existante : au moins une
 * image n'est pas touchée.
 */
export function ratioDominant(dims: DimensionsVisuel[]): number | null {
  const valides = dims.filter(dimensionsValides);
  if (valides.length === 0) return null;

  let meilleur: { ratio: number; groupe: number; conserve: number } | null = null;
  for (const candidat of valides) {
    const ratio = ratioVisuel(candidat);
    let groupe = 0;
    let conserve = 0;
    for (const autre of valides) {
      const r = ratioVisuel(autre);
      if (memeFormat(r, ratio)) groupe += 1;
      conserve += Math.min(ratio / r, r / ratio);
    }
    const gagne =
      !meilleur ||
      groupe > meilleur.groupe ||
      (groupe === meilleur.groupe && conserve > meilleur.conserve + 1e-9);
    if (gagne) meilleur = { ratio, groupe, conserve };
  }
  return meilleur?.ratio ?? null;
}

/**
 * Dimensions du recadrage `cover` inscrit dans `source` au ratio demandé.
 * `null` si la source est déjà au bon format (rien à faire) ou inexploitable.
 */
export function recadrageCible(
  source: DimensionsVisuel,
  ratio: number,
): DimensionsVisuel | null {
  if (!dimensionsValides(source) || !(ratio > 0)) return null;
  const actuel = ratioVisuel(source);
  if (memeFormat(actuel, ratio)) return null;

  let largeur: number;
  let hauteur: number;
  if (ratio < actuel) {
    // Cible plus étroite : on garde la hauteur, on rogne les côtés.
    hauteur = source.hauteur;
    largeur = Math.round(hauteur * ratio);
  } else {
    // Cible plus large : on garde la largeur, on rogne haut et bas.
    largeur = source.largeur;
    hauteur = Math.round(largeur / ratio);
  }
  // L'arrondi peut déborder d'un pixel — jamais au-delà de la source.
  largeur = Math.max(1, Math.min(largeur, source.largeur));
  hauteur = Math.max(1, Math.min(hauteur, source.hauteur));
  return { largeur, hauteur };
}

/**
 * URL de rendu Supabase (`/render/image/`) recadrée en `cover` centré.
 * `null` si l'URL n'est pas un objet public de Storage — on sert alors
 * l'original plutôt que de fabriquer un lien mort.
 */
export function urlVisuelRecadre(
  url: string,
  cible: DimensionsVisuel,
  qualite = QUALITE_RECADRAGE,
): string | null {
  if (!dimensionsValides(cible)) return null;
  const MARQUEUR = "/storage/v1/object/public/";
  let parsee: URL;
  try {
    parsee = new URL(url);
  } catch {
    return null;
  }
  if (!parsee.pathname.startsWith(MARQUEUR)) return null;

  parsee.pathname = parsee.pathname.replace(
    MARQUEUR,
    "/storage/v1/render/image/public/",
  );
  parsee.searchParams.set("width", String(Math.round(cible.largeur)));
  parsee.searchParams.set("height", String(Math.round(cible.hauteur)));
  parsee.searchParams.set("resize", "cover");
  parsee.searchParams.set("quality", String(qualite));
  // `origin` garde le format du fichier stocké : un PNG réécrit reste un PNG,
  // donc le `storage_path` et son extension restent cohérents.
  parsee.searchParams.set("format", "origin");
  return parsee.toString();
}
