import { describe, expect, it } from "vitest";

import {
  alignerPrefixe,
  casseLeDeck,
  choisirVariante,
  citeMicabo,
  marquerPlacement,
  positionsPermises,
  slideCitantMicabo,
} from "./placement";

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

describe("alignerPrefixe", () => {
  it("remet le numéro de la slide remplacée", () => {
    expect(alignerPrefixe("3. répétition espacée\ntexte", "4. ce que tu oublies\nl'appli micabo")).toBe(
      "3. ce que tu oublies\nl'appli micabo",
    );
    expect(alignerPrefixe("3. Concept Sprints", "4. Know What To Study")).toBe("3. Know What To Study");
    expect(alignerPrefixe("conseil n°3\n\"relis pas\"", "conseil n°4\nl'appli micabo")).toBe(
      "conseil n°3\nl'appli micabo",
    );
  });

  it("garde une variante déjà juste, et rend un numéro oublié", () => {
    expect(alignerPrefixe("Tip #4\nStop", "Tip #4\nI use the micabo app")).toBe("Tip #4\nI use the micabo app");
    expect(alignerPrefixe("conseil n°3\n\"relis pas\"", "relis pas, teste-toi sur l'appli micabo")).toBe(
      "conseil n°3\nrelis pas, teste-toi sur l'appli micabo",
    );
  });

  it("retire un numéro ajouté à un deck qui n'en a pas", () => {
    expect(alignerPrefixe("envie de rendre l'étude plus fun ?", "5. envie de rendre l'étude plus fun ?")).toBe(
      "envie de rendre l'étude plus fun ?",
    );
    expect(alignerPrefixe("Rewrite important notes", "8. You know what you need")).toBe("You know what you need");
    expect(alignerPrefixe("la nuit blanche", "la nuit blanche à l'envers")).toBe("la nuit blanche à l'envers");
  });
});

describe("casseLeDeck et choisirVariante", () => {
  const deck = [
    { position: 1, texte_overlay: "7 rare study tips" },
    { position: 3, texte_overlay: "3. turn your notes into\nquestions" },
    { position: 4, texte_overlay: "4. keep a \"mistake diary\"\ni put my failed questions there" },
  ];

  it("refuse la recopie du titre d'une autre slide et la note de classement perdue", () => {
    expect(casseLeDeck("3. turn your notes", "4. keep a \"mistake diary\"\nwith the micabo app", deck, 3)).toBe(true);
    expect(casseLeDeck("Médecine\n6/10\nLe burn-out", "Médecine\nl'appli micabo", [], 5)).toBe(true);
    expect(casseLeDeck("Médecine\n6/10\nLe burn-out", "Médecine\n6/10\nl'appli micabo", [], 5)).toBe(false);
  });

  it("prend la meilleure qui tient, numéro remis", () => {
    const r = choisirVariante(
      "3. turn your notes into\nquestions",
      ["4. keep a \"mistake diary\"\nmicabo", "4. what did I miss?\nthe micabo app asks me"],
      0,
      deck,
      3,
    );
    expect(r).toEqual({ texte: "3. what did I miss?\nthe micabo app asks me", index: 1, tient: true });
  });

  it("dit quand aucune variante ne tient, pour que l'appelant redemande", () => {
    const r = choisirVariante(
      "3. turn your notes into\nquestions",
      ["4. keep a \"mistake diary\"\nmicabo", "keep a \"mistake diary\"\nthe micabo app"],
      0,
      deck,
      3,
    );
    expect(r.tient).toBe(false);
    expect(r.texte.startsWith("3. keep a")).toBe(true);
  });
});
