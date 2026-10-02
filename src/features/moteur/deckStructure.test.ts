import { describe, expect, it } from "vitest";
import { positionsOrphelines, positionsSansTexte, realignerDeck } from "./deckStructure";

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

describe("positionsSansTexte", () => {
  // Le deck `de` de 85379b9e, tel qu'il est parti le 02/10 : quatre slides vides,
  // la 5ᵉ remplie par le placement.
  const source = [
    { position: 1, texte_overlay: "Classement des spécialités" },
    { position: 2, texte_overlay: "Radiologie 11/10" },
    { position: 3, texte_overlay: "Dermatologie 9/10" },
    { position: 4, texte_overlay: "Chirurgie cardiaque 4/10" },
    { position: 5, texte_overlay: "Pédiatrie 2/10" },
  ];
  const troue = [
    { position: 1, texte_overlay: "" },
    { position: 2, texte_overlay: "" },
    { position: 3, texte_overlay: "" },
    { position: 4, texte_overlay: "" },
    { position: 5, texte_overlay: "5. nutze die micabo-App", position_sophia: true },
  ];

  it("repère les slides que la traduction a laissées vides — le cas de 85379b9e", () => {
    expect(positionsSansTexte(source, troue)).toEqual([1, 2, 3, 4]);
  });

  it("ne dit rien sur un deck complet", () => {
    const complet = source.map((s) => ({ ...s, texte_overlay: `de: ${s.texte_overlay}` }));
    expect(positionsSansTexte(source, complet)).toEqual([]);
  });

  it("compte un texte fait d'espaces comme vide, et une position absente aussi", () => {
    const deck = [
      { position: 1, texte_overlay: "  \n " },
      { position: 2, texte_overlay: "b" },
      { position: 3, texte_overlay: "c" },
      { position: 4, texte_overlay: null },
    ];
    expect(positionsSansTexte(source, deck)).toEqual([1, 4, 5]);
  });

  it("n'exige rien d'une slide vide dans la source (OCR vidé exprès, 0288)", () => {
    const sourceVide = [
      { position: 1, texte_overlay: "titre" },
      { position: 2, texte_overlay: "" },
    ];
    const deck = [
      { position: 1, texte_overlay: "Titel" },
      { position: 2, texte_overlay: "" },
    ];
    expect(positionsSansTexte(sourceVide, deck)).toEqual([]);
  });

  it("tolère les positions rendues en chaîne par JSONB", () => {
    const deck = source.map((s) => ({ ...s, position: String(s.position) as unknown as number }));
    expect(positionsSansTexte(source, deck)).toEqual([]);
  });
});
