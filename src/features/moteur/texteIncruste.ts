/**
 * Slideshows à texte incrusté (white posts, 0306) côté front.
 *
 * Les règles vivent dans le module pur `_shared/texte_incruste.ts`, réexporté
 * ici pour que Vitest les lise et que la file de validation compte comme
 * l'assignation : une langue n'existe que si son deck porte une image à chaque
 * position.
 */
import {
  deckIncrustePret,
  type SlideIncrustee,
} from "../../../supabase/functions/_shared/texte_incruste.ts";

export {
  cheminIncruste,
  deckIncrustePret,
  deckIncrusteServi,
  jpegSansMetadonnees,
  languesIncrustees,
  visuelsIncrustes,
  type DeckIncruste,
  type SlideIncrustee,
} from "../../../supabase/functions/_shared/texte_incruste.ts";

export interface ImageIncrustee {
  position: number;
  media_id: string | null;
  url: string | null;
}

export interface VersionIncrustee {
  langue: string;
  /** Le deck partira tel quel chez un créateur de cette langue. */
  prete: boolean;
  images: ImageIncrustee[];
}

/**
 * Les versions d'un slideshow incrusté, une par langue, images dans l'ordre des
 * positions. Une version incomplète est rendue quand même (`prete: false`) : la
 * file doit MONTRER le trou, pas le cacher.
 */
export function versionsIncrustees(
  decks: Array<{ langue: string; slides: SlideIncrustee[] | null | undefined }>,
  urls: Record<string, string>,
): VersionIncrustee[] {
  return decks
    .map((d) => {
      const slides = (d.slides ?? [])
        .slice()
        .sort((a, b) => Number(a.position) - Number(b.position));
      return {
        langue: d.langue,
        prete: deckIncrustePret(slides),
        images: slides.map((s) => ({
          position: Number(s.position),
          media_id: s.media_id ?? null,
          url: s.media_id ? (urls[s.media_id] ?? null) : null,
        })),
      };
    })
    .sort((a, b) => a.langue.localeCompare(b.langue));
}

/** Vignette d'une liste : la première image de la première version prête. */
export function vignetteIncrustee(versions: VersionIncrustee[] | undefined): string | null {
  for (const v of versions ?? []) {
    if (!v.prete) continue;
    const url = v.images.find((i) => i.url)?.url;
    if (url) return url;
  }
  return null;
}
