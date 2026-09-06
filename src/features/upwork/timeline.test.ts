import { describe, expect, it } from "vitest";

import {
  OBJECTIF_CREATEURS,
  avancement,
  etapeCouranteTimeline,
  faitsDepuisApproche,
  nettoyerResume,
  phase1Terminee,
  phase2Terminee,
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
  tiktok_cree_ok: false,
  tiktok_handle: null,
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
      "acces_envoyes",
      "integration",
      "job_createur_poste",
    ]);
    expect(etapes.find((e) => e.cle === "contacte")?.ok).toBe(true);
    expect(etapes.find((e) => e.cle === "pourparlers")?.resume).toContain("10 min");
    expect(etapeCouranteTimeline(etapes)).toBe("contrat_envoye");
  });

  it("n’ouvre l’intégration qu’après Slack + email + codes, puis la checklist", () => {
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
    const acces = etapes.find((e) => e.cle === "acces_envoyes");
    expect(acces?.ok).toBe(true);
    expect(acces?.source).toBe("admin");
    expect(acces?.cochable).toBe(true);
    expect(etapes.find((e) => e.cle === "integration")?.ok).toBe(false);
    expect(etapes.find((e) => e.cle === "integration")?.checks).toEqual([
      { cle: "os", ok: true, source: "os" },
      { cle: "slack", ok: false, source: "slack" },
      // Seule case dont l'admin est la source : elle se clique.
      { cle: "upwork", ok: true, source: "admin", cochable: true },
    ]);
    expect(etapeCouranteTimeline(etapes)).toBe("integration");
  });

  it("dit d’où vient chaque case : OS, Slack ou coche admin", () => {
    const checks = timelineHm(base).find((e) => e.cle === "integration")?.checks ?? [];
    expect(checks.map((c) => c.source)).toEqual(["os", "slack", "admin"]);
  });
});

describe("timelineCreateur", () => {
  const embauchee = {
    ...base,
    role: "createur" as const,
    statut: "hired" as const,
    contrat_envoye_ok: true,
    contrat_signe_ok: true,
    slack_envoye_ok: true,
    codes_ok: true,
    os_ok: true,
    slack_ok: true,
  };

  it("intercale le compte TikTok entre l’intégration et le warmup", () => {
    const etapes = timelineCreateur(embauchee);
    expect(etapes.map((e) => e.cle)).toEqual([
      "contacte",
      "pourparlers",
      "contrat_signe",
      "integration",
      "tiktok_cree",
      "warmup",
      "premier_post",
    ]);
    expect(etapes.find((e) => e.cle === "integration")?.checks?.map((c) => c.cle)).toEqual([
      "os",
      "slack",
    ]);
    expect(etapeCouranteTimeline(etapes)).toBe("tiktok_cree");
  });

  it("bloque le warmup tant que le compte TikTok n’existe pas dans l’OS", () => {
    const sansTikTok = timelineCreateur({ ...embauchee, warmup_actif: true });
    expect(sansTikTok.find((e) => e.cle === "tiktok_cree")?.ok).toBe(false);
    expect(etapeCouranteTimeline(sansTikTok)).toBe("tiktok_cree");

    const avecTikTok = timelineCreateur({
      ...embauchee,
      tiktok_cree_ok: true,
      tiktok_handle: "manon.examen872",
      warmup_actif: true,
    });
    const tiktok = avecTikTok.find((e) => e.cle === "tiktok_cree");
    expect(tiktok?.ok).toBe(true);
    expect(tiktok?.source).toBe("os");
    expect(tiktok?.detail).toBe("@manon.examen872");
    expect(etapeCouranteTimeline(avecTikTok)).toBe("premier_post");
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

describe("phases HM", () => {
  it("ouvre les phases 2 et 3 seulement après le job créateurs", () => {
    expect(phase1Terminee(base)).toBe(false);
    expect(phase1Terminee({ ...base, job_createur_poste: true })).toBe(true);
    expect(phase2Terminee(0)).toBe(false);
    expect(phase2Terminee(OBJECTIF_CREATEURS)).toBe(true);
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

describe("avancement", () => {
  it("compte les étapes franchies pour l’aperçu replié", () => {
    expect(avancement(timelineHm(base))).toEqual({ faites: 2, total: 7 });
  });
});
