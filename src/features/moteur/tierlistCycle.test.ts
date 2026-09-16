import { describe, expect, it } from "vitest";

import {
  bilanCycle,
  jourRepostBonus,
  MESURE_JOURS,
  PASSAGE_PERIME_JOURS,
  passageMesure,
  passagePerime,
  passageRegle,
} from "./tierlist";

const JOUR_MS = 86_400_000;
const maintenant = Date.parse("2026-09-11T12:00:00Z");
const ilYA = (jours: number) => new Date(maintenant - jours * JOUR_MS).toISOString();
/** Jour Paris (yyyy-mm-dd) d'il y a `jours` jours. */
const jour = (jours: number) => ilYA(jours).slice(0, 10);

/** Publié il y a `depuis` jours, vues relevées. */
const mesure = (depuis: number, vues: number) => ({
  statut: "publie",
  publie_at: ilYA(depuis),
  vues,
  date_publication_prevue: jour(depuis),
});
/** Assigné sur un créneau vieux de `depuis` jours, jamais publié. */
const noShow = (depuis: number) => ({
  statut: "assigne",
  publie_at: null,
  vues: null,
  date_publication_prevue: jour(depuis),
});

describe("passageMesure", () => {
  it("attend MESURE_JOURS après la publication", () => {
    const p = { statut: "publie", publie_at: ilYA(MESURE_JOURS - 1), vues: 4200 };
    expect(passageMesure(p, maintenant)).toBe(false);
    expect(passageMesure({ ...p, publie_at: ilYA(MESURE_JOURS) }, maintenant)).toBe(true);
  });

  it("exige des vues relevées", () => {
    expect(
      passageMesure({ statut: "publie", publie_at: ilYA(5), vues: null }, maintenant),
    ).toBe(false);
  });

  it("ignore un passage non publié", () => {
    expect(
      passageMesure({ statut: "assigne", publie_at: null, vues: null }, maintenant),
    ).toBe(false);
  });
});

describe("jourRepostBonus", () => {
  it("tombe 7 jours après la publication", () => {
    expect(jourRepostBonus("2026-09-04T18:00:00Z", "2026-09-06")).toBe("2026-09-11");
  });

  it("repousse à demain si J+7 est déjà passé (stats relevées tard)", () => {
    expect(jourRepostBonus("2026-08-20T10:00:00Z", "2026-09-11")).toBe("2026-09-12");
  });

  it("part d'aujourd'hui quand la date de publication manque", () => {
    expect(jourRepostBonus(null, "2026-09-11")).toBe("2026-09-18");
  });
});

describe("passagePerime / passageRegle", () => {
  it("ne périme pas un passage mesuré", () => {
    const p = mesure(6, 4_200);
    expect(passageMesure(p, maintenant)).toBe(true);
    expect(passagePerime(p, maintenant)).toBe(false);
    expect(passageRegle(p, maintenant)).toBe(true);
  });

  it("laisse le cycle attendre un passage encore en vol", () => {
    // Le créateur a encore son créneau.
    expect(passageRegle(noShow(1), maintenant)).toBe(false);
    // Publié hier : vues pas stabilisées, on attend MESURE_JOURS.
    expect(passageRegle(mesure(1, 800), maintenant)).toBe(false);
  });

  it("périme un passage jamais publié passé le délai", () => {
    expect(passagePerime(noShow(PASSAGE_PERIME_JOURS - 1), maintenant)).toBe(false);
    expect(passagePerime(noShow(PASSAGE_PERIME_JOURS + 1), maintenant)).toBe(true);
  });

  it("périme un passage publié que le relevé n'a jamais accroché", () => {
    const sansVues = (depuis: number) => ({ ...mesure(depuis, 0), vues: null });
    // Encore dans la fenêtre de scrape (4 j) : on attend.
    expect(passagePerime(sansVues(PASSAGE_PERIME_JOURS - 1), maintenant)).toBe(false);
    expect(passagePerime(sansVues(PASSAGE_PERIME_JOURS + 1), maintenant)).toBe(true);
  });

  it("ne périme jamais un passage sans créneau ni publication", () => {
    const orphelin = {
      statut: "brouillon",
      publie_at: null,
      vues: null,
      date_publication_prevue: null,
    };
    expect(passagePerime(orphelin, maintenant)).toBe(false);
    expect(passageRegle(orphelin, maintenant)).toBe(false);
  });
});

describe("bilanCycle", () => {
  it("clôt un cycle dont tous les passages sont mesurés", () => {
    const b = bilanCycle([mesure(4, 1_000), mesure(5, 3_000)], 2, maintenant);
    expect(b).toEqual({ mesures: 2, perimes: 0, clos: true, m: 2_000 });
  });

  it("clôt malgré un créateur qui n'a jamais posté", () => {
    // Le cas qui gelait un slideshow 14 jours : 1 passage sur 2 avait rendu.
    const b = bilanCycle([mesure(4, 5_000), noShow(PASSAGE_PERIME_JOURS + 2)], 2, maintenant);
    expect(b.clos).toBe(true);
    expect(b.perimes).toBe(1);
    // Un périmé ne vaut pas zéro vue : il ne pèse pas dans la moyenne.
    expect(b.m).toBe(5_000);
  });

  it("attend un passage encore en vol", () => {
    expect(bilanCycle([mesure(4, 5_000), mesure(1, 900)], 2, maintenant).clos).toBe(false);
    expect(bilanCycle([mesure(4, 5_000), noShow(0)], 2, maintenant).clos).toBe(false);
  });

  it("attend tant que le cycle n'est pas rempli", () => {
    expect(bilanCycle([mesure(4, 5_000)], 2, maintenant).clos).toBe(false);
  });

  it("clôt un cycle entièrement périmé, sans moyenne", () => {
    // m null → tier inchangé et cycle rouvert : le slideshow repart.
    const b = bilanCycle([noShow(9), noShow(8)], 2, maintenant);
    expect(b).toEqual({ mesures: 0, perimes: 2, clos: true, m: null });
  });

  it("ne bloque pas sur un cycle qui a débordé la cible", () => {
    const b = bilanCycle([mesure(4, 1_000), mesure(5, 1_000), mesure(6, 4_000)], 2, maintenant);
    expect(b.clos).toBe(true);
    expect(b.mesures).toBe(3);
    expect(b.m).toBe(2_000);
  });
});
