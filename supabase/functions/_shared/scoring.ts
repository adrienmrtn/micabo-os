import { serviceClient } from "./supabase.ts";

export type Supabase = ReturnType<typeof serviceClient>;

/**
 * Historique : l'ELO runtime par langue a d'abord été mis en pause, puis retiré
 * au passage en tierlist. Ce drapeau reste `true` — les slideshows n'ont plus
 * de score par langue, seul l'ELO **compte** vit encore (rattrapage).
 */
export const PAUSE_ELO_RUNTIME = true;

export interface ScoringReglages {
  /** Lissage EWMA — conservé pour l'historique, plus lu par l'ELO compte. */
  ewma_alpha: number;
  regularisation_k: number;
  transfert_inter_langue: number;
  score_prior: number;
  /** Régularisation ELO compte / import (défaut 1 — faible pour laisser les vues parler). */
  elo_regularisation_k: number;
  /** Plafond vues (= score 100) pour l’échelle log^1.3. */
  elo_vues_plafond: number;
}

export async function chargerScoring(supabase: Supabase): Promise<ScoringReglages> {
  const { data } = await supabase.from("reglages").select("valeur").eq("cle", "scoring").maybeSingle();
  const v = (data?.valeur ?? {}) as Record<string, number>;
  return {
    ewma_alpha: v.ewma_alpha ?? 0.3,
    regularisation_k: v.regularisation_k ?? 5,
    transfert_inter_langue: v.transfert_inter_langue ?? 0.15,
    score_prior: v.score_prior ?? 50,
    elo_regularisation_k: v.elo_regularisation_k ?? 1,
    elo_vues_plafond: v.elo_vues_plafond ?? 80_000,
  };
}

/**
 * Performance brute d'un passage (0..100) depuis les vues.
 * Échelle log^1.3 alignée sur l'ELO import — 1–4 vues ≈ 3–8 (plus de plancher à 40).
 */
export function performancePassage(
  vues: number | null | undefined,
  plafond = 80_000,
): number {
  const p = Math.max(1, plafond);
  const exp = 1.3;
  const num = Math.log(1 + (vues ?? 0)) ** exp;
  const den = Math.log(1 + p) ** exp;
  return Math.min(100, Math.max(0, (num / den) * 100));
}

/**
 * Ancienne MAJ des scores `contenu_langues` depuis les stats.
 *
 * Retirée avec le passage en tierlist : un slideshow n'a plus de score par
 * langue, son tier bouge à la requalification (`_shared/requalification.ts`),
 * une fois son cycle de passages terminé. La fonction reste en place pour
 * l'étape `scores` (minuit / Edge `scoring`), qui ne fait donc plus rien.
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
