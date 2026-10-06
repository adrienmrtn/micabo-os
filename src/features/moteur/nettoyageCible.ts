// Géométrie du nettoyage ciblé : module pur partagé avec le moteur,
// réexporté ici pour que Vitest le lise.
export {
  MARGE_EFFACEMENT,
  masqueSur,
  rognerHors,
  SURFACE_MIN_ROGNEE,
  type ZoneFraction,
  type ZoneNommee,
  zonesNommees,
} from "../../../supabase/functions/_shared/nettoyage_cible.ts";
