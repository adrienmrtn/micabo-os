import { serviceClient } from "./supabase.ts";

export type Supabase = ReturnType<typeof serviceClient>;

/**
 * Ancienne MAJ des scores `contenu_langues` depuis les stats.
 *
 * Retirée avec le passage en tierlist : un slideshow n'a plus de score par
 * langue, son tier bouge à la requalification (`_shared/requalification.ts`),
 * une fois son cycle de passages terminé. La fonction reste en place pour
 * l'étape `scores` (minuit / Edge `scoring`), qui ne fait donc plus rien.
 *
 * L'ELO **compte** a suivi le même chemin le 12/09/2026 : les créateurs ne
 * portent plus un nombre mais une case (`comptes.qualification`, voir
 * `_shared/qualification.ts`). Les réglages `scoring` qui restent dans
 * `reglages` ne servent plus qu'à la note d'import, qui les lit elle-même
 * (`import_contenu.ts`).
 */
export function majScoresDepuisPassages(): {
  contenus: number;
  comptes: number;
  saute: true;
  raison: string;
} {
  return {
    contenus: 0,
    comptes: 0,
    saute: true,
    raison: "Étape retirée — les slideshows suivent la tierlist (requalification à minuit).",
  };
}
