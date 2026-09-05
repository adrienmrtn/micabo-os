import { describe, expect, it } from "vitest";

import {
  campagneDuPays,
  etatCampagne,
  heuresAvantAuto,
  triCandidats,
} from "./campagne";
import type { UpworkAction, UpworkCampagne, UpworkCandidat } from "./types";

function campagne(over: Partial<UpworkCampagne> = {}): UpworkCampagne {
  return {
    id: "c1",
    langue: "de",
    pays_nom: "Allemagne",
    role_cible: "hm",
    statut: "active",
    job_posting_id: "job-de-hm",
    objectif_hm: 1,
    profils_par_passage: 10,
    delai_validation_h: 10,
    lance_at: "2026-09-05T09:00:00Z",
    job_publie_at: null,
    fin_at: null,
    detail: null,
    ...over,
  };
}

function candidat(over: Partial<UpworkCandidat> & { id: string }): UpworkCandidat {
  return {
    campagne_id: "c1",
    upwork_person_id: over.id,
    nom: over.id,
    titre_profil: null,
    photo_url: null,
    upwork_profile_url: null,
    pays: null,
    taux_horaire: null,
    job_success: null,
    pourquoi: null,
    statut: "propose",
    auto_valide: false,
    propose_at: "2026-09-05T09:05:00Z",
    echeance_at: "2026-09-05T19:05:00Z",
    decide_at: null,
    invite_at: null,
    ...over,
  };
}

function action(over: Partial<UpworkAction> = {}): UpworkAction {
  return {
    id: "a1",
    type: "sourcer_hm",
    campagne_id: "c1",
    upwork_proposal_id: null,
    cible_nom: "Allemagne",
    cible_role: "hm",
    langue: "de",
    prompt: "…",
    note: null,
    statut: "en_attente",
    demande_at: "2026-09-05T09:00:00Z",
    fait_at: null,
    resultat: null,
    ...over,
  };
}

describe("campagneDuPays", () => {
  it("préfère la campagne vivante à une campagne close du même pays", () => {
    const close = campagne({ id: "vieille", statut: "terminee" });
    const vivante = campagne({ id: "en_cours", statut: "active" });
    expect(campagneDuPays([close, vivante], "de")?.id).toBe("en_cours");
  });

  it("retombe sur la campagne close quand il n’y en a plus d’active", () => {
    const close = campagne({ id: "vieille", statut: "arretee" });
    expect(campagneDuPays([close], "de")?.id).toBe("vieille");
    expect(campagneDuPays([close], "it")).toBeNull();
  });
});

describe("etatCampagne", () => {
  it("annonce l’étape que l’agent fera au prochain passage", () => {
    const etat = etatCampagne(campagne(), [action({ type: "inviter_hm" })], []);
    expect(etat.cle).toBe("en_cours");
    if (etat.cle === "en_cours") expect(etat.prochaine).toBe("inviter_hm");
  });

  it("bascule sur l’attente admin quand plus rien n’est dans la file", () => {
    const etat = etatCampagne(campagne(), [], [candidat({ id: "x" }), candidat({ id: "y" })]);
    expect(etat.cle).toBe("en_cours");
    if (etat.cle === "en_cours") {
      expect(etat.prochaine).toBeNull();
      expect(etat.attenteAdmin).toBe(2);
    }
  });

  it("ignore les actions d’une autre campagne", () => {
    const etat = etatCampagne(campagne(), [action({ campagne_id: "autre" })], []);
    if (etat.cle === "en_cours") expect(etat.prochaine).toBeNull();
  });

  it("distingue terminée, arrêtée et absente", () => {
    expect(etatCampagne(null, [], []).cle).toBe("absente");
    expect(etatCampagne(campagne({ statut: "terminee" }), [], []).cle).toBe("terminee");
    expect(etatCampagne(campagne({ statut: "arretee" }), [], []).cle).toBe("arretee");
  });
});

describe("heuresAvantAuto", () => {
  it("compte les heures restantes avant l’invitation automatique", () => {
    const maintenant = Date.parse("2026-09-05T09:05:00Z");
    expect(heuresAvantAuto("2026-09-05T19:05:00Z", maintenant)).toBe(10);
    expect(heuresAvantAuto("2026-09-05T08:05:00Z", maintenant)).toBe(-1);
  });
});

describe("triCandidats", () => {
  it("met les plus urgents en premier et sort les décidés", () => {
    const { aValider, decides } = triCandidats([
      candidat({ id: "tard", echeance_at: "2026-09-05T23:00:00Z" }),
      candidat({ id: "tot", echeance_at: "2026-09-05T12:00:00Z" }),
      candidat({ id: "parti", statut: "invite", decide_at: "2026-09-05T10:00:00Z" }),
    ]);
    expect(aValider.map((c) => c.id)).toEqual(["tot", "tard"]);
    expect(decides.map((c) => c.id)).toEqual(["parti"]);
  });
});
