import { describe, expect, it } from "vitest";

import { estLabelRetire } from "./mediaCaption";

/**
 * Un label retiré (0273) ne se propose plus dans l'éditeur de labels. Le
 * garde-fou qui compte vraiment est en base (trigger `compte_labels_pas_retire`),
 * celui-ci évite de montrer une case qui ne produirait rien.
 */
describe("label retiré", () => {
  it("reconnaît un label sorti de la circulation", () => {
    expect(estLabelRetire({ retire_le: "2026-09-24T16:00:00Z" })).toBe(true);
  });

  it("laisse passer un label en circulation", () => {
    expect(estLabelRetire({ retire_le: null })).toBe(false);
    expect(estLabelRetire({})).toBe(false);
    expect(estLabelRetire(null)).toBe(false);
    expect(estLabelRetire(undefined)).toBe(false);
  });
});
