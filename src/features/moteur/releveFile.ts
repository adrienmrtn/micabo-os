// Règles du relevé des stats (une mesure à J+2, par lien, profil sans lien) :
// module pur partagé avec le moteur, réexporté ici pour que Vitest le lise.
export {
  agePublicationMs,
  apparierParLien,
  estApifyEpuise,
  idPostTiktok,
  lienTiktok,
  MESURE_A_MS,
  mesureFaite,
  passageARelever,
  POSTS_RELEVES,
  POSTS_RELEVES_MAX,
  profondeurScrape,
  RELEVE_ECHECS_MAX,
  RETENTER_APRES_MS,
  SANS_LIEN_MAX_JOURS,
  type PassageReleve,
} from "../../../supabase/functions/_shared/releve_file.ts";
