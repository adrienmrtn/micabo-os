import { describe, expect, it } from "vitest";

import { jourMoins, moisDuJour, postsDuJour, RETARD_AFFICHE_JOURS } from "./calendrierPoster";

const post = (id: string, date: string, publie = false, compte: string | null = "c1") => ({
  id,
  compte_id: compte,
  date_publication_prevue: date,
  publie_at: publie ? `${date}T18:00:00Z` : null,
});

describe("moisDuJour / jourMoins", () => {
  it("ouvre la grille sur le mois du jour Paris, sans fuseau", () => {
    expect(moisDuJour("2026-10-01")).toEqual({ annee: 2026, mois: 9 });
    expect(moisDuJour("2026-12-31")).toEqual({ annee: 2026, mois: 11 });
  });

  it("recule de n jours en passant les mois", () => {
    expect(jourMoins("2026-10-01", 1)).toBe("2026-09-30");
    expect(jourMoins("2026-03-01", 2)).toBe("2026-02-27");
  });
});

describe("postsDuJour", () => {
  const jour = "2026-10-01";

  it("garde les posts du jour, publiés ou non", () => {
    const { duJour } = postsDuJour([post("a", jour), post("b", jour, true), post("c", "2026-10-02")], jour, "c1");
    expect(duJour.map((p) => p.id)).toEqual(["a", "b"]);
  });

  it("montre les posts en retard non publiés, les plus vieux d'abord", () => {
    const { enRetard } = postsDuJour(
      [post("hier", "2026-09-30"), post("avant-hier", "2026-09-29"), post("publie", "2026-09-30", true)],
      jour,
      "c1",
    );
    expect(enRetard.map((p) => p.id)).toEqual(["avant-hier", "hier"]);
  });

  it(`oublie un retard de plus de ${RETARD_AFFICHE_JOURS} jours`, () => {
    const vieux = jourMoins(jour, RETARD_AFFICHE_JOURS + 1);
    expect(postsDuJour([post("vieux", vieux)], jour, "c1").enRetard).toEqual([]);
  });

  it("filtre sur le compte choisi, mais garde un post sans compte", () => {
    const { duJour } = postsDuJour([post("a", jour, false, "c1"), post("b", jour, false, "c2"), post("c", jour, false, null)], jour, "c1");
    expect(duJour.map((p) => p.id)).toEqual(["a", "c"]);
  });
});
