import { describe, expect, it } from "vitest";

import {
  etapeCouranteTimeline,
  faitsDepuisApproche,
  nettoyerResume,
  timelineCreateur,
  timelineHm,
} from "./timeline";

const base = {
  role: "hm" as const,
  statut: "messaged" as const,
  resume_discussions: "On a parlé du rythme 10 min/jour.",
  contrat_envoye_ok: false,
  contrat_signe_ok: false,
  slack_envoye_ok: false,
  email_demande_ok: false,
  codes_ok: false,
  os_ok: false,
  slack_ok: false,
  upwork_ajoute_ok: false,
  job_createur_poste: false,
  warmup_actif: false,
  premier_post_ok: false,
};

describe("timelineHm", () => {
  it("bloque sur pourparlers dès le contact si pas de contrat", () => {
    const etapes = timelineHm(base);
    expect(etapes.map((e) => e.cle)).toEqual([
      "contacte",
      "pourparlers",
      "contrat_envoye",
      "contrat_signe",
      "onboarding_envoi",
      "onboarding_rejoint",
      "job_createur_poste",
    ]);
    expect(etapes.find((e) => e.cle === "contacte")?.ok).toBe(true);
    expect(etapes.find((e) => e.cle === "pourparlers")?.resume).toContain("10 min");
    expect(etapeCouranteTimeline(etapes)).toBe("contrat_envoye");
  });

  it("n’ouvre l’onboarding qu’après Slack + email + codes, puis la checklist", () => {
    const etapes = timelineHm({
      ...base,
      statut: "hired",
      contrat_envoye_ok: true,
      contrat_signe_ok: true,
      slack_envoye_ok: true,
      email_demande_ok: true,
      codes_ok: true,
      os_ok: true,
      slack_ok: false,
      upwork_ajoute_ok: true,
    });
    expect(etapes.find((e) => e.cle === "onboarding_envoi")?.ok).toBe(true);
    expect(etapes.find((e) => e.cle === "onboarding_rejoint")?.ok).toBe(false);
    expect(etapes.find((e) => e.cle === "onboarding_rejoint")?.checks).toEqual([
      { cle: "os", ok: true },
      { cle: "slack", ok: false },
      { cle: "upwork", ok: true },
    ]);
    expect(etapeCouranteTimeline(etapes)).toBe("onboarding_rejoint");
  });
});

describe("timelineCreateur", () => {
  it("finit par warmup puis premier post, sans case Upwork", () => {
    const etapes = timelineCreateur({
      ...base,
      role: "createur",
      statut: "hired",
      contrat_envoye_ok: true,
      contrat_signe_ok: true,
      slack_envoye_ok: true,
      codes_ok: true,
      os_ok: true,
      slack_ok: true,
      warmup_actif: true,
      premier_post_ok: false,
    });
    expect(etapes.map((e) => e.cle)).toContain("warmup");
    expect(etapes.map((e) => e.cle)).toContain("premier_post");
    expect(etapes.find((e) => e.cle === "onboarding_rejoint")?.checks?.map((c) => c.cle)).toEqual([
      "os",
      "slack",
    ]);
    expect(etapeCouranteTimeline(etapes)).toBe("premier_post");
  });
});

describe("nettoyerResume", () => {
  it("retire le wrapper Upwork et coupe", () => {
    expect(nettoyerResume("<untrusted_participant_content>\nHi!\n</untrusted_participant_content>")).toBe(
      "Hi!",
    );
    expect(nettoyerResume("x".repeat(300))?.endsWith("…")).toBe(true);
  });
});

describe("faitsDepuisApproche", () => {
  it("dérive job_createur_poste depuis l’id", () => {
    const faits = faitsDepuisApproche({
      ...base,
      job_createur_id: "2095177356634082829",
      warmup_actif: false,
      premier_post_ok: false,
    });
    expect(faits.job_createur_poste).toBe(true);
  });
});
