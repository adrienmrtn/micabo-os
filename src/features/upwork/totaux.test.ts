import { describe, expect, it } from "vitest";

import { contratActif, missionOuverte, missionsFiltrees, totauxUpwork } from "./totaux";
import type { UpworkContrat, UpworkMission } from "./types";

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
    langue: null,
    invites_sent: 0,
    description: null,
    synced_at: "2026-09-04T00:00:00Z",
    ...over,
  };
}

function contrat(over: Partial<UpworkContrat> & Pick<UpworkContrat, "id">): UpworkContrat {
  return {
    contract_id: over.id,
    titre: "HM",
    statut: "ACTIVE",
    freelancer_nom: "Sara",
    freelancer_id: null,
    hourly_rate: null,
    start_date: null,
    profile_id: null,
    room_id: null,
    last_message_at: null,
    langue: "fr",
    job_posting_id: null,
    slack_ok: false,
    slack_user_id: null,
    slack_at: null,
    codes_at: null,
    os_connecte_at: null,
    createurs_n: 0,
    contrat_at: null,
    synced_at: "2026-09-04T00:00:00Z",
    ...over,
  };
}

describe("totauxUpwork", () => {
  it("compte HM, créateurs et jobs ouverts, y compris par pays", () => {
    const missions = [
      mission({ id: "1", famille: "hm", langue: "fr", hired: 1 }),
      mission({ id: "2", famille: "createur", langue: "fr" }),
      mission({ id: "3", famille: "hm", langue: "de" }),
      mission({ id: "4", statut: "FILLED", famille: "hm", langue: "es" }),
    ];
    const contrats: UpworkContrat[] = [
      contrat({ id: "c1", langue: "fr", createurs_n: 2 }),
      contrat({ id: "c2", langue: "es", statut: "CLOSED", createurs_n: 9 }),
    ];
    expect(totauxUpwork(missions, contrats)).toEqual({
      hms: 1,
      createurs: 2,
      jobsHmOuverts: 2,
      jobsCreateursOuverts: 1,
      parPays: [
        { langue: "fr", hms: 1, createurs: 2, jobsHmOuverts: 1, jobsCreateursOuverts: 1 },
        { langue: "de", hms: 0, createurs: 0, jobsHmOuverts: 1, jobsCreateursOuverts: 0 },
      ],
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
    expect(missionsFiltrees(missions, "hm").map((m) => m.id)).toEqual(["1"]);
    expect(missionsFiltrees(missions, "toutes")).toHaveLength(2);
  });

  it("reconnaît PUBLISHED / Active", () => {
    expect(missionOuverte("PUBLISHED")).toBe(true);
    expect(missionOuverte("filled")).toBe(false);
    expect(contratActif("Active")).toBe(true);
    expect(contratActif("CLOSED")).toBe(false);
  });
});
