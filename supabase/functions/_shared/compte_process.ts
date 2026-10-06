/**
 * Les comptes que l'assignation des SLIDESHOWS doit servir.
 *
 * Module pur, réexporté par `src/features/moteur/compteProcess.ts` pour que
 * Vitest le lise : `assignation_contenu.ts` tire `supabase.ts` et son
 * specifier `jsr:`, que Vite ne résout pas.
 *
 * Deux règles :
 *   - un compte VIDÉO AI UGC (`ugc_ai_video`, 0310) reçoit sa vidéo du jour
 *     par `ugc_publications`, jamais un slideshow. Sans cette règle, sorti de
 *     warmup et sans label, il restait « sous quota » pour toujours : chaque
 *     maillon de la chaîne d'assignation (jusqu'à 40, toutes les 15 minutes)
 *     le reprenait pour journaliser « aucun label ». Le mode test ne le sert
 *     pas non plus ;
 *   - sinon, un compte n'est servi qu'une fois son warmup fini (le mode test
 *     peut viser un compte hors process).
 */
export interface CompteProcess {
  warmup_ends_at?: string | null;
  ugc_ai_video?: boolean | null;
}

export function compteEnProcess(
  compte: CompteProcess,
  maintenantMs: number,
  ignorerWarmup = false,
): boolean {
  if (compte.ugc_ai_video) return false;
  if (ignorerWarmup) return true;
  if (!compte.warmup_ends_at) return false; // pas démarré → hors process
  return new Date(compte.warmup_ends_at).getTime() <= maintenantMs;
}
