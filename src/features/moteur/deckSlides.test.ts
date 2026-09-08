import { describe, expect, it } from "vitest";

import { fusionnerTexteSlide, TEXTE_SLIDE_MAX } from "./deckSlides";

const deck = [
  { position: 1, texte_overlay: "hook", position_sophia: false },
  { position: 2, texte_overlay: "corps", position_sophia: true },
];

describe("fusionnerTexteSlide", () => {
  it("remplace le texte sans toucher au placement micabo", () => {
    const out = fusionnerTexteSlide(deck, 2, "  corps corrigé  ");
    expect(out[1]).toEqual({
      position: 2,
      texte_overlay: "corps corrigé",
      position_sophia: true,
    });
    expect(out[0]).toEqual(deck[0]);
  });

  it("garde les retours à la ligne", () => {
    const out = fusionnerTexteSlide(deck, 1, "titre\ndeuxième ligne\r\ntroisième");
    expect(out[0]?.texte_overlay).toBe("titre\ndeuxième ligne\ntroisième");
  });

  it("vide = pas de texte", () => {
    expect(fusionnerTexteSlide(deck, 1, "   ")[0]?.texte_overlay).toBeNull();
  });

  it("ajoute la position absente du deck, dans l'ordre", () => {
    const out = fusionnerTexteSlide(deck, 3, "nouvelle");
    expect(out.map((s) => s.position)).toEqual([1, 2, 3]);
    expect(out[2]).toEqual({ position: 3, texte_overlay: "nouvelle", position_sophia: false });
  });

  it("insère une position intercalée à sa place", () => {
    const troue = [deck[0]!, { position: 5, texte_overlay: "fin", position_sophia: false }];
    expect(fusionnerTexteSlide(troue, 3, "milieu").map((s) => s.position)).toEqual([1, 3, 5]);
  });

  it("coupe au garde-fou", () => {
    const out = fusionnerTexteSlide(deck, 1, "a".repeat(TEXTE_SLIDE_MAX + 50));
    expect(out[0]?.texte_overlay).toHaveLength(TEXTE_SLIDE_MAX);
  });

  it("ne mute pas le deck reçu", () => {
    fusionnerTexteSlide(deck, 1, "autre");
    expect(deck[0]?.texte_overlay).toBe("hook");
  });
});
