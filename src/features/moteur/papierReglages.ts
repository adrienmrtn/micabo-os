/** Helpers purs — réglages papier (durée, voix, pause, quota Fal). */

import { dureeCibleClip, type DureeCibleClip } from "./papierScript";

export const VOIX_PAPIER_DEFAUT = "George";

export const VOIX_PAPIER = [
  "George",
  "Liam",
  "Will",
  "Daniel",
  "Chris",
  "Brian",
  "Bill",
  "Roger",
  "Alice",
  "Lily",
  "Matilda",
  "Jessica",
  "Sarah",
  "Charlotte",
  "Laura",
] as const;

export type VoixPapier = (typeof VOIX_PAPIER)[number];
export type DureeClipReglage = DureeCibleClip | "auto";

export type ReglagesPapier = {
  /** false = cron + auto-chaîne à l'arrêt (l'admin peut encore forcer). */
  actif: boolean;
  /** Durée cible de la vidéo (secondes), hors marge CTA. */
  duree_cible_sec: number;
  /** Durée Seedance par plan, ou auto selon le texte. */
  duree_clip: DureeClipReglage;
  /** Voix ElevenLabs par défaut. */
  voix: string;
  /** Surcharge par code langue. */
  voix_par_langue: Record<string, string>;
  /** Appels Fal / jour Paris. 0 = illimité. */
  fal_quota_jour: number;
};

export type PapierFalUsage = {
  date: string | null;
  appels: number;
};

export const REGLAGES_PAPIER_DEFAUT: ReglagesPapier = {
  actif: true,
  duree_cible_sec: 48,
  duree_clip: "auto",
  voix: VOIX_PAPIER_DEFAUT,
  voix_par_langue: {},
  fal_quota_jour: 300,
};

export const QUOTA_FAL_PAPIER = "QUOTA_FAL_PAPIER";

export function estVoixPapier(nom: string): boolean {
  return (VOIX_PAPIER as readonly string[]).includes(nom);
}

export function normaliserDureeClip(valeur: unknown): DureeClipReglage {
  if (valeur === 4 || valeur === 6 || valeur === 8 || valeur === "auto") return valeur;
  if (valeur === "4" || valeur === "6" || valeur === "8") return Number(valeur) as DureeCibleClip;
  return "auto";
}

export function normaliserReglagesPapier(brut: unknown): ReglagesPapier {
  const o = brut && typeof brut === "object" ? (brut as Record<string, unknown>) : {};
  const sec = Number(o.duree_cible_sec);
  const quota = Number(o.fal_quota_jour);
  const voix = String(o.voix ?? "").trim() || VOIX_PAPIER_DEFAUT;
  const par: Record<string, string> = {};
  if (o.voix_par_langue && typeof o.voix_par_langue === "object" && !Array.isArray(o.voix_par_langue)) {
    for (const [code, nom] of Object.entries(o.voix_par_langue)) {
      const v = String(nom ?? "").trim();
      if (v) par[String(code).trim().toLowerCase()] = v;
    }
  }
  return {
    actif: o.actif !== false,
    duree_cible_sec: Number.isFinite(sec) ? Math.min(90, Math.max(20, Math.round(sec))) : 48,
    duree_clip: normaliserDureeClip(o.duree_clip),
    voix,
    voix_par_langue: par,
    fal_quota_jour: Number.isFinite(quota) ? Math.max(0, Math.round(quota)) : 300,
  };
}

export function voixPourLangue(reglages: ReglagesPapier, langue: string): string {
  return reglages.voix_par_langue[langue]?.trim() || reglages.voix || VOIX_PAPIER_DEFAUT;
}

/** FR = voix du master. Autres langues : surcharge réglages, sinon voix du master. */
export function voixEffectiveMaster(
  masterVoice: string | null | undefined,
  reglages: ReglagesPapier,
  langue: string,
): string {
  const duMaster = String(masterVoice ?? "").trim();
  if (langue === "fr") return duMaster || reglages.voix || VOIX_PAPIER_DEFAUT;
  return reglages.voix_par_langue[langue]?.trim() || duMaster || reglages.voix || VOIX_PAPIER_DEFAUT;
}

export function dureeCibleClipReglee(texte: string, clip: DureeClipReglage): DureeCibleClip {
  if (clip === 4 || clip === 6 || clip === 8) return clip;
  return dureeCibleClip(texte);
}

export function usageFalDuJour(
  row: { date?: string | null; appels?: number } | null | undefined,
  aujourdHui: string,
): number {
  if (!row || row.date !== aujourdHui) return 0;
  const n = Number(row.appels);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

/** quota ≤ 0 = illimité. */
export function peutReserverFal(usage: number, quota: number, n = 1): boolean {
  if (quota <= 0) return true;
  return usage + n <= quota;
}

export function erreurQuotaFal(usage: number, quota: number): Error {
  const e = new Error(`Quota Fal papier atteint (${usage}/${quota})`);
  e.name = QUOTA_FAL_PAPIER;
  return e;
}

export function estErreurQuotaFal(e: unknown): boolean {
  return e instanceof Error && e.name === QUOTA_FAL_PAPIER;
}
