import { describe, expect, it } from "vitest";

import { marchesDepuisDashboard, titreMetierHm, titreMetierJobHm } from "./marche";
import type { UpworkAlerte, UpworkContrat, UpworkMission } from "./types";

function job(over: Partial<UpworkMission> & Pick<UpworkMission, "id" | "famille" | "langue">): UpworkMission {
  return {
    job_posting_id: over.id,
    titre: over.famille === "hm" ? "Hiring Manager" : "TikTok Slideshow",
    statut: "PUBLISHED",
    type: "HOURLY",
    created_time: "2026-09-02T00:00:00Z",
    applicants: 0,
    new_applicants: 0,
    shortlisted: 0,
    messaged: 0,
    offered: 0,
    hired: 0,
    pending_invitations: 0,
    invites_sent: 0,
    description: null,
    job_url: null,
    synced_at: "2026-09-04T00:00:00Z",
    ...over,
  };
}

function contrat(over: Partial<UpworkContrat> & Pick<UpworkContrat, "id">): UpworkContrat {
  return {
    contract_id: over.id,
    titre: "HM",
    statut: "ACTIVE",
    freelancer_nom: "Marta",
    freelancer_id: null,
    hourly_rate: 9,
    start_date: "2026-09-04",
    profile_id: "p-marta",
    room_id: null,
    last_message_at: null,
    langue: "es",
    job_posting_id: "job-es",
    slack_ok: false,
    slack_user_id: null,
    slack_at: null,
    codes_at: null,
    os_connecte_at: null,
    createurs_n: 0,
    contrat_at: "2026-09-04T08:00:00Z",
    synced_at: "2026-09-04T00:00:00Z",
    ...over,
  };
}

describe("marchesDepuisDashboard", () => {
  it("sépare job HM, HM, job créateurs et créateurs par pays", () => {
    const missions: UpworkMission[] = [
      job({ id: "job-es", famille: "hm", langue: "es", hired: 1 }),
      job({ id: "job-de", famille: "hm", langue: "de", hired: 0, invites_sent: 6 }),
      job({ id: "job-tr-crea", famille: "createur", langue: "tr" }),
      job({ id: "old", famille: "hm", langue: "fr", statut: "CANCELLED" }),
    ];
    const contrats: UpworkContrat[] = [contrat({ id: "c-es" })];
    const alertes: UpworkAlerte[] = [
      {
        id: "a1",
        compte_id: "x",
        poster_id: null,
        nom: "Léa",
        handle: "lea",
        niveau: "l2",
        jours_sans_post: 3,
        manager_id: "p-marta",
        manager_nom: "Marta",
        contract_id: null,
        synced_at: "2026-09-04T00:00:00Z",
      },
    ];

    const marches = marchesDepuisDashboard(missions, contrats, alertes);
    expect(marches.map((m) => m.langue)).toEqual(["de", "es", "tr"]);

    const de = marches.find((m) => m.langue === "de")!;
    expect(de.hm).toBeNull();
    expect(de.jobHm?.hired).toBe(0);
    expect(de.createurs).toHaveLength(0);

    const es = marches.find((m) => m.langue === "es")!;
    expect(es.hm?.freelancer_nom).toBe("Marta");
    expect(es.jobHm?.job_posting_id).toBe("job-es");
    expect(es.jobsCreateurs).toHaveLength(0);
    expect(es.createurs.map((c) => c.nom)).toEqual(["Léa"]);

    const tr = marches.find((m) => m.langue === "tr")!;
    expect(tr.jobsCreateurs).toHaveLength(1);
    expect(tr.hm).toBeNull();
    expect(tr.jobHm).toBeNull();
  });
});

describe("titres métier", () => {
  it("n’utilise pas le titre Upwork brut", () => {
    expect(titreMetierHm("Marta Figueroa", "es", "fr")).toBe("HM Espagne — Marta Figueroa");
    expect(titreMetierJobHm("de", "fr")).toBe("Job : recruter un HM Allemagne");
  });
});
