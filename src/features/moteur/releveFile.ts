// Règles du relevé des stats (quels passages, quelle profondeur de scrape) :
// module pur partagé avec le moteur, réexporté ici pour que Vitest le lise.
export {
  agePublicationMs,
  DELAI_MIN_RELEVE_MS,
  estApifyEpuise,
  metricsAScraper,
  passageARelever,
  POSTS_RELEVES,
  POSTS_RELEVES_MAX,
  profondeurScrape,
  RAFRAICHIR_APRES_MS,
  RELEVE_ECHECS_MAX,
  RELEVE_FIGE_APRES_JOURS,
  repliAutorise,
  type PassageReleve,
} from "../../../supabase/functions/_shared/releve_file.ts";
