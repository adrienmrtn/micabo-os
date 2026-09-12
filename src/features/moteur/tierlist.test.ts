import { describe, expect, it } from "vitest";

import {
  passagesPourTier,
  prioriserTiersHauts,
  requalifier,
  tierDepuisEloLegacy,
  tierImport,
  type Tier,
} from "./tierlist";

describe("passagesPourTier", () => {
  it("suit la grille D 0 → S+ 16", () => {
    expect(passagesPourTier("D")).toBe(0);
    expect(passagesPourTier("C")).toBe(1);
    expect(passagesPourTier("B")).toBe(2);
    expect(passagesPourTier("A")).toBe(4);
    expect(passagesPourTier("S")).toBe(8);
    expect(passagesPourTier("S+")).toBe(16);
  });
});

describe("tierImport", () => {
  it("rejette sous 55", () => {
    expect(tierImport(54.9)).toBeNull();
  });

  it("place C / B / A sur les bornes basses incluses", () => {
    expect(tierImport(55)).toBe("C");
    expect(tierImport(59.9)).toBe("C");
    expect(tierImport(60)).toBe("B");
    expect(tierImport(69.9)).toBe("B");
    expect(tierImport(70)).toBe("A");
    expect(tierImport(98)).toBe("A");
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

  it("écarte les C tant qu'il reste du B ou mieux", () => {
    const retenus = prioriserTiersHauts(pool("C", "B", "C", "S"));
    expect(retenus.map((c) => c.tier)).toEqual(["B", "S"]);
  });

  it("laisse sortir les C quand le pool n'a plus que ça", () => {
    const retenus = prioriserTiersHauts(pool("C", "C"));
    expect(retenus).toHaveLength(2);
  });

  it("traite un slideshow sans tier comme un C", () => {
    expect(prioriserTiersHauts(pool(null, "A")).map((c) => c.tier)).toEqual(["A"]);
    expect(prioriserTiersHauts(pool(null, "C")).map((c) => c.tier)).toEqual([null, "C"]);
  });

  it("ne touche pas un pool déjà tout en B+", () => {
    expect(prioriserTiersHauts(pool("B", "A", "S", "S+"))).toHaveLength(4);
  });

  it("rend une liste vide telle quelle", () => {
    expect(prioriserTiersHauts([])).toEqual([]);
  });
});
