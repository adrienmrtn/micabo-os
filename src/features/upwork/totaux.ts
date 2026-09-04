import { LANGUES_CIBLES } from "@/features/moteur/langues";

import type {
  FamilleMission,
  TotauxPays,
  TotauxUpwork,
  UpworkApproche,
  UpworkContrat,
  UpworkMission,
} from "./types";

export function missionOuverte(statut: string | null | undefined): boolean {
  return (statut ?? "").toUpperCase() === "PUBLISHED";
}

export function contratActif(statut: string | null | undefined): boolean {
  const s = (statut ?? "").toUpperCase();
  return s === "ACTIVE" || s === "ACTIF";
}

export function langueCle(valeur: string | null | undefined): string {
  return (valeur ?? "").trim();
}

const ORDRE_PAYS = [...LANGUES_CIBLES, ""];

function rangPays(langue: string): number {
  const i = ORDRE_PAYS.indexOf(langue as (typeof ORDRE_PAYS)[number]);
  return i === -1 ? ORDRE_PAYS.length : i;
}

function totauxPour(
  langue: string | null,
  missions: UpworkMission[],
  contrats: UpworkContrat[],
): Omit<TotauxPays, "langue"> {
  const ouvertes = missions.filter((m) => missionOuverte(m.statut));
  const jobs = langue == null ? ouvertes : ouvertes.filter((m) => langueCle(m.langue) === langue);
  const hms = contrats.filter((c) => {
    if (!contratActif(c.statut)) return false;
    if (langue == null) return true;
    return langueCle(c.langue) === langue;
  });
  return {
    hms: hms.length,
    createurs: hms.reduce((n, c) => n + c.createurs_n, 0),
    jobsHmOuverts: jobs.filter((m) => m.famille === "hm").length,
    jobsCreateursOuverts: jobs.filter((m) => m.famille === "createur").length,
  };
}

export function totauxUpwork(missions: UpworkMission[], contrats: UpworkContrat[]): TotauxUpwork {
  const global = totauxPour(null, missions, contrats);
  const cles = new Set<string>();
  for (const m of missions.filter((x) => missionOuverte(x.statut))) cles.add(langueCle(m.langue));
  for (const c of contrats.filter((x) => contratActif(x.statut))) cles.add(langueCle(c.langue));

  const parPays = [...cles]
    .sort((a, b) => rangPays(a) - rangPays(b))
    .map((langue) => ({ langue, ...totauxPour(langue, missions, contrats) }))
    .filter((p) => p.hms || p.createurs || p.jobsHmOuverts || p.jobsCreateursOuverts);

  return { ...global, parPays };
}

export function missionsFiltrees(
  missions: UpworkMission[],
  famille: FamilleMission | "toutes",
): UpworkMission[] {
  return missions.filter((m) => {
    if (!missionOuverte(m.statut)) return false;
    if (famille !== "toutes" && m.famille !== famille) return false;
    return true;
  });
}

export function approchesDuJob(approches: UpworkApproche[], jobPostingId: string): UpworkApproche[] {
  return approches
    .filter((a) => a.job_posting_id === jobPostingId)
    .sort((a, b) => {
      if (a.statut !== b.statut) return a.statut === "hired" ? -1 : 1;
      return a.nom.localeCompare(b.nom, "fr");
    });
}

export function opportunitesEnCours(approches: UpworkApproche[], jobPostingId: string): number {
  return approches.filter((a) => a.job_posting_id === jobPostingId && a.statut === "messaged").length;
}
