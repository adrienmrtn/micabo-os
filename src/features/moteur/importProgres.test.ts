import { describe, expect, it } from "vitest";

import { decisionPas, MAX_PAS_STERILES, pasAAvance } from "./importProgres";

describe("pasAAvance", () => {
  it("croit un pas qui change d'étape", () => {
    expect(pasAAvance("pertinence", { etape: "elo", progres: true })).toBe(true);
  });

  // Le défaut du 22/09/2026, celui qui a coûté des heures d'import : un pas se
  // déclarait productif en laissant l'étape sur place. Le compteur d'essais
  // repartait à zéro à chaque tour, la ligne était relâchée `pending` avec un
  // bail nul, re-réclamée aussitôt, et son compteur à 0 la gardait en tête du
  // tri de `claimContenu`. Boucle invisible : aucun log, aucun progrès.
  it("ne croit PAS un pas qui se déclare productif sans changer d'étape", () => {
    expect(pasAAvance("format", { etape: "format", progres: true })).toBe(false);
  });

  it("ne crédite pas un pas honnêtement improductif, même si l'étape diffère", () => {
    expect(pasAAvance("elo", { etape: "nettoyage", progres: false })).toBe(false);
  });

  it("traite une étape absente comme la chaîne vide", () => {
    expect(pasAAvance(null, { etape: "ocr", progres: true })).toBe(true);
    expect(pasAAvance(undefined, { etape: "", progres: true })).toBe(false);
  });
});

describe("decisionPas", () => {
  it("remet le compteur à zéro dès qu'un pas avance", () => {
    expect(decisionPas(4, true)).toEqual({ steriles: 0, sortDeLaFile: false });
  });

  it("incrémente sur un pas stérile sans sortir de la file trop tôt", () => {
    expect(decisionPas(0, false)).toEqual({ steriles: 1, sortDeLaFile: false });
    expect(decisionPas(3, false)).toEqual({ steriles: 4, sortDeLaFile: false });
  });

  it("sort la ligne de la file au plafond", () => {
    expect(decisionPas(MAX_PAS_STERILES - 1, false)).toEqual({
      steriles: MAX_PAS_STERILES,
      sortDeLaFile: true,
    });
  });

  // Une ligne lente mais qui progresse ne doit JAMAIS sortir de la file : sans
  // la remise à zéro, un slideshow à beaucoup de slides finirait par être
  // écarté alors qu'il travaille.
  it("ne sort jamais une ligne qui alterne progrès et pas stériles", () => {
    let tentatives = 0;
    for (let i = 0; i < 20; i += 1) {
      const avance = i % 2 === 0;
      const d = decisionPas(tentatives, avance);
      expect(d.sortDeLaFile).toBe(false);
      tentatives = d.steriles;
    }
  });

  it("tolère un compteur absurde en base", () => {
    expect(decisionPas(-3, false).steriles).toBe(1);
    expect(decisionPas(2.7, false).steriles).toBe(3);
  });

  // Le plafond doit rester au-dessus de 1 : à 1, le premier pas lent d'une
  // étape multi-passes (le nettoyage traite une slide par pas) sortirait la
  // ligne de la file.
  it("garde une marge pour les étapes multi-passes", () => {
    expect(MAX_PAS_STERILES).toBeGreaterThan(1);
  });
});
