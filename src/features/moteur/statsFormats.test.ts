import { describe, expect, it } from "vitest";

import {
  agregerStatsFormats,
  type ContenuStat,
  type PassageStat,
} from "./statsFormats";

const c = (
  id: string,
  formatId: string | null,
  labelIds: string[] = [],
  tier: ContenuStat["tier"] = null,
  tierImport: ContenuStat["tierImport"] = null,
): ContenuStat => ({ id, formatId, labelIds, tier, tierImport });

const p = (
  contenuId: string,
  vues: number | null,
  extra: Partial<PassageStat> = {},
): PassageStat => ({
  contenuId,
  vues,
  langue: "fr",
  jour: "2026-09-10",
  horsCycle: false,
  ...extra,
});

describe("agregerStatsFormats", () => {
  it("moyenne sur les passages mesurés, pas sur tous les passages", () => {
    const [ligne] = agregerStatsFormats(
      [c("s1", "f1")],
      [p("s1", 1000), p("s1", 3000), p("s1", null)],
    );
    expect(ligne?.passages).toBe(3);
    expect(ligne?.mesures).toBe(2);
    expect(ligne?.vuesMoyennes).toBe(2000);
  });

  it("écarte les reposts bonus et les posts de test", () => {
    const [ligne] = agregerStatsFormats(
      [c("s1", "f1")],
      [p("s1", 1000), p("s1", 999_999, { horsCycle: true })],
    );
    expect(ligne?.passages).toBe(1);
    expect(ligne?.vuesMoyennes).toBe(1000);
  });

  it("filtre par période et par langue", () => {
    const passages = [
      p("s1", 100, { jour: "2026-09-01" }),
      p("s1", 200, { jour: "2026-09-15" }),
      p("s1", 300, { jour: "2026-09-15", langue: "tr" }),
    ];
    const [ligne] = agregerStatsFormats([c("s1", "f1")], passages, {
      depuis: "2026-09-10",
      langue: "fr",
    });
    expect(ligne?.mesures).toBe(1);
    expect(ligne?.vuesMoyennes).toBe(200);
  });

  it("garde une ligne pour un format sans passage", () => {
    const lignes = agregerStatsFormats([c("s1", "f1")], []);
    expect(lignes).toHaveLength(1);
    expect(lignes[0]?.slideshows).toBe(1);
    expect(lignes[0]?.vuesMoyennes).toBeNull();
  });

  it("compte un slideshow dans chacun de ses labels quand on croise", () => {
    const lignes = agregerStatsFormats(
      [c("s1", "f1", ["l1", "l2"])],
      [p("s1", 500)],
      { parLabel: true },
    );
    expect(lignes).toHaveLength(2);
    expect(lignes.map((l) => l.labelId).sort()).toEqual(["l1", "l2"]);
    for (const l of lignes) {
      expect(l.slideshows).toBe(1);
      expect(l.vuesMoyennes).toBe(500);
    }
  });

  it("ne compte un slideshow qu'une fois par ligne, même avec dix passages", () => {
    const [ligne] = agregerStatsFormats(
      [c("s1", "f1"), c("s2", "f1")],
      [p("s1", 10), p("s1", 20), p("s2", 30)],
    );
    expect(ligne?.slideshows).toBe(2);
    expect(ligne?.passages).toBe(3);
  });

  it("compte montées et descentes depuis le tier d'entrée", () => {
    const [ligne] = agregerStatsFormats(
      [c("s1", "f1", [], "A", "C"), c("s2", "f1", [], "D", "B"), c("s3", "f1", [], "B", "B")],
      [],
    );
    expect(ligne?.montees).toBe(1);
    expect(ligne?.descentes).toBe(1);
    expect(ligne?.tiers).toEqual({ A: 1, D: 1, B: 1 });
  });

  it("range les meilleures moyennes devant, et le non mesuré en dernier", () => {
    const lignes = agregerStatsFormats(
      [c("s1", "f1"), c("s2", "f2"), c("s3", "f3")],
      [p("s1", 100), p("s2", 900)],
    );
    expect(lignes.map((l) => l.formatId)).toEqual(["f2", "f1", "f3"]);
  });

  it("regroupe les slideshows sans format sous une ligne « aucun »", () => {
    const lignes = agregerStatsFormats([c("s1", null), c("s2", null)], [p("s1", 50)]);
    expect(lignes).toHaveLength(1);
    expect(lignes[0]?.formatId).toBeNull();
    expect(lignes[0]?.slideshows).toBe(2);
  });
});
