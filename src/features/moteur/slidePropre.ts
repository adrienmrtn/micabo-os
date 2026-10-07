import type { PostSlide } from "./types";

/**
 * Une photo rangée sous `incruste/` est un white post (0306) : son texte est
 * DESSINÉ dans l'image, dans la langue du compte. Elle n'a rien à nettoyer et
 * se poste telle quelle — la passer au nettoyage effacerait le post.
 */
export function estCheminIncruste(storagePath: string | null | undefined): boolean {
  return Boolean(storagePath?.startsWith("incruste/"));
}

/**
 * Une slide est publiable si sa photo a été nettoyée (`propre/…`) ou si son
 * texte est incrusté par construction (`incruste/…`). Un `brut/` porte encore
 * le texte d'origine, un média absent n'a rien du tout.
 */
export function estPropre(slide: PostSlide): boolean {
  const chemin = slide.media_library?.storage_path;
  return Boolean(chemin?.startsWith("propre/")) || estCheminIncruste(chemin);
}

/** White post : le texte est dans l'image, il n'y a rien à poser dessus. */
export function estIncruste(slide: PostSlide): boolean {
  return estCheminIncruste(slide.media_library?.storage_path);
}
