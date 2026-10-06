// Les comptes que l'assignation des slideshows sert (warmup fini, pas un
// compte vidéo) : module pur partagé avec le moteur, réexporté ici pour que
// Vitest le lise.
export {
  compteEnProcess,
  type CompteProcess,
} from "../../../supabase/functions/_shared/compte_process.ts";
