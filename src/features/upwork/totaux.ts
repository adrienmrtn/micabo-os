import { LANGUES_CIBLES } from "@/features/moteur/langues";

import type {
  FamilleMission,
  TotauxPays,
  TotauxUpwork,
  UpworkAction,
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
  for (const m of missions.filter((x) => missionOuverte(x.statut))) {
    const l = langueCle(m.langue);
    if (l) cles.add(l);
  }
  for (const c of contrats.filter((x) => contratActif(x.statut))) {
    const l = langueCle(c.langue);
    if (l) cles.add(l);
  }

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

/** Stop demandé : encore visible tant que l'action n'est pas faite. Ensuite, plus là. */
export function approcheEncoreVisible(
  a: Pick<UpworkApproche, "upwork_proposal_id" | "arrete_ok">,
  actions: Pick<UpworkAction, "upwork_proposal_id" | "type" | "statut">[],
): boolean {
  if (!a.arrete_ok) return true;
  return actions.some(
    (x) =>
      x.upwork_proposal_id === a.upwork_proposal_id &&
      x.type === "arreter_recrutement" &&
      x.statut === "en_attente",
  );
}

export function approchesDuJob(approches: UpworkApproche[], jobPostingId: string): UpworkApproche[] {
  return approches
    .filter((a) => a.job_posting_id === jobPostingId)
    .sort((a, b) => {
      if (a.statut !== b.statut) return a.statut === "hired" ? -1 : 1;
      return a.nom.localeCompare(b.nom, "fr");
    });
}

type HmJobCreateur = Pick<
  UpworkApproche,
  "id" | "role" | "job_createur_id" | "contract_id" | "os_ok" | "slack_ok" | "nom"
>;

function scoreProprieteJobCreateur(hm: HmJobCreateur, contrats: UpworkContrat[]): [number, string, number, string] {
  const contrat = contrats.find((c) => c.contract_id && c.contract_id === hm.contract_id);
  return [
    contrat?.createurs_n ?? 0,
    contrat?.contrat_at ?? "9999",
    (hm.os_ok ? 1 : 0) + (hm.slack_ok ? 1 : 0),
    hm.nom,
  ];
}

/** Un job créateurs n’appartient qu’à un HM — jamais « le job du pays ». */
export function proprietaireJobCreateur(
  jobPostingId: string,
  hms: HmJobCreateur[],
  contrats: UpworkContrat[],
): HmJobCreateur | null {
  const candidats = hms.filter((h) => h.role === "hm" && h.job_createur_id === jobPostingId);
  if (candidats.length === 0) return null;
  return [...candidats].sort((a, b) => {
    const [na, ta, sa, noma] = scoreProprieteJobCreateur(a, contrats);
    const [nb, tb, sb, nomb] = scoreProprieteJobCreateur(b, contrats);
    if (na !== nb) return nb - na;
    if (ta !== tb) return ta.localeCompare(tb);
    if (sa !== sb) return sb - sa;
    return noma.localeCompare(nomb, "fr");
  })[0]!;
}

/** Phase 2 : uniquement le job post de ce HM, s’il en est le seul propriétaire. */
export function jobCreateurPourHm(
  hm: HmJobCreateur,
  missions: UpworkMission[],
  hms: HmJobCreateur[],
  contrats: UpworkContrat[],
): UpworkMission | null {
  const id = hm.job_createur_id;
  if (!id) return null;
  const job = missions.find((m) => m.job_posting_id === id && missionOuverte(m.statut));
  if (!job) return null;
  const proprio = proprietaireJobCreateur(id, hms, contrats);
  if (!proprio || proprio.id !== hm.id) return null;
  return job;
}

export function opportunitesEnCours(approches: UpworkApproche[], jobPostingId: string): number {
  return approches.filter((a) => a.job_posting_id === jobPostingId && a.statut === "messaged").length;
}
