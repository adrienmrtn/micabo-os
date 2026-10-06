import { describe, expect, it } from "vitest";

import { CONTRASTE_MIN_SUR_BLANC, contrasteSurBlanc, couleurLabelLisible } from "./couleurLabel";

describe("couleurLabelLisible", () => {
  it("écarte le blanc du label white-post (blanc sur blanc)", () => {
    expect(couleurLabelLisible("#ffffff")).toBeNull();
    expect(couleurLabelLisible("#FFF")).toBeNull();
  });

  it("écarte les teintes trop pâles pour se lire sur du blanc", () => {
    expect(couleurLabelLisible("#fef9c3")).toBeNull(); // jaune très pâle
    expect(couleurLabelLisible("#f1f5f9")).toBeNull(); // gris très clair
  });

  it("garde les couleurs des labels en place", () => {
    expect(couleurLabelLisible("#734ad3")).toBe("#734ad3"); // classic_study
    expect(couleurLabelLisible("#f59e0b")).toBe("#f59e0b"); // Hook, ambre
    expect(couleurLabelLisible("#2f6f4e")).toBe("#2f6f4e"); // défaut du formulaire
  });

  it("rend null sans couleur, comme un label sans couleur", () => {
    expect(couleurLabelLisible(null)).toBeNull();
    expect(couleurLabelLisible(undefined)).toBeNull();
    expect(couleurLabelLisible("  ")).toBeNull();
  });

  it("laisse passer ce qu'il ne sait pas mesurer", () => {
    expect(couleurLabelLisible("rebeccapurple")).toBe("rebeccapurple");
  });

  it("mesure le contraste WCAG avec le blanc", () => {
    expect(contrasteSurBlanc("#ffffff")).toBeCloseTo(1, 5);
    expect(contrasteSurBlanc("#000000")).toBeCloseTo(21, 5);
    expect(contrasteSurBlanc("#f59e0b")!).toBeGreaterThan(CONTRASTE_MIN_SUR_BLANC);
    expect(contrasteSurBlanc("pas une couleur")).toBeNull();
  });
});
