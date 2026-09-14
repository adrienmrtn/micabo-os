import { describe, expect, it } from "vitest";

import { bilanPassages, etatReleve, resumerReleves } from "./relevesStats";

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

describe("bilanPassages", () => {
  const T0 = Date.parse("2026-09-14T12:00:00Z");
  const publie = (vues: number | null, publieAt = "2026-09-01T10:00:00Z") => ({
    statut: "publie",
    publie_at: publieAt,
    vues,
  });

  it("ne fait la moyenne que sur les passages mesurés", () => {
    const b = bilanPassages(
      [
        publie(1000),
        publie(3000),
        publie(null), // publié, jamais relevé
        { statut: "assigne", publie_at: null, vues: null }, // rien à mesurer
      ],
      T0,
    );
    expect(b.total).toBe(4);
    expect(b.publies).toBe(3);
    expect(b.mesures).toBe(2);
    expect(b.vues).toBe(4000);
    // 4000 / 2, et non 4000 / 4 : compter les non-mesurés comme zéro
    // afficherait 1 000 pour un slideshow qui fait réellement 2 000.
    expect(b.moyenne).toBe(2000);
  });

  it("ne prétend pas à une moyenne quand rien n'est mesuré", () => {
    const b = bilanPassages([publie(null), { statut: "assigne", publie_at: null, vues: null }], T0);
    expect(b.moyenne).toBeNull();
    expect(b.vues).toBe(0);
  });

  it("compte zéro vue comme une mesure", () => {
    // Un post qui a fait 0 vue EST mesuré : l'écarter remonterait la moyenne
    // des slideshows qui se plantent.
    const b = bilanPassages([publie(0), publie(100)], T0);
    expect(b.mesures).toBe(2);
    expect(b.moyenne).toBe(50);
  });

  it("ne compte pas un post trop récent comme un raté", () => {
    const b = bilanPassages([publie(null, new Date(T0 - 10 * 60_000).toISOString())], T0);
    expect(b.tropRecents).toBe(1);
    expect(b.manquants).toBe(0);
    expect(b.moyenne).toBeNull();
  });

  it("rend un bilan vide sans passage", () => {
    expect(bilanPassages([], T0)).toMatchObject({ total: 0, vues: 0, moyenne: null });
  });
});
