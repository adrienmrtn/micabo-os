import type { TypeAction, UpworkAction, UpworkCampagne, UpworkCandidat } from "./types";

/** Les trois temps d'une campagne, dans l'ordre où l'agent les exécute. */
export const ETAPES_CAMPAGNE: TypeAction[] = ["publier_job_hm", "sourcer_hm", "inviter_hm"];

export type EtatCampagne =
  | { cle: "absente" }
  | { cle: "terminee"; campagne: UpworkCampagne }
  | { cle: "arretee"; campagne: UpworkCampagne }
  | {
      cle: "en_cours";
      campagne: UpworkCampagne;
      prochaine: TypeAction | null;
      attenteAdmin: number;
    };

export function campagneDuPays(
  campagnes: UpworkCampagne[],
  langue: string,
): UpworkCampagne | null {
  const vivante = campagnes.find((c) => c.langue === langue && vivace(c.statut));
  if (vivante) return vivante;
  return campagnes.find((c) => c.langue === langue) ?? null;
}

export function vivace(statut: UpworkCampagne["statut"]): boolean {
  return statut === "active" || statut === "en_pause";
}

export function candidatsDeCampagne(
  candidats: UpworkCandidat[],
  campagneId: string,
): UpworkCandidat[] {
  return candidats.filter((c) => c.campagne_id === campagneId);
}

export function etatCampagne(
  campagne: UpworkCampagne | null,
  actions: UpworkAction[],
  candidats: UpworkCandidat[],
): EtatCampagne {
  if (!campagne) return { cle: "absente" };
  if (campagne.statut === "terminee") return { cle: "terminee", campagne };
  if (campagne.statut === "arretee") return { cle: "arretee", campagne };

  const enAttente = actions.find(
    (a) => a.campagne_id === campagne.id && a.statut === "en_attente",
  );
  return {
    cle: "en_cours",
    campagne,
    prochaine: enAttente?.type ?? null,
    attenteAdmin: candidats.filter((c) => c.statut === "propose").length,
  };
}

/** Heures avant que le profil parte tout seul. Négatif = délai dépassé. */
export function heuresAvantAuto(echeanceIso: string, maintenant = Date.now()): number {
  const fin = new Date(echeanceIso).getTime();
  if (Number.isNaN(fin)) return 0;
  return (fin - maintenant) / 3_600_000;
}

export function triCandidats(candidats: UpworkCandidat[]): {
  aValider: UpworkCandidat[];
  decides: UpworkCandidat[];
} {
  const aValider = candidats
    .filter((c) => c.statut === "propose")
    .sort((a, b) => a.echeance_at.localeCompare(b.echeance_at));
  const decides = candidats
    .filter((c) => c.statut !== "propose")
    .sort((a, b) => (b.decide_at ?? "").localeCompare(a.decide_at ?? ""));
  return { aValider, decides };
}
