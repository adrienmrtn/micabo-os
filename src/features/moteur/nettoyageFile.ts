/**
 * Politique de file du nettoyage d'import (miroir du backend).
 *
 * Une slide qui échoue en boucle ne doit bloquer ni son diaporama ni les
 * imports des autres comptes : on sert la moins tentée d'abord, et on sort de
 * la file celles qui ont épuisé leurs essais (repli sur le brut).
 */

export const MAX_TENTATIVES_NETTOYAGE = 4;

export interface SlideFileNettoyage {
  position: number;
  media_id: string | null;
  tentatives?: number;
}

export function tentativesSlide(slide: SlideFileNettoyage): number {
  const n = Number(slide.tentatives ?? 0);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/** Slides encore sans média : les moins tentées d'abord, puis par position. */
export function fileNettoyage<T extends SlideFileNettoyage>(slides: T[]): T[] {
  return slides
    .filter((s) => !s.media_id)
    .map((slide, ordre) => ({ slide, ordre }))
    .sort((a, b) => {
      const d = tentativesSlide(a.slide) - tentativesSlide(b.slide);
      if (d !== 0) return d;
      const p = a.slide.position - b.slide.position;
      return p !== 0 ? p : a.ordre - b.ordre;
    })
    .map((x) => x.slide);
}

/** Slides à bout d'essais : à sortir de la file sans rappeler le provider. */
export function slidesEpuisees<T extends SlideFileNettoyage>(
  slides: T[],
  max = MAX_TENTATIVES_NETTOYAGE,
): T[] {
  return slides.filter((s) => !s.media_id && tentativesSlide(s) >= max);
}

/** Slides à tenter sur ce passage — les épuisées sont traitées à part. */
export function prochainesSlidesANettoyer<T extends SlideFileNettoyage>(
  slides: T[],
  parPassage: number,
  max = MAX_TENTATIVES_NETTOYAGE,
): T[] {
  return fileNettoyage(slides)
    .filter((s) => tentativesSlide(s) < max)
    .slice(0, Math.max(0, parPassage));
}

/** Reste-t-il des slides sans média sur ce diaporama ? */
export function nettoyageTermine(slides: SlideFileNettoyage[]): boolean {
  return slides.every((s) => Boolean(s.media_id));
}
