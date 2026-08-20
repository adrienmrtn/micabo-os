import { describe, expect, it } from "vitest";

import {
  comptePerso,
  comptePrincipal,
  comptesCm,
  estCompteCm,
  languesCmPrises,
  languesDisponiblesPourCm,
  languesPourNouveauCompte,
  normaliserTypeCompte,
  resoudrePremierCompte,
} from "./comptesCm";

const persoFr = { id: "a", type_compte: "perso" as const, langue: "fr" };
const cmDe = { id: "b", type_compte: "cm" as const, langue: "de" };
const cmEs = { id: "c", type_compte: "cm" as const, langue: "es" };

describe("type_compte", () => {
  it("normalise toute valeur inconnue en perso", () => {
    expect(normaliserTypeCompte(undefined)).toBe("perso");
    expect(normaliserTypeCompte("cm")).toBe("cm");
    expect(normaliserTypeCompte("autre")).toBe("perso");
  });

  it("détecte un compte CM", () => {
    expect(estCompteCm(cmDe)).toBe(true);
    expect(estCompteCm(persoFr)).toBe(false);
    expect(estCompteCm({})).toBe(false);
  });

  it("à la création, un poster n'implique pas un perso", () => {
    expect(resoudrePremierCompte(undefined, "fr")).toBe("perso");
    expect(resoudrePremierCompte("perso", "fr")).toBe("perso");
    expect(resoudrePremierCompte("cm", "de")).toBe("cm");
    expect(resoudrePremierCompte("aucun", "fr")).toBe("aucun");
    expect(resoudrePremierCompte("none", "en")).toBe("aucun");
    expect(resoudrePremierCompte("cm", "")).toBe("aucun");
    expect(resoudrePremierCompte(undefined, "")).toBe("aucun");
  });
});

describe("sélection de comptes", () => {
  it("sépare perso et CM, et choisit le perso comme principal", () => {
    const tous = [cmDe, persoFr, cmEs];
    expect(comptePerso(tous)?.id).toBe("a");
    expect(comptesCm(tous).map((c) => c.id)).toEqual(["b", "c"]);
    expect(comptePrincipal(tous)?.id).toBe("a");
  });

  it("si seulement des CM, le principal est le premier", () => {
    expect(comptePrincipal([cmDe, cmEs])?.id).toBe("b");
    expect(comptePerso([cmDe])).toBeUndefined();
  });
});

describe("langues CM", () => {
  it("liste les langues déjà prises et celles encore libres", () => {
    expect(languesCmPrises([persoFr, cmDe, cmEs])).toEqual(["de", "es"]);
    expect(languesDisponiblesPourCm(["fr", "de", "it"], ["de"])).toEqual(["fr", "it"]);
  });

  it("à l'ajout, un perso reste libre dans une langue déjà CM", () => {
    expect(languesPourNouveauCompte("perso", ["fr", "de"], ["de"])).toEqual(["fr", "de"]);
    expect(languesPourNouveauCompte("cm", ["fr", "de"], ["de"])).toEqual(["fr"]);
  });
});
