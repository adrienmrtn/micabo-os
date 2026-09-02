import { describe, expect, it } from "vitest";

import {
  estImportPipelineActif,
  peutForcerImportElo,
  statutApresPasImport,
} from "./importSlideshowActions";

describe("peutForcerImportElo", () => {
  it("autorise un rejeté", () => {
    expect(peutForcerImportElo({ statut: "rejete", import_etape: "elo_insuffisant" })).toBe(
      true,
    );
  });

  it("autorise un brouillon déjà sous seuil", () => {
    expect(
      peutForcerImportElo({ statut: "brouillon", import_etape: "elo_insuffisant" }),
    ).toBe(true);
  });

  it("refuse un valide ou un import en cours", () => {
    expect(peutForcerImportElo({ statut: "valide", import_etape: "done" })).toBe(false);
    expect(peutForcerImportElo({ statut: "brouillon", import_etape: "pertinence" })).toBe(
      false,
    );
  });
});

describe("estImportPipelineActif", () => {
  it("détecte un brouillon encore en file", () => {
    expect(
      estImportPipelineActif({ statut: "brouillon", import_statut: "running" }),
    ).toBe(true);
    expect(
      estImportPipelineActif({ statut: "brouillon", import_statut: "failed" }),
    ).toBe(true);
  });

  it("ignore les contenus déjà tranchés", () => {
    expect(estImportPipelineActif({ statut: "valide", import_statut: "done" })).toBe(false);
    expect(estImportPipelineActif({ statut: "rejete", import_statut: "done" })).toBe(false);
  });
});

describe("statutApresPasImport", () => {
  it("remet en file après un pas intermédiaire", () => {
    expect(statutApresPasImport("pertinence")).toBe("pending");
    expect(statutApresPasImport("ocr")).toBe("pending");
    expect(statutApresPasImport("nettoyage")).toBe("pending");
  });

  it("ne touche pas un pas terminal ou un échec", () => {
    expect(statutApresPasImport("done")).toBeNull();
    expect(statutApresPasImport("elo_insuffisant")).toBeNull();
    expect(statutApresPasImport("failed")).toBeNull();
  });
});
