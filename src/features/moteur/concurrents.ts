// Repérage des concurrents dans les slides et contrôle des réécritures (0287) :
// module pur partagé avec le moteur, réexporté ici pour que Vitest le lise.
export {
  appliquerVerdicts,
  type Concurrent,
  CONCURRENTS_DEFAUT,
  concurrentsCites,
  reecritureAcceptable,
  regexConcurrent,
  retirerHashtagsConcurrents,
  slidesAJuger,
  type VerdictConcurrent,
} from "../../../supabase/functions/_shared/concurrents.ts";
