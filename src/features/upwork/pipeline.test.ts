import { describe, expect, it } from "vitest";

import {
  etapeCourante,
  formatDureeHeures,
  pipelineHm,
  redigerBriefHm,
  redigerBriefMission,
} from "./pipeline";

describe("pipelineHm", () => {
  it("marque les étapes faites et calcule le délai contrat → codes", () => {
    const etapes = pipelineHm({
      nom: "Marta Figueroa",
      langue: "es",
      job_poste_at: "2026-09-02T15:18:10Z",
      invites_sent: 4,
      messaged: 2,
      contrat_at: "2026-09-04T08:33:35Z",
      slack_ok: false,
      slack_at: null,
      codes_at: "2026-09-04T08:57:30Z",
      os_connecte_at: null,
      createurs_n: 0,
    });
    expect(etapes.find((e) => e.cle === "contrat")?.fait).toBe(true);
    expect(etapes.find((e) => e.cle === "slack")?.fait).toBe(false);
    expect(etapes.find((e) => e.cle === "codes")?.fait).toBe(true);
    expect(etapes.find((e) => e.cle === "os")?.fait).toBe(false);
    expect(etapeCourante(etapes)).toBe("slack");
    expect(etapes.find((e) => e.cle === "createurs")?.fait).toBe(false);
  });

  it("bloque sur créateurs une fois Slack + OS OK", () => {
    const etapes = pipelineHm({
      nom: "Rana Barakli",
      langue: "tr",
      job_poste_at: "2026-09-02T15:18:09Z",
      invites_sent: 3,
      messaged: 2,
      contrat_at: "2026-09-03T14:01:58Z",
      slack_ok: true,
      slack_at: null,
      codes_at: "2026-09-03T14:57:26Z",
      os_connecte_at: "2026-09-03T15:45:12Z",
      createurs_n: 0,
    });
    expect(etapeCourante(etapes)).toBe("createurs");
    const codes = etapes.find((e) => e.cle === "codes");
    expect(codes?.heuresDepuisPrev).toBeGreaterThan(0);
    expect(codes?.heuresDepuisPrev).toBeLessThan(1);
  });
});

describe("briefs", () => {
  it("écrit un brief HM en français", () => {
    const texte = redigerBriefHm(
      {
        nom: "Marta Figueroa",
        langue: "es",
        job_poste_at: "2026-09-02T15:18:10Z",
        invites_sent: 4,
        messaged: 2,
        contrat_at: "2026-09-04T08:33:35Z",
        slack_ok: false,
        slack_at: null,
        codes_at: "2026-09-04T08:57:30Z",
        os_connecte_at: null,
        createurs_n: 0,
      },
      "fr",
    );
    expect(texte).toMatch(/Marta Figueroa/);
    expect(texte).toMatch(/pas sur Slack/);
    expect(texte).not.toMatch(/Faits :/);
  });

  it("écrit un brief mission", () => {
    const texte = redigerBriefMission(
      {
        created_time: "2026-09-02T15:18:03Z",
        applicants: 9,
        invites_sent: 6,
        messaged: 4,
        hired: 0,
        langue: "de",
        famille: "hm",
      },
      "fr",
    );
    expect(texte).toMatch(/HM/);
    expect(texte).toMatch(/6 invité/);
    expect(texte).toMatch(/personne embauchée/);
  });
});

describe("formatDureeHeures", () => {
  it("affiche heures puis jours", () => {
    expect(formatDureeHeures(3, "fr")).toBe("3 h");
    expect(formatDureeHeures(48, "fr")).toBe("2 j");
    expect(formatDureeHeures(30, "en")).toBe("1 d 6 h");
  });
});
