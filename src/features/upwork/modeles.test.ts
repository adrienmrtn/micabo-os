import { describe, expect, it } from "vitest";
import {
  MODELE_FRANCE,
  MODELE_GENERIQUE,
  type UpworkModele,
  composerMessage,
  contexteDepuisApproche,
  langueMessage,
  manquesPour,
  messageEnvoyable,
  modelePour,
  prenomDe,
  remplirModele,
} from "./modeles";
import type { UpworkApproche } from "./types";

function modele(p: Partial<UpworkModele> = {}): UpworkModele {
  return {
    id: crypto.randomUUID(),
    cle: "pourparlers",
    role_cible: "hm",
    langue: MODELE_GENERIQUE,
    corps: "Bonjour {{prenom}}",
    maj_at: "2026-09-01T00:00:00Z",
    ...p,
  };
}

describe("prenomDe", () => {
  it("prend le premier mot", () => {
    expect(prenomDe("Rose Vasquez")).toBe("Rose");
    expect(prenomDe("  Sara   Benamer ")).toBe("Sara");
  });

  it("supporte un nom en un seul mot", () => {
    expect(prenomDe("Adrien")).toBe("Adrien");
  });
});

describe("langueMessage", () => {
  it("n'est français que pour la France", () => {
    expect(langueMessage("fr")).toBe("fr");
    expect(langueMessage("es")).toBe("en");
    expect(langueMessage("de")).toBe("en");
    expect(langueMessage(null)).toBe("en");
  });
});

describe("modelePour", () => {
  const anglais = modele({ corps: "english" });
  const francais = modele({ langue: MODELE_FRANCE, corps: "français" });
  const espagnol = modele({ langue: "es", corps: "español" });
  const modeles = [anglais, francais, espagnol];

  it("prend le français pour la France", () => {
    expect(modelePour(modeles, "pourparlers", "hm", "fr")?.corps).toBe("français");
  });

  it("prend l'anglais pour tout autre pays, même s'il existe un modèle local", () => {
    expect(modelePour(modeles, "pourparlers", "hm", "es")?.corps).toBe("english");
    expect(modelePour(modeles, "pourparlers", "hm", "de")?.corps).toBe("english");
  });

  it("ne mélange pas les rôles", () => {
    expect(modelePour(modeles, "pourparlers", "createur", "es")).toBeNull();
  });

  it("rend null plutôt que d'inventer un texte", () => {
    expect(modelePour(modeles, "warmup", "hm", "es")).toBeNull();
  });
});

describe("remplirModele", () => {
  it("remplace les variables connues", () => {
    const { texte, manquantes } = remplirModele("Bonjour {{prenom}}, sur {{pays}}.", {
      prenom: "Rose",
      pays: "Espagne",
    });
    expect(texte).toBe("Bonjour Rose, sur Espagne.");
    expect(manquantes).toEqual([]);
  });

  it("tolère les espaces dans les accolades", () => {
    expect(remplirModele("{{ prenom }}", { prenom: "Rose" }).texte).toBe("Rose");
  });

  it("laisse la variable visible et la signale quand elle manque", () => {
    const { texte, manquantes } = remplirModele("Bonjour {{prenom}} de {{pays}}", {
      prenom: "Rose",
      pays: null,
    });
    expect(texte).toBe("Bonjour Rose de {{pays}}");
    expect(manquantes).toEqual(["pays"]);
  });

  it("traite une valeur vide comme manquante", () => {
    expect(remplirModele("{{hm_prenom}}", { hm_prenom: "   " }).manquantes).toEqual([
      "hm_prenom",
    ]);
  });

  it("ne signale qu'une fois une variable répétée", () => {
    expect(remplirModele("{{pays}} et {{pays}}", {}).manquantes).toEqual(["pays"]);
  });
});

describe("messageEnvoyable", () => {
  it("refuse un texte vide, incomplet, ou trop long pour Upwork", () => {
    expect(messageEnvoyable("Bonjour Rose", [])).toBe(true);
    expect(messageEnvoyable("   ", [])).toBe(false);
    expect(messageEnvoyable("Bonjour {{pays}}", ["pays"])).toBe(false);
    expect(messageEnvoyable("x".repeat(10_001), [])).toBe(false);
  });
});

function approche(over: Partial<UpworkApproche> = {}): UpworkApproche {
  return {
    id: "a1",
    job_posting_id: "job",
    contract_id: null,
    upwork_proposal_id: "p1",
    upwork_freelancer_id: "1",
    upwork_profile_url: null,
    photo_url: null,
    nom: "Sofia Jimenez",
    role: "hm",
    statut: "messaged",
    resume_discussions: "Intéressée. Demande comment on démarre.",
    offre_finalize_url: null,
    contrat_envoye_ok: false,
    contrat_signe_ok: false,
    slack_envoye_ok: false,
    email_demande_ok: false,
    codes_ok: false,
    os_ok: false,
    slack_ok: false,
    upwork_ajoute_ok: false,
    job_createur_id: null,
    profile_id: null,
    tiktok_cree_ok: false,
    tiktok_handle: null,
    warmup_actif: false,
    premier_post_ok: false,
    synced_at: "2026-09-06T00:00:00Z",
    ...over,
  };
}

describe("manquesPour", () => {
  it("ne liste que ce qui manque vraiment à cette personne", () => {
    const rose = approche({
      nom: "Rose Vasquez",
      statut: "hired",
      slack_envoye_ok: false,
      email_demande_ok: true,
      codes_ok: true,
      os_ok: false,
      slack_ok: false,
      upwork_ajoute_ok: true,
    });
    expect(manquesPour(rose, "acces_envoyes", "fr")).toEqual(["t'envoyer l'invitation Slack"]);
    expect(manquesPour(rose, "integration", "fr")).toEqual([
      "que tu te connectes à l'OS",
      "que tu rejoignes Slack",
    ]);
    expect(manquesPour(rose, "acces_envoyes", "es")).toEqual(["send you the Slack invite"]);
  });
});

describe("composerMessage", () => {
  it("répond en anglais hors France", () => {
    const sofia = approche();
    const ctx = contexteDepuisApproche(sofia, {
      pays: "Spain",
      etape: "pourparlers",
      langue: "es",
    });
    const { texte, manquantes } = composerMessage("Three questions to move forward.", ctx);
    expect(manquantes).toEqual([]);
    expect(texte).toContain("Hi Sofia,");
    expect(texte).toContain("Noted: Intéressée. Demande comment on démarre.");
    expect(texte).toContain("Three questions to move forward.");
    expect(texte).not.toContain("Bonjour");
    expect(texte).toMatch(/Adrien$/);
  });

  it("reste en français pour la France", () => {
    const rose = approche({
      nom: "Rose Vasquez",
      resume_discussions: "Dispo tout de suite.",
      slack_envoye_ok: false,
      email_demande_ok: true,
      codes_ok: true,
    });
    const ctx = contexteDepuisApproche(rose, {
      pays: "France",
      etape: "acces_envoyes",
      langue: "fr",
    });
    const { texte } = composerMessage(
      "Bonjour {{prenom}}, tes accès micabo pour {{pays}} arrivent.",
      ctx,
    );
    expect(texte).toBe(
      [
        "Bonjour Rose,",
        "",
        "J'ai bien noté : Dispo tout de suite.",
        "",
        "tes accès micabo pour France arrivent.",
        "",
        "Il reste :",
        "- t'envoyer l'invitation Slack",
        "",
        "Adrien",
      ].join("\n"),
    );
  });
});
