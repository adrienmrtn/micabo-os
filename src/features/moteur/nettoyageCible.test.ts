import { describe, expect, it } from "vitest";

import { MARGE_EFFACEMENT, masqueSur, rognerHors, zonesNommees } from "./nettoyageCible";

// Slide flashka type : logo ChatGPT en haut à gauche, copie « 5/10 » en haut à
// droite, légende « Burlas... 😭 » entre les deux.
const LOGO = { x: 0.05, y: 0.08, w: 0.2, h: 0.17 };
const NOTE = { x: 0.75, y: 0.08, w: 0.2, h: 0.13 };
const LEGENDE = { x: 0.3, y: 0.12, w: 0.4, h: 0.06, quoi: "Burlas... 😭" };

function chevauche(a: { x: number; y: number; w: number; h: number }, b: typeof a): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

describe("masqueSur", () => {
  it("garde la légende entière quand elle ne touche rien, marge comprise", () => {
    const { retenues, notes } = masqueSur([LEGENDE], [LOGO, NOTE]);
    expect(retenues).toHaveLength(1);
    expect(notes).toEqual([]);
    expect(retenues[0].x).toBeCloseTo(LEGENDE.x - MARGE_EFFACEMENT);
    expect(retenues[0].w).toBeCloseTo(LEGENDE.w + 2 * MARGE_EFFACEMENT);
  });

  it("ne mord jamais sur un élément à garder", () => {
    const debordante = { x: 0.2, y: 0.1, w: 0.6, h: 0.08, quoi: "légende large" };
    const { retenues } = masqueSur([debordante], [LOGO, NOTE]);
    expect(retenues).toHaveLength(1);
    for (const k of [LOGO, NOTE]) expect(chevauche(retenues[0], k)).toBe(false);
  });

  it("abandonne une zone qui recouvre presque entièrement un élément à garder", () => {
    const surLaNote = { x: 0.74, y: 0.07, w: 0.22, h: 0.15, quoi: "5/10" };
    const { retenues, notes } = masqueSur([surLaNote], [NOTE]);
    expect(retenues).toHaveLength(0);
    expect(notes[0]).toMatch(/abandonnée/);
  });

  it("reste dans l'image", () => {
    const auBord = { x: 0, y: 0, w: 0.3, h: 0.1, quoi: "logo flashka" };
    const { retenues } = masqueSur([auBord], []);
    expect(retenues[0].x).toBe(0);
    expect(retenues[0].y).toBe(0);
    expect(retenues[0].x + retenues[0].w).toBeLessThanOrEqual(1);
  });
});

describe("rognerHors", () => {
  it("ne touche pas une zone sans chevauchement", () => {
    const e = { x: 0.3, y: 0.1, w: 0.2, h: 0.1 };
    expect(rognerHors(e, NOTE)).toEqual(e);
  });

  it("coupe du côté qui laisse le plus de surface", () => {
    const e = { x: 0.6, y: 0.1, w: 0.2, h: 0.05 };
    const r = rognerHors(e, NOTE);
    expect(r.x).toBeCloseTo(0.6);
    expect(r.x + r.w).toBeCloseTo(NOTE.x);
  });
});

describe("zonesNommees", () => {
  it("lit l'échelle 0-1000 et écarte les zones vides ou illisibles", () => {
    const z = zonesNommees([
      { x: 300, y: 120, w: 400, h: 60, quoi: "légende" },
      { x: 0.1, y: 0.1, w: 0, h: 0.1 },
      { x: "a", y: 0, w: 1, h: 1 },
      null,
    ]);
    expect(z).toHaveLength(1);
    expect(z[0]).toMatchObject({ x: 0.3, y: 0.12, w: 0.4, h: 0.06, quoi: "légende" });
  });

  it("rend une liste vide sur une sortie qui n'est pas un tableau", () => {
    expect(zonesNommees({ effacer: [] })).toEqual([]);
  });
});
