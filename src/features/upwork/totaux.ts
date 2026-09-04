import type { FamilleMission, TotauxUpwork, UpworkAlerte, UpworkContrat, UpworkMission } from "./types";

export function missionOuverte(statut: string | null | undefined): boolean {
  return (statut ?? "").toUpperCase() === "PUBLISHED";
}

export function contratActif(statut: string | null | undefined): boolean {
  const s = (statut ?? "").toUpperCase();
  return s === "ACTIVE" || s === "ACTIF";
}

export function totauxUpwork(
  missions: UpworkMission[],
  contrats: UpworkContrat[],
  alertes: UpworkAlerte[],
): TotauxUpwork {
  const ouvertes = missions.filter((m) => missionOuverte(m.statut));
  return {
    missionsOuvertes: ouvertes.length,
    missionsHmOuvertes: ouvertes.filter((m) => m.famille === "hm").length,
    newApplicants: ouvertes.reduce((s, m) => s + m.new_applicants, 0),
    contratsActifs: contrats.filter((c) => contratActif(c.statut)).length,
    alertesL2: alertes.filter((a) => a.niveau === "l2").length,
    alertesL1: alertes.filter((a) => a.niveau === "l1").length,
  };
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
