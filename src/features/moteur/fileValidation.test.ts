import { describe, expect, it } from "vitest";

import {
  auDernierPlan,
  auPremierPlan,
  borner,
  deplacerSlide,
  estEnFile,
  etatFile,
  renumeroter,
  retirerSlide,
  slugFormat,
  triees,
  type CalquePng,
} from "./fileValidation";

const calque = (z: number, largeur = 0.5): CalquePng => ({
  blocId: `b${z}`,
  url: `u${z}`,
  x: 0,
  y: 0,
  largeur,
  z,
});

describe("etatFile", () => {
  it("ne met en file qu'un pipeline terminé et pas encore validé", () => {
    expect(etatFile({ statut: "brouillon", import_statut: "done" })).toBe("file");
    expect(etatFile({ statut: "brouillon", import_statut: "pending" })).toBe("import");
    expect(etatFile({ statut: "brouillon", import_statut: "running" })).toBe("import");
    expect(etatFile({ statut: "brouillon", import_statut: "failed" })).toBe("import");
  });

  it("sort de la file dès que l'admin a tranché", () => {
    expect(etatFile({ statut: "valide", import_statut: "done" })).toBe("valide");
    expect(etatFile({ statut: "rejete", import_statut: "done" })).toBe("rejete");
  });

  it("un rejet d'import ne repasse jamais par la file", () => {
    expect(estEnFile({ statut: "rejete", import_statut: "pending" })).toBe(false);
  });
});

describe("calques PNG", () => {
  it("garde un calque visible et jamais nul", () => {
    expect(borner({ ...calque(0), largeur: 0 }).largeur).toBe(0.02);
    expect(borner({ ...calque(0), largeur: 5 }).largeur).toBe(1);
    expect(borner({ ...calque(0), x: 9 }).x).toBeCloseTo(0.98);
  });

  it("remonte au premier plan sans trou dans les z", () => {
    const apres = auPremierPlan([calque(0), calque(1), calque(2)], 0);
    expect(apres.map((c) => c.blocId)).toEqual(["b1", "b2", "b0"]);
    expect(apres.map((c) => c.z)).toEqual([0, 1, 2]);
  });

  it("redescend au dernier plan", () => {
    const apres = auDernierPlan([calque(0), calque(1), calque(2)], 2);
    expect(apres.map((c) => c.blocId)).toEqual(["b2", "b0", "b1"]);
    expect(apres.map((c) => c.z)).toEqual([0, 1, 2]);
  });
});

describe("slides", () => {
  it("renumérote 1..n dans l'ordre du tableau, pas celui des positions", () => {
    expect(renumeroter([{ position: 5 }, { position: 2 }, { position: 9 }])).toEqual([
      { position: 1 },
      { position: 2 },
      { position: 3 },
    ]);
    // L'ordre reçu est conservé : c'est ce qui permet à deplacerSlide de tenir.
    const desordre = [{ position: 9, id: "c" }, { position: 2, id: "a" }];
    expect(renumeroter(desordre).map((s) => s.id)).toEqual(["c", "a"]);
    expect(triees(desordre).map((s) => s.id)).toEqual(["a", "c"]);
  });

  it("retire une slide et referme le trou", () => {
    const slides = [
      { position: 1, id: "a" },
      { position: 2, id: "b" },
      { position: 3, id: "c" },
    ];
    expect(retirerSlide(slides, 2)).toEqual([
      { position: 1, id: "a" },
      { position: 2, id: "c" },
    ]);
  });

  it("déplace une slide d'un cran", () => {
    const slides = [{ position: 1, id: "a" }, { position: 2, id: "b" }, { position: 3, id: "c" }];
    expect(deplacerSlide(slides, 2, -1).map((s) => s.id)).toEqual(["b", "a", "c"]);
    expect(deplacerSlide(slides, 2, 1).map((s) => s.id)).toEqual(["a", "c", "b"]);
  });

  it("ne déplace pas hors des bornes", () => {
    const slides = [{ position: 1, id: "a" }, { position: 2, id: "b" }];
    expect(deplacerSlide(slides, 1, -1)).toBe(slides);
    expect(deplacerSlide(slides, 2, 1)).toBe(slides);
  });
});

describe("slugFormat", () => {
  it("normalise accents et séparateurs", () => {
    expect(slugFormat("Récit à la 1ʳᵉ personne")).toBe("recit-a-la-1-personne");
    expect(slugFormat("   ")).toBe("format");
  });
});
