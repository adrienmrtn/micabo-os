// Gabarit d'une slide (paragraphes, lignes, largeur) : module pur partagé avec
// le moteur, réexporté ici pour que Vitest le lise.
export {
  decrireGabarit,
  ECART_LIGNES,
  ecartsGabarit,
  gabarit,
  type Gabarit,
  LONGUEUR_MAX,
  LONGUEUR_MIN,
  MARGE_LARGEUR,
  modeleMicabo,
} from "../../../supabase/functions/_shared/gabarit.ts";
