import { describe, expect, it } from "vitest";

import { citeMicabo, marquerPlacement, positionsPermises, slideCitantMicabo } from "./placement";

const deck = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

describe("positionsPermises", () => {
  it("ouvre à la seconde moitié du deck, jamais la couverture", () => {
    expect(positionsPermises(deck(7))).toEqual([4, 5, 6, 7]);
    expect(positionsPermises(deck(8))).toEqual([5, 6, 7, 8]);
    expect(positionsPermises(deck(10))).toEqual([6, 7, 8, 9, 10]);
  });

  it("ne resserre jamais : les trois dernières restent permises", () => {
    // Sur 4 slides, la moitié seule ne laisserait que 3 et 4.
    expect(positionsPermises(deck(4))).toEqual([2, 3, 4]);
    expect(positionsPermises(deck(5))).toEqual([3, 4, 5]);
    expect(positionsPermises(deck(6))).toEqual([4, 5, 6]);
  });

  it("tient les petits decks et les positions non contiguës", () => {
    expect(positionsPermises([1])).toEqual([]);
    expect(positionsPermises([1, 2])).toEqual([2]);
    expect(positionsPermises([3, 1, 2])).toEqual([2, 3]);
    expect(positionsPermises([2, 4, 6, 8, 10, 12, 14])).toEqual([8, 10, 12, 14]);
  });
});

describe("citeMicabo", () => {
  it("reconnaît micabo dans toutes les formes de la marque", () => {
    expect(citeMicabo("utilise l'appli micabo")).toBe(true);
    expect(citeMicabo("die micabo-App")).toBe(true);
    expect(citeMicabo("micabo uygulamasından")).toBe(true);
    expect(citeMicabo("4. MICABO (AI Tool)")).toBe(true);
  });

  it("ne voit rien là où micabo n'est pas un mot", () => {
    expect(citeMicabo("micabos")).toBe(false);
    expect(citeMicabo("")).toBe(false);
    expect(citeMicabo(null)).toBe(false);
  });
});

describe("slideCitantMicabo", () => {
  it("rend la slide la plus loin qui cite micabo, ou null", () => {
    expect(
      slideCitantMicabo([
        { position: 1, texte_overlay: "mes astuces" },
        { position: 3, texte_overlay: "ceux qui ont la mention TB utilisent l'appli micabo" },
        { position: 5, texte_overlay: "relis tes cours" },
      ]),
    ).toBe(3);
    expect(
      slideCitantMicabo([
        { position: 2, texte_overlay: "l'appli micabo" },
        { position: 6, texte_overlay: "die micabo-App" },
      ]),
    ).toBe(6);
    expect(slideCitantMicabo([{ position: 1, texte_overlay: "rien" }, { position: 2, texte_overlay: null }])).toBeNull();
  });
});

describe("marquerPlacement", () => {
  it("marque une seule slide et démarque les autres", () => {
    const r = marquerPlacement(
      [
        { position: 1, position_sophia: false },
        { position: 2, position_sophia: true },
        { position: 3 },
      ],
      3,
    );
    expect(r.map((s) => s.position_sophia)).toEqual([false, false, true]);
  });
});
