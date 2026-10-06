/**
 * Atelier AI UGC (0308) côté front : les règles pures de
 * `_shared/ugc_video.ts`, réexportées pour que Vitest les lise et que l'écran
 * compte comme la fonction `ugc-video`.
 */
export {
  coutRendu,
  dureeReactionValide,
  estMoteurKling,
  idVideoTiktok,
  instantsPlanche,
  lireCoupe,
  MOTEUR_DEFAUT,
  MOTEURS_KLING,
  normaliserTextes,
  pasPlanche,
  PRIX_IMAGE_PERSONA,
  promptCoupe,
  promptPersona,
  RATIO_DUREE_MIN,
  REACTION_MAX_S,
  REACTION_MIN_S,
  renduAssezLong,
} from "../../../supabase/functions/_shared/ugc_video.ts";
export type { Coupe, MoteurKling, SegmentTexte } from "../../../supabase/functions/_shared/ugc_video.ts";
