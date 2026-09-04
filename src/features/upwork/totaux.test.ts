import { describe, expect, it } from "vitest";

import { contratActif, missionOuverte, missionsFiltrees, totauxUpwork } from "./totaux";
import type { UpworkAlerte, UpworkContrat, UpworkMission } from "./types";

function mission(over: Partial<UpworkMission> & Pick<UpworkMission, "id">): UpworkMission {
  return {
    job_posting_id: over.id,
    titre: "Hiring Manager",
    famille: "hm",
    statut: "PUBLISHED",
    type: "HOURLY",
    created_time: null,
    applicants: 0,
    new_applicants: 0,
    shortlisted: 0,
    messaged: 0,
    offered: 0,
    hired: 0,
    pending_invitations: 0,
    job_url: null,
    synced_at: "2026-09-04T00:00:00Z",
    ...over,
  };
}

describe("totauxUpwork", () => {
  it("ne compte que les missions PUBLISHED et les L2", () => {
    const missions = [
      mission({ id: "1", new_applicants: 4, famille: "hm" }),
      mission({ id: "2", new_applicants: 6, famille: "createur" }),
      mission({ id: "3", statut: "FILLED", new_applicants: 10, famille: "hm" }),
    ];
    const contrats: UpworkContrat[] = [
      {
        id: "c1",
        contract_id: "1",
        titre: "HM",
        statut: "Active",
        freelancer_nom: "Marta",
        freelancer_id: null,
        hourly_rate: null,
        start_date: null,
        profile_id: null,
        room_id: null,
        last_message_at: null,
        synced_at: "2026-09-04T00:00:00Z",
      },
    ];
    const alertes: UpworkAlerte[] = [
      {
        id: "a1",
        compte_id: "x",
        poster_id: null,
        nom: "Léa",
        handle: "lea",
        niveau: "l2",
        jours_sans_post: 3,
        manager_id: null,
        manager_nom: "Marta",
        contract_id: null,
        synced_at: "2026-09-04T00:00:00Z",
      },
      {
        id: "a2",
        compte_id: "y",
        poster_id: null,
        nom: "Noa",
        handle: null,
        niveau: "l1",
        jours_sans_post: 1,
        manager_id: null,
        manager_nom: null,
        contract_id: null,
        synced_at: "2026-09-04T00:00:00Z",
      },
    ];
    expect(totauxUpwork(missions, contrats, alertes)).toEqual({
      missionsOuvertes: 2,
      missionsHmOuvertes: 1,
      newApplicants: 10,
      contratsActifs: 1,
      alertesL2: 1,
      alertesL1: 1,
    });
  });
});

describe("filtres", () => {
  it("filtre famille et ouvertes", () => {
    const missions = [
      mission({ id: "1", famille: "hm" }),
      mission({ id: "2", famille: "createur" }),
      mission({ id: "3", famille: "hm", statut: "CANCELLED" }),
    ];
    expect(missionsFiltrees(missions, "hm", true).map((m) => m.id)).toEqual(["1"]);
    expect(missionsFiltrees(missions, "toutes", false)).toHaveLength(3);
  });

  it("reconnaît PUBLISHED / Active", () => {
    expect(missionOuverte("PUBLISHED")).toBe(true);
    expect(missionOuverte("filled")).toBe(false);
    expect(contratActif("Active")).toBe(true);
    expect(contratActif("CLOSED")).toBe(false);
  });
});
