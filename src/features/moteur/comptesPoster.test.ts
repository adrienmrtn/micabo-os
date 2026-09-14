import { describe, expect, it } from "vitest";

import { comptePrincipal, lireCompteActif, premierCompteDemande } from "./comptesPoster";

describe("comptesPoster", () => {
  it("prend le premier compte comme principal", () => {
    expect(comptePrincipal([{ id: "a" }, { id: "b" }])?.id).toBe("a");
    expect(comptePrincipal([])).toBeUndefined();
  });

  it("ne rend pas un compte actif absent de la liste", () => {
    expect(lireCompteActif("u1", [])).toBeNull();
  });

  it("ne crée un compte que si on le demande et qu'une langue est fournie", () => {
    expect(premierCompteDemande(true, "fr")).toBe("perso");
    expect(premierCompteDemande(undefined, "fr")).toBe("perso");
    expect(premierCompteDemande(true, "  ")).toBe("aucun");
    expect(premierCompteDemande(false, "fr")).toBe("aucun");
  });
});
