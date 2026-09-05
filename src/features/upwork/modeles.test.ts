import { describe, expect, it } from "vitest";
import {
  MODELE_GENERIQUE,
  type UpworkModele,
  messageEnvoyable,
  modelePour,
  prenomDe,
  remplirModele,
} from "./modeles";

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

describe("modelePour", () => {
  const generique = modele({ corps: "générique" });
  const espagnol = modele({ langue: "es", corps: "español" });
  const modeles = [generique, espagnol];

  it("préfère le modèle du pays", () => {
    expect(modelePour(modeles, "pourparlers", "hm", "es")?.corps).toBe("español");
  });

  it("retombe sur le générique quand le pays n'a pas le sien", () => {
    expect(modelePour(modeles, "pourparlers", "hm", "de")?.corps).toBe("générique");
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
