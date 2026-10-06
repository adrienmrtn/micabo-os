/**
 * Atelier AI UGC (0308) côté front : les règles pures de
 * `_shared/ugc_video.ts`, réexportées pour que Vitest les lise et que l'écran
 * compte comme la fonction `ugc-video`.
 */
export {
  coutRendu,
  dureeReactionValide,
  estMoteurKling,
  formeConforme,
  idVideoTiktok,
  instantsPlanche,
  LANGUES_UGC,
  lireCoupe,
  lireTraductionUgc,
  MOTEUR_DEFAUT,
  MOTEURS_KLING,
  normaliserTextes,
  pasPlanche,
  PRIX_IMAGE_PERSONA,
  promptCoupe,
  promptPersona,
  promptTraductionUgc,
  RATIO_DUREE_MIN,
  ratioNanoBanana,
  RATIOS_NANO_BANANA,
  REACTION_MAX_S,
  REACTION_MIN_S,
  renduAssezLong,
} from "../../../supabase/functions/_shared/ugc_video.ts";
export type { Coupe, LangueUgc, MoteurKling, SegmentTexte } from "../../../supabase/functions/_shared/ugc_video.ts";
