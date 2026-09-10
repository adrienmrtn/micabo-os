import { describe, expect, it } from "vitest";

import {
  motifEchecNettoyage,
  resumerMotifs,
  type SlideANettoyer,
} from "./echecsNettoyage";

const CONTENU = "6db422d7-67b3-4b0b-9f59-0d6d144c0620";

function slide(over: Partial<SlideANettoyer> = {}): SlideANettoyer {
  return {
    contenuId: CONTENU,
    position: 2,
    mediaId: "media-1",
    aSource: true,
    media: { contenuId: CONTENU, texteRestant: false },
    ...over,
  };
}

describe("motifEchecNettoyage", () => {
  it("laisse tranquille une slide nettoyée pour de vrai", () => {
    expect(motifEchecNettoyage(slide())).toBeNull();
  });

  it("attrape la substitution biblio, que l'ancien test ratait", () => {
    // Le cas des 113 slides de prod : media_id valide, zéro tentative, mais le
    // visuel appartient à un autre slideshow — c'est un secours, donc un échec.
    const substituee = slide({
      media: { contenuId: "un-autre-contenu", texteRestant: false },
    });
    expect(motifEchecNettoyage(substituee)).toBe("substitue");
  });

  it("attrape le repli brut (texte encore incrusté)", () => {
    expect(
      motifEchecNettoyage(slide({ media: { contenuId: CONTENU, texteRestant: true } })),
    ).toBe("texte_restant");
  });

  it("attrape une référence morte vers un média supprimé", () => {
    expect(motifEchecNettoyage(slide({ media: null }))).toBe("media_introuvable");
  });

  it("attrape les échecs encore en vol", () => {
    expect(motifEchecNettoyage(slide({ mediaId: null, media: null }))).toBe("sans_media");
    expect(motifEchecNettoyage(slide({ tentatives: 4 }))).toBe("tentatives_epuisees");
    expect(motifEchecNettoyage(slide({ tentatives: 3 }))).toBeNull();
  });

  it("sans brut source, il n'y a rien à rejouer", () => {
    expect(
      motifEchecNettoyage(slide({ aSource: false, mediaId: null, media: null })),
    ).toBeNull();
  });

  it("un slideshow manuel pioche dans la biblio par design, pas par échec", () => {
    const manuel = slide({
      creationManuelle: true,
      media: { contenuId: "un-autre-contenu", texteRestant: false },
    });
    expect(motifEchecNettoyage(manuel)).toBeNull();
  });
});

describe("resumerMotifs", () => {
  it("compte par motif pour annoncer ce qu'on rejoue", () => {
    expect(resumerMotifs(["substitue", "substitue", "sans_media"])).toEqual({
      substitue: 2,
      sans_media: 1,
    });
    expect(resumerMotifs([])).toEqual({});
  });
});
