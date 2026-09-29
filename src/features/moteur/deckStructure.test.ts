import { describe, expect, it } from "vitest";
import { positionsOrphelines, realignerDeck } from "./deckStructure";

const deck6 = [
  { position: 1, texte_overlay: "un", position_sophia: false },
  { position: 2, texte_overlay: "deux", position_sophia: false },
  { position: 3, texte_overlay: "trois", position_sophia: false },
  { position: 4, texte_overlay: "quatre", position_sophia: false },
  { position: 5, texte_overlay: "cinq", position_sophia: false },
  { position: 6, texte_overlay: "six", position_sophia: true },
];

describe("realignerDeck", () => {
  it("laisse tomber le texte de la slide supprimée — le cas de b1bc3cb3", () => {
    // La 4ᵉ image retirée : les slides 5 et 6 remontent en 4 et 5.
    const r = realignerDeck(deck6, [1, 2, 3, 5, 6]);
    expect(r).toHaveLength(5);
    expect(r.map((s) => s.texte_overlay)).toEqual(["un", "deux", "trois", "cinq", "six"]);
    expect(r.map((s) => s.position)).toEqual([1, 2, 3, 4, 5]);
  });

  it("ne laisse JAMAIS le deck plus long que la structure", () => {
    // C'est l'invariant : c'est la longueur de la structure qui commande.
    expect(realignerDeck(deck6, [1, 2, 3])).toHaveLength(3);
    expect(realignerDeck(deck6, [1, 2, 3, 4, 5, 6])).toHaveLength(6);
  });

  it("emporte le drapeau du CTA avec sa slide, pas avec sa position", () => {
    const r = realignerDeck(deck6, [1, 2, 3, 5, 6]);
    expect(r.filter((s) => s.position_sophia).map((s) => s.position)).toEqual([5]);
    expect(r[4]?.texte_overlay).toBe("six");
  });

  it("suit un réordonnancement sans suppression", () => {
    const r = realignerDeck(deck6, [6, 1, 2, 3, 4, 5]);
    expect(r.map((s) => s.texte_overlay)).toEqual(["six", "un", "deux", "trois", "quatre", "cinq"]);
    expect(r[0]?.position_sophia).toBe(true);
  });

  it("rend une entrée vide plutôt que de décaler quand une position manque", () => {
    // Décaler d'un cran pour combler un trou reproduirait le défaut qu'on ferme.
    const r = realignerDeck([{ position: 1, texte_overlay: "un" }], [1, 2, 3]);
    expect(r.map((s) => s.texte_overlay)).toEqual(["un", "", ""]);
    expect(r.map((s) => s.position)).toEqual([1, 2, 3]);
  });

  it("est idempotente sur un deck déjà aligné", () => {
    const une = realignerDeck(deck6, [1, 2, 3, 5, 6]);
    expect(realignerDeck(une, [1, 2, 3, 4, 5])).toEqual(une);
  });
});

describe("positionsOrphelines", () => {
  it("repère la position que plus aucune image ne porte", () => {
    const structure = [1, 2, 3, 4, 5].map((position) => ({ position }));
    expect(positionsOrphelines(deck6, structure)).toEqual([6]);
  });

  it("ne dit rien quand les deux listes sont en face", () => {
    const structure = deck6.map((s) => ({ position: s.position }));
    expect(positionsOrphelines(deck6, structure)).toEqual([]);
  });

  it("tolère les positions rendues en chaîne par JSONB", () => {
    const structure = [{ position: "1" as unknown as number }, { position: "2" as unknown as number }];
    expect(positionsOrphelines(deck6.slice(0, 2), structure)).toEqual([]);
  });
});
