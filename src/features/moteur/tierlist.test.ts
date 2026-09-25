import { describe, expect, it } from "vitest";

import {
  passagesPourTier,
  TIERS,
  prioriserTiersHauts,
  PART_TIRAGE_C,
  requalifier,
  tierDepuisEloLegacy,
  tierImport,
  type Tier,
} from "./tierlist";

describe("passagesPourTier", () => {
  it("suit la grille D 0 → S+ 8 (divisée par deux le 17/09)", () => {
    expect(passagesPourTier("D")).toBe(0);
    expect(passagesPourTier("C")).toBe(1);
    expect(passagesPourTier("B")).toBe(1);
    expect(passagesPourTier("A")).toBe(2);
    expect(passagesPourTier("S")).toBe(4);
    expect(passagesPourTier("S+")).toBe(8);
  });

  it("ne décroît jamais quand le tier monte", () => {
    // B et C sont désormais à égalité (1) : c'est prioriserTiersHauts qui les
    // départage, plus le nombre de passages.
    const grille = TIERS.map((t) => passagesPourTier(t));
    expect(grille).toEqual([...grille].sort((a, b) => a - b));
  });
});

describe("tierImport", () => {
  /** Source assez vue pour que le plafond C ne s'applique pas. */
  const VUE = 50_000;

  it("rejette sous 55", () => {
    expect(tierImport(54.9, VUE)).toBeNull();
  });

  it("place C / B / A sur les bornes basses incluses", () => {
    expect(tierImport(55, VUE)).toBe("C");
    expect(tierImport(59.9, VUE)).toBe("C");
    expect(tierImport(60, VUE)).toBe("B");
    expect(tierImport(69.9, VUE)).toBe("B");
    expect(tierImport(70, VUE)).toBe("A");
    expect(tierImport(98, VUE)).toBe("A");
  });

  it("plafonne à C sous 10 000 vues sur la source, quelle que soit la note", () => {
    expect(tierImport(98, 9_999)).toBe("C");
    expect(tierImport(70, 0)).toBe("C");
    expect(tierImport(60, 5_000)).toBe("C");
    expect(tierImport(98, 10_000)).toBe("A");
  });

  it("traite une source inconnue comme non vue", () => {
    expect(tierImport(98, null)).toBe("C");
    expect(tierImport(98, undefined)).toBe("C");
  });

  it("laisse le seuil d'import primer sur le plafond", () => {
    expect(tierImport(40, 1_000_000)).toBeNull();
    expect(tierImport(40, 100)).toBeNull();
  });
});

describe("requalifier", () => {
  const cas: Array<[Tier, number, Tier]> = [
    // D : collant sous 1 000, puis bandes absolues.
    ["D", 0, "D"],
    ["D", 700, "D"],
    ["D", 999, "D"],
    ["D", 1_000, "B"],
    ["D", 4_999, "B"],
    ["D", 5_000, "A"],
    ["D", 50_000, "S"],
    // C
    ["C", 599, "D"],
    ["C", 600, "C"],
    ["C", 999, "C"],
    ["C", 1_000, "B"],
    ["C", 5_000, "A"],
    ["C", 30_000, "S"],
    ["C", 200_000, "S+"],
    // B
    ["B", 300, "C"],
    ["B", 999, "C"],
    ["B", 1_000, "B"],
    ["B", 4_999, "B"],
    ["B", 5_000, "A"],
    ["B", 30_000, "S"],
    ["B", 150_000, "S+"],
    // A
    ["A", 100, "B"],
    ["A", 4_999, "B"],
    ["A", 5_000, "A"],
    ["A", 29_999, "A"],
    ["A", 30_000, "S"],
    ["A", 150_000, "S+"],
    // S
    ["S", 0, "A"],
    ["S", 29_999, "A"],
    ["S", 30_000, "S"],
    ["S", 149_999, "S"],
    ["S", 150_000, "S+"],
    // S+
    ["S+", 0, "S"],
    ["S+", 149_999, "S"],
    ["S+", 150_000, "S+"],
  ];

  for (const [actuel, m, attendu] of cas) {
    it(`${actuel} avec m=${m} → ${attendu}`, () => {
      expect(requalifier(actuel, m)).toBe(attendu);
    });
  }

  it("ne descend jamais de plus d'un cran", () => {
    expect(requalifier("S+", 0)).toBe("S");
    expect(requalifier("S", 0)).toBe("A");
    expect(requalifier("A", 0)).toBe("B");
    expect(requalifier("B", 0)).toBe("C");
    expect(requalifier("C", 0)).toBe("D");
  });

  it("ne plafonne pas la montée", () => {
    expect(requalifier("C", 1_000_000)).toBe("S+");
  });
});

describe("tierDepuisEloLegacy", () => {
  it("reprend le stock sur l'ELO de la langue native", () => {
    expect(tierDepuisEloLegacy(49.9)).toBe("D");
    expect(tierDepuisEloLegacy(50)).toBe("C");
    expect(tierDepuisEloLegacy(55)).toBe("B");
    expect(tierDepuisEloLegacy(60)).toBe("A");
    expect(tierDepuisEloLegacy(70)).toBe("S");
    expect(tierDepuisEloLegacy(80)).toBe("S+");
    expect(tierDepuisEloLegacy(96)).toBe("S+");
  });
});

describe("prioriserTiersHauts", () => {
  const pool = (...tiers: Array<string | null>) => tiers.map((tier, i) => ({ id: `c${i}`, tier }));
  /** Tirage forcé sur les B+ / sur la part réservée aux C. */
  const versHauts = () => 0.99;
  const versC = () => 0;

  it("sert les B+ hors de la part réservée aux C", () => {
    const retenus = prioriserTiersHauts(pool("C", "B", "C", "S"), versHauts);
    expect(retenus.map((c) => c.tier)).toEqual(["B", "S"]);
  });

  it("sert les C dans leur part, même avec du B+ à servir", () => {
    const retenus = prioriserTiersHauts(pool("C", "B", "C", "S"), versC);
    expect(retenus.map((c) => c.tier)).toEqual(["C", "C"]);
  });

  it("laisse sortir les C quand le pool n'a plus que ça", () => {
    expect(prioriserTiersHauts(pool("C", "C"), versHauts)).toHaveLength(2);
  });

  /**
   * Un C immobilisé ne pouvait jamais remonter : il faut être posté pour être
   * mesuré. C'est le défaut que la part réservée ferme — sur 100 tirages d'un
   * pool réel (24 B+, 57 C), les C doivent sortir.
   */
  it("donne aux C une chance de sortir sur un pool réel", () => {
    const reel = pool(...Array(24).fill("B"), ...Array(57).fill("C"));
    let sorties = 0;
    for (let i = 0; i < 100; i++) {
      if (prioriserTiersHauts(reel, () => i / 100).some((c) => c.tier === "C")) sorties++;
    }
    expect(sorties).toBe(Math.round(PART_TIRAGE_C * 100));
  });

  it("garde la part sous 1 : les B+ ne peuvent pas être évincés", () => {
    expect(PART_TIRAGE_C).toBeGreaterThan(0);
    expect(PART_TIRAGE_C).toBeLessThan(0.5);
  });

  it("n'assimile pas un slideshow sans tier à un C", () => {
    // Pas de tier = pas de qualification : il n'entre pas dans la part réservée
    // et ne sort que si le pool n'a plus rien en B+.
    expect(prioriserTiersHauts(pool(null, "A"), versC).map((c) => c.tier)).toEqual(["A"]);
    expect(prioriserTiersHauts(pool(null, "C"), versHauts).map((c) => c.tier)).toEqual([
      null,
      "C",
    ]);
  });

  it("ne touche pas un pool déjà tout en B+", () => {
    expect(prioriserTiersHauts(pool("B", "A", "S", "S+"), versC)).toHaveLength(4);
  });

  it("rend une liste vide telle quelle", () => {
    expect(prioriserTiersHauts([], versC)).toEqual([]);
  });
});
