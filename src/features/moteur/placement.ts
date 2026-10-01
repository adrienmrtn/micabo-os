// Où micabo entre dans un deck (0289) : module pur partagé avec le moteur,
// réexporté ici pour que Vitest le lise.
export {
  citeMicabo,
  marquerPlacement,
  MOTIF_MICABO,
  positionsPermises,
  slideCitantMicabo,
} from "../../../supabase/functions/_shared/placement.ts";
