import { describe, expect, it } from "vitest";

import type { LigneSurveillance, UpworkApproche } from "./types";
import {
  alerteSurveillance,
  createursPhase3,
  encoreEnRecrutement,
  moyenneEquipe,
  ratioPosts,
  vuesMoyennes,
} from "./surveillance";

const ligne = (p: Partial<LigneSurveillance> = {}): LigneSurveillance => ({
  compte_id: "c1",
  poster_id: "poster-1",
  manager_id: "hm-1",
  nom: "Manon Test",
  handle: "manon.examen872",
  posts_par_jour: 2,
  posts_10j: 16,
  prevus_10j: 20,
  vues_10: 8000,
  posts_mesures: 10,
  elo: 54,
  ...p,
});

const approche = (p: Partial<UpworkApproche> = {}): UpworkApproche =>
  ({
    id: "a1",
    job_posting_id: "job-cr",
    contract_id: null,
    upwork_proposal_id: "p1",
    upwork_freelancer_id: null,
    upwork_profile_url: null,
    photo_url: null,
    nom: "Manon Test",
    role: "createur",
    statut: "hired",
    resume_discussions: null,
    dernier_message: null,
    dernier_message_at: null,
    offre_finalize_url: null,
    contrat_envoye_ok: true,
    contrat_signe_ok: true,
    slack_envoye_ok: true,
    email_demande_ok: true,
    codes_ok: true,
    os_ok: true,
    slack_ok: true,
    upwork_ajoute_ok: false,
    job_createur_id: null,
    profile_id: "poster-1",
    tiktok_cree_ok: true,
    tiktok_handle: "manon.examen872",
    warmup_actif: true,
    premier_post_ok: true,
    synced_at: "2026-09-06T00:00:00Z",
    ...p,
  }) as UpworkApproche;

describe("alertes surveillance", () => {
  it("calcule le ratio et la moyenne de vues", () => {
    expect(ratioPosts({ posts_10j: 8, prevus_10j: 10 })).toBe(0.8);
    expect(vuesMoyennes({ vues_10: 4000, posts_mesures: 10 })).toBe(400);
    expect(vuesMoyennes({ vues_10: 0, posts_mesures: 0 })).toBe(0);
  });

  it("alerte si le rythme < 80 % ou les vues moy. < 500", () => {
    expect(alerteSurveillance(ligne())).toBe(false);
    expect(alerteSurveillance(ligne({ posts_10j: 15 }))).toBe(true);
    expect(alerteSurveillance(ligne({ vues_10: 4000 }))).toBe(true);
    expect(alerteSurveillance(ligne({ posts_10j: 20, vues_10: 5000 }))).toBe(false);
  });
});

describe("createursPhase3", () => {
  it("passe un créateur en phase 3 dès le premier post", () => {
    const liste = createursPhase3([approche()], [ligne()], "hm-1");
    expect(liste).toHaveLength(1);
    expect(liste[0]?.tiktokUrl).toBe("https://www.tiktok.com/@manon.examen872");
    expect(liste[0]?.posts_10j).toBe(16);
    expect(liste[0]?.elo).toBe(54);
  });

  it("prend aussi le compte OS du HM s’il a déjà posté, même sans flag Upwork", () => {
    const encoreWarmup = approche({ premier_post_ok: false });
    const liste = createursPhase3([encoreWarmup], [ligne()], "hm-1");
    expect(liste).toHaveLength(1);
    expect(liste[0]?.nom).toBe("Manon Test");
  });

  it("retire le créateur du recrutement une fois en phase 3", () => {
    const a = approche();
    const phase3 = createursPhase3([a], [ligne()], "hm-1");
    expect(encoreEnRecrutement(a, phase3)).toBe(false);
    expect(encoreEnRecrutement(approche({ premier_post_ok: false, profile_id: "autre" }), phase3)).toBe(
      true,
    );
  });
});

describe("moyenneEquipe", () => {
  it("somme les posts et les vues de l’équipe", () => {
    const equipe = createursPhase3(
      [approche(), approche({ id: "a2", profile_id: "poster-2", nom: "Léa" })],
      [ligne(), ligne({ compte_id: "c2", poster_id: "poster-2", posts_10j: 10, vues_10: 2000 })],
      "hm-1",
    );
    const moy = moyenneEquipe(equipe);
    expect(moy).toEqual({
      posts_10j: 26,
      prevus_10j: 40,
      vues_10: 10000,
      posts_mesures: 20,
    });
    expect(ratioPosts(moy!)).toBe(0.65);
    expect(vuesMoyennes(moy!)).toBe(500);
    expect(alerteSurveillance(moy!)).toBe(true);
    expect(alerteSurveillance({ ...moy!, posts_10j: 32, vues_10: 12000 })).toBe(false);
  });
});
