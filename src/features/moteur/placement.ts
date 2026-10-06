// Où micabo entre dans un deck (0289) : module pur partagé avec le moteur,
// réexporté ici pour que Vitest le lise.
export {
  alignerPrefixe,
  casseLeDeck,
  choisirVariante,
  citeMicabo,
  marquerPlacement,
  MOTIF_MICABO,
  positionsPermises,
  prefixeNumero,
  slideCitantMicabo,
} from "../../../supabase/functions/_shared/placement.ts";
