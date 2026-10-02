import { describe, expect, it } from "vitest";

import { decrireGabarit, ecartsGabarit, gabarit, modeleMicabo } from "./gabarit";

// Slides du parent 835c1781 (1,4 M vues), telles qu'en base.
const COUVERTURE =
  "Les trucs de psychopathe\nque je fais pour réviser\n(et oui, ça marche)\n\nsi quelqu'un me voyait, il\npenserait que j'ai besoin\nd'aide";
const CHEWING_GUM =
  "Je mâche le même\nchewing-gum pour la\nmême matière\n\nMenthe = Maths\nPastèque = Biologie\n\npendant l'exam je prends\nle même goût et mon\ncerveau reconnecte tout\nd'un coup\n\nça s'appelle la \"mémoire\ndépendante de l'état\" et\nnon je l'ai pas inventé";
const MINUTEUR =
  "Je règle un minuteur non\npas pour FINIR mais pour\nCOMMENCER\nje me dis \"interdiction de\ncommencer avant 18h\"\net d'un coup à 17h58 j'ai\ntellement envie de m'y\nmettre que je ne peux plus\nme retenir\npsychologie inversée\ncontre ma propre\nprocrastination";
const PLACEMENT =
  "je crée toutes mes fiches de révision sur l'appli micabo parce que ça va deux fois plus vite. après je les révise dans les toilettes.";
const HAINE =
  "Je m'imagine en train\nd'expliquer le cours à\nquelqu'un que je HAIS\n\nEt je DOIS avoir raison,\nparce que sinon c'est lui\nqui gagne\n\nLa haine > la motivation\n\netudier par pur orgueil,\nc'est vraiment ma\nmeilleure technique.";

describe("gabarit", () => {
  it("compte les paragraphes, leurs lignes et la plus longue", () => {
    expect(gabarit(CHEWING_GUM).paragraphes).toEqual([3, 2, 4, 3]);
    expect(gabarit(MINUTEUR).paragraphes).toEqual([12]);
    expect(gabarit(COUVERTURE).largeur).toBe(26);
  });

  it("ignore les lignes vides en trop et les retours en fin de slide", () => {
    expect(gabarit("a\nb\n\n\n\nc\n").paragraphes).toEqual([2, 1]);
    expect(gabarit("").paragraphes).toEqual([]);
  });

  it("se décrit pour le prompt", () => {
    expect(decrireGabarit(gabarit(CHEWING_GUM))).toMatch(/^4 paragraphes \(3, 2, 4, 3 lignes\)/);
    expect(decrireGabarit(gabarit(PLACEMENT))).toMatch(/une seule ligne/);
  });
});

describe("ecartsGabarit", () => {
  it("accepte une slide de même forme, à une ligne près par paragraphe", () => {
    const variante = "Je fais les cent pas\nen récitant\n\nDebout = lecture\nAssise = récit\n\nmarcher m'empêche de\nm'endormir sur mon\ncours et je retiens\n\nça s'appelle l'encodage\ncontextuel, promis";
    expect(ecartsGabarit(gabarit(CHEWING_GUM), gabarit(variante))).toEqual([]);
  });

  it("refuse trois paragraphes là où le parent en a quatre", () => {
    const trois = "Je fais les cent pas\nen récitant\n\nmarcher m'empêche de\nm'endormir sur mon\ncours\n\nça s'appelle l'encodage\ncontextuel";
    expect(ecartsGabarit(gabarit(CHEWING_GUM), gabarit(trois))[0]).toMatch(/3 paragraphe\(s\) au lieu de 4/);
  });

  it("refuse la ligne unique là où le parent revient à la ligne", () => {
    const e = ecartsGabarit(gabarit(HAINE), gabarit(PLACEMENT));
    expect(e.some((x) => x.includes("paragraphe(s) au lieu de 4"))).toBe(true);
    expect(e.some((x) => x.includes("caractères, le modèle"))).toBe(true);
  });

  it("refuse une slide trop courte ou trop longue", () => {
    expect(ecartsGabarit(gabarit(COUVERTURE), gabarit("Trucs\nbizarres\n\nça\nmarche\nvraiment")).some((x) => x.startsWith("trop courte"))).toBe(true);
  });
});

describe("modeleMicabo", () => {
  const deck = [
    { position: 1, texte: COUVERTURE, placement: false },
    { position: 2, texte: CHEWING_GUM, placement: false },
    { position: 4, texte: MINUTEUR, placement: false },
    { position: 5, texte: PLACEMENT, placement: true },
    { position: 6, texte: HAINE, placement: false },
  ];

  it("prend la voisine la plus proche de la liste quand la slide micabo vient du placement", () => {
    // Médiane de la liste : 4 paragraphes. La voisine 6 en a 4, la 4 un seul.
    expect(modeleMicabo(deck, 5).paragraphes).toEqual([3, 3, 1, 3]);
  });

  it("garde la slide de l'auteur quand micabo y est écrit à la main", () => {
    const manuel = deck.map((s) => (s.position === 5 ? { ...s, placement: false } : s));
    expect(modeleMicabo(manuel, 5).paragraphes).toEqual([1]);
  });

  it("ne prend jamais la couverture comme modèle", () => {
    const court = [deck[0], { position: 2, texte: PLACEMENT, placement: true }];
    expect(modeleMicabo(court, 2).paragraphes).toEqual([1]);
  });
});
