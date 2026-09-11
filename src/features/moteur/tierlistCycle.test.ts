import { describe, expect, it } from "vitest";

import { jourRepostBonus, passageMesure } from "./tierlist";

const JOUR_MS = 86_400_000;
const maintenant = Date.parse("2026-09-11T12:00:00Z");
const ilYA = (jours: number) => new Date(maintenant - jours * JOUR_MS).toISOString();

describe("passageMesure", () => {
  it("attend 3 jours après la publication", () => {
    const p = { statut: "publie", publie_at: ilYA(2), vues: 4200 };
    expect(passageMesure(p, maintenant)).toBe(false);
    expect(passageMesure({ ...p, publie_at: ilYA(3) }, maintenant)).toBe(true);
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
