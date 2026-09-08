import { LANGUES_CIBLES } from "@/features/moteur/langues";

import { nomPays } from "./pipeline";
import { contratActif, missionOuverte } from "./totaux";
import type { UpworkAlerte, UpworkContrat, UpworkMission } from "./types";

export type Marche = {
  langue: string;
  jobHm: UpworkMission | null;
  hm: UpworkContrat | null;
  jobsCreateurs: UpworkMission[];
  createurs: UpworkAlerte[];
};

function langueDe(valeur: string | null | undefined): string {
  return (valeur ?? "").trim();
}

export function langueContrat(c: UpworkContrat, missions: UpworkMission[]): string {
  const propre = langueDe(c.langue);
  if (propre) return propre;
  const job = missions.find((m) => m.job_posting_id && m.job_posting_id === c.job_posting_id);
  return langueDe(job?.langue);
}

function nomsProches(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = (a ?? "").trim().toLowerCase();
  const nb = (b ?? "").trim().toLowerCase();
  if (!na || !nb) return false;
  if (na === nb) return true;
  const prenom = na.split(/\s+/)[0] ?? "";
  return prenom.length >= 3 && nb.includes(prenom);
}

export function alertePourHm(a: UpworkAlerte, hm: UpworkContrat): boolean {
  if (a.manager_id && hm.profile_id && a.manager_id === hm.profile_id) return true;
  return nomsProches(a.manager_nom, hm.freelancer_nom);
}

const ORDRE_PAYS = [...LANGUES_CIBLES, ""];

function rangPays(langue: string): number {
  const i = ORDRE_PAYS.indexOf(langue as (typeof ORDRE_PAYS)[number]);
  return i === -1 ? ORDRE_PAYS.length : i;
}

/** Un marché = un pays, avec ses 4 objets (job HM, HM, jobs créateurs, créateurs). */
export function marchesDepuisDashboard(
  missions: UpworkMission[],
  contrats: UpworkContrat[],
  alertes: UpworkAlerte[],
): Marche[] {
  const jobs = missions.filter((m) => missionOuverte(m.statut));
  const hms = contrats.filter((c) => contratActif(c.statut) || Boolean(c.contrat_at));

  const cles = new Set<string>();
  for (const m of jobs) cles.add(langueDe(m.langue));
  for (const c of hms) cles.add(langueContrat(c, jobs));

  const marches: Marche[] = [...cles]
    .sort((a, b) => rangPays(a) - rangPays(b))
    .map((langue) => {
      const jobHmListe = jobs.filter((m) => m.famille === "hm" && langueDe(m.langue) === langue);
      const hmListe = hms.filter((c) => langueContrat(c, jobs) === langue);
      const hm = hmListe[0] ?? null;
      const createurs = hm ? alertes.filter((a) => alertePourHm(a, hm)) : [];
      return {
        langue,
        jobHm: jobHmListe[0] ?? null,
        hm,
        jobsCreateurs: jobs.filter((m) => m.famille === "createur" && langueDe(m.langue) === langue),
        createurs,
      };
    })
    .filter((m) => m.jobHm || m.hm || m.jobsCreateurs.length > 0 || m.createurs.length > 0);

  const rattaches = new Set(marches.flatMap((m) => m.createurs.map((a) => a.id)));
  const orphelins = alertes.filter((a) => !rattaches.has(a.id));
  if (orphelins.length > 0) {
    const inconnu = marches.find((m) => m.langue === "");
    if (inconnu) inconnu.createurs.push(...orphelins);
    else {
      marches.push({
        langue: "",
        jobHm: null,
        hm: null,
        jobsCreateurs: [],
        createurs: orphelins,
      });
    }
  }

  return marches;
}

export function titreMetierHm(nom: string, langue: string, locale: string): string {
  return `HM ${nomPays(langue || null, locale)} — ${nom}`;
}

export function titreMetierJobHm(langue: string, locale: string): string {
  const fr = locale.startsWith("fr");
  const pays = nomPays(langue || null, locale);
  return fr ? `Job : recruter un HM ${pays}` : `Job: hire a ${pays} HM`;
}

export function titreMetierJobCreateur(langue: string, locale: string): string {
  const fr = locale.startsWith("fr");
  const pays = nomPays(langue || null, locale);
  return fr ? `Job créateurs ${pays}` : `${pays} creator job`;
}
