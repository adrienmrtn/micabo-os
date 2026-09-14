import { describe, expect, it } from "vitest";

import { etatReleve, resumerReleves } from "./relevesStats";

const MAINTENANT = Date.parse("2026-09-14T12:00:00Z");
const ilYa = (minutes: number) =>
  new Date(MAINTENANT - minutes * 60_000).toISOString();

describe("etatReleve", () => {
  it("ne compte pas un passage non publié comme un relevé raté", () => {
    expect(
      etatReleve({ statut: "assigne", publie_at: null, vues: null }, MAINTENANT),
    ).toBe("non_publie");
  });

  it("laisse mûrir un post publié il y a moins de 45 min", () => {
    expect(
      etatReleve({ statut: "publie", publie_at: ilYa(10), vues: null }, MAINTENANT),
    ).toBe("trop_recent");
    expect(
      etatReleve({ statut: "publie", publie_at: ilYa(60), vues: null }, MAINTENANT),
    ).toBe("manquant");
  });

  it("reconnaît un passage mesuré, même à zéro vue", () => {
    expect(
      etatReleve({ statut: "publie", publie_at: ilYa(600), vues: 0 }, MAINTENANT),
    ).toBe("mesure");
  });

  it("compte manquant un publié sans date de publication", () => {
    expect(
      etatReleve({ statut: "publie", publie_at: null, vues: null }, MAINTENANT),
    ).toBe("manquant");
  });
});

describe("resumerReleves", () => {
  it("sépare les 68 assignés des 16 vraiment manquants", () => {
    const lignes = [
      ...Array.from({ length: 68 }, () => ({
        statut: "assigne",
        publie_at: null,
        vues: null,
      })),
      ...Array.from({ length: 136 }, () => ({
        statut: "publie",
        publie_at: ilYa(6000),
        vues: 1200,
      })),
      ...Array.from({ length: 14 }, () => ({
        statut: "publie",
        publie_at: ilYa(6000),
        vues: null,
      })),
      ...Array.from({ length: 2 }, () => ({
        statut: "publie",
        publie_at: ilYa(5),
        vues: null,
      })),
    ];
    expect(resumerReleves(lignes, MAINTENANT)).toEqual({
      publies: 152,
      mesures: 136,
      manquants: 14,
      tropRecents: 2,
      nonPublies: 68,
    });
  });
});
