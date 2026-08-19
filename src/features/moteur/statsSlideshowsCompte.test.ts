import { describe, expect, it } from "vitest";

import {
  aggregerStatsSlideshowsParCompte,
  PAGE_STATS_CONTENUS,
} from "./statsSlideshowsCompte";

const sources = [
  { id: "a", handle_tiktok: "@Sophia" },
  { id: "b", handle_tiktok: "foo_officiel" },
];

describe("aggregerStatsSlideshowsParCompte", () => {
  it("compte importés / gardés / rejetés / en cours par source", () => {
    const stats = aggregerStatsSlideshowsParCompte(
      [
        { compte_reference_id: "a", statut: "valide" },
        { compte_reference_id: "a", statut: "valide" },
        { compte_reference_id: "a", statut: "rejete" },
        { compte_reference_id: "a", statut: "brouillon" },
        { compte_reference_id: "b", statut: "valide" },
      ],
      sources,
    );

    expect(stats).toEqual([
      {
        compteReferenceId: "b",
        handle: "foo_officiel",
        importes: 1,
        gardes: 1,
        rejetes: 0,
        encours: 0,
      },
      {
        compteReferenceId: "a",
        handle: "Sophia",
        importes: 4,
        gardes: 2,
        rejetes: 1,
        encours: 1,
      },
    ]);
  });

  it("groupe les orphelins à part, en dernier", () => {
    const stats = aggregerStatsSlideshowsParCompte(
      [
        { compte_reference_id: null, statut: "valide" },
        { compte_reference_id: "a", statut: "rejete" },
        { compte_reference_id: null, statut: "brouillon" },
      ],
      sources,
    );

    expect(stats.map((s) => s.compteReferenceId)).toEqual(["a", null]);
    expect(stats[1]).toMatchObject({
      handle: "",
      importes: 2,
      gardes: 1,
      encours: 1,
    });
  });

  it("n’invente pas un compte sans slideshow", () => {
    const stats = aggregerStatsSlideshowsParCompte([], sources);
    expect(stats).toEqual([]);
  });

  it("garde un handle de repli si la source a disparu", () => {
    const stats = aggregerStatsSlideshowsParCompte(
      [{ compte_reference_id: "ghost", statut: "valide" }],
      sources,
    );
    expect(stats[0]?.handle).toBe("inconnu");
  });

  it("compte les 45 gardés d’un batch (pas un plafond silencieux)", () => {
    const lignes = Array.from({ length: 45 }, () => ({
      compte_reference_id: "k",
      statut: "valide",
    }));
    const stats = aggregerStatsSlideshowsParCompte(lignes, [
      { id: "k", handle_tiktok: "katsreset" },
    ]);
    expect(stats[0]).toMatchObject({ importes: 45, gardes: 45, rejetes: 0, encours: 0 });
    expect(PAGE_STATS_CONTENUS).toBe(1000);
  });
});
