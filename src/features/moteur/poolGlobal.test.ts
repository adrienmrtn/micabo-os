import { describe, expect, it } from "vitest";

import {
  concentration,
  goulotPool,
  horsJeu,
  joursAutonomie,
  tirablesMaintenant,
  verdictPoolGlobal,
  type ComptagesPool,
} from "../../../supabase/functions/_shared/pool_global";

/** Le pool tel qu'il était le 16/09 au matin, avant les validations. */
const LE_16_SEPTEMBRE: ComptagesPool = {
  bibliotheque: 166,
  rejetes: 35,
  brouillons: 95,
  valides: 36,
  cyclesOuverts: 36,
  dusBPlus: 7,
  dusC: 5,
  passagesDus: 26,
  postsParJour: 40,
};

describe("tirablesMaintenant", () => {
  /**
   * Jusqu'au 25/09/2026, les 5 C du 16/09 étaient hors jeu et le tirage se
   * faisait sur 7 slideshows : c'est le « toujours les 4 ou 5 mêmes ». Depuis,
   * `PART_TIRAGE_C` leur réserve une part des créneaux, donc ils comptent.
   */
  it("compte les C dus avec les B+", () => {
    expect(tirablesMaintenant(LE_16_SEPTEMBRE)).toBe(12);
  });

  it("compte les C seuls quand le B+ est épuisé", () => {
    const c = { ...LE_16_SEPTEMBRE, dusBPlus: 0 };
    expect(tirablesMaintenant(c)).toBe(5);
  });

  it("rend 0 quand plus rien n'est dû", () => {
    expect(tirablesMaintenant({ ...LE_16_SEPTEMBRE, dusBPlus: 0, dusC: 0 })).toBe(0);
  });
});

describe("horsJeu", () => {
  it("compte les cycles pleins et les dormants", () => {
    // 36 cycles ouverts, 12 avec des passages dus → 24 hors jeu.
    expect(horsJeu(LE_16_SEPTEMBRE)).toBe(24);
  });

  it("ne descend jamais sous zéro", () => {
    expect(horsJeu({ ...LE_16_SEPTEMBRE, cyclesOuverts: 2 })).toBe(0);
  });
});

describe("joursAutonomie / verdictPoolGlobal", () => {
  it("rapporte la réserve à la consommation", () => {
    // 26 passages dus pour 40 posts/jour : moins d'une journée.
    expect(joursAutonomie(LE_16_SEPTEMBRE)).toBeCloseTo(0.65, 2);
    expect(verdictPoolGlobal(LE_16_SEPTEMBRE)).toBe("critique");
  });

  it("classe tendu entre 1 et 3 jours", () => {
    expect(verdictPoolGlobal({ ...LE_16_SEPTEMBRE, passagesDus: 80 })).toBe("tendu");
  });

  it("classe confortable au-delà de 3 jours", () => {
    expect(verdictPoolGlobal({ ...LE_16_SEPTEMBRE, passagesDus: 200 })).toBe("confortable");
  });

  it("ne divise pas par zéro quand personne ne poste", () => {
    const c = { ...LE_16_SEPTEMBRE, postsParJour: 0 };
    expect(joursAutonomie(c)).toBeNull();
    expect(verdictPoolGlobal(c)).toBe("confortable");
  });
});

describe("concentration", () => {
  it("vaut 1 quand un seul slideshow prend tout", () => {
    expect(concentration([10], 5)).toBe(1);
  });

  it("mesure la part du top 5", () => {
    // 5 gros à 10, 10 petits à 1 → 50 / 60.
    const passages = [...Array(5).fill(10), ...Array(10).fill(1)];
    expect(concentration(passages, 5)).toBeCloseTo(50 / 60, 3);
  });

  it("rend 0 sur une fenêtre sans passage", () => {
    expect(concentration([], 5)).toBe(0);
    expect(concentration([0, 0], 5)).toBe(0);
  });

  it("tient si on demande plus de têtes qu'il n'y a de slideshows", () => {
    expect(concentration([3, 2], 5)).toBe(1);
  });
});

describe("goulotPool", () => {
  it("désigne la file de validation quand elle dépasse le pool", () => {
    expect(goulotPool(LE_16_SEPTEMBRE)).toMatch(/file de validation/);
  });

  it("désigne le pool porté par du C quand la validation est à jour", () => {
    // Pool validé large, 30 C dus contre 3 B+ : ils sortent désormais, sur la
    // part qui leur est réservée. Ce n'est plus un verrou, c'est un mélange de
    // tiers à signaler.
    const c = { ...LE_16_SEPTEMBRE, brouillons: 2, valides: 60, dusBPlus: 3, dusC: 30 };
    expect(goulotPool(c)).toMatch(/30 % des tirages/);
  });

  it("signale le pool à sec avant tout le reste", () => {
    const c = { ...LE_16_SEPTEMBRE, dusBPlus: 0, dusC: 0 };
    expect(goulotPool(c)).toMatch(/repêchage/);
  });

  it("signale une bibliothèque sans aucun validé", () => {
    expect(goulotPool({ ...LE_16_SEPTEMBRE, valides: 0 })).toMatch(/Aucun slideshow validé/);
  });
});
