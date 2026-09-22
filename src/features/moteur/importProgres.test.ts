import { describe, expect, it } from "vitest";

import {
  decisionPas,
  decisionPasDejaCompte,
  etapeAChange,
  MAX_PASSES_MEME_ETAPE,
} from "./importProgres";

describe("etapeAChange", () => {
  it("voit le franchissement d'une étape", () => {
    expect(etapeAChange("pertinence", { etape: "elo" })).toBe(true);
  });

  it("ne voit pas de franchissement quand l'étape est la même", () => {
    expect(etapeAChange("format", { etape: "format" })).toBe(false);
  });

  it("traite une étape absente comme la chaîne vide", () => {
    expect(etapeAChange(null, { etape: "ocr" })).toBe(true);
    expect(etapeAChange(undefined, { etape: "" })).toBe(false);
  });
});

describe("decisionPas", () => {
  it("remet le compteur à zéro au franchissement d'étape", () => {
    expect(decisionPas(12, true)).toEqual({ passes: 0, sortDeLaFile: false });
  });

  it("compte les passes tant que l'étape ne bouge pas", () => {
    expect(decisionPas(0, false)).toEqual({ passes: 1, sortDeLaFile: false });
    expect(decisionPas(7, false)).toEqual({ passes: 8, sortDeLaFile: false });
  });

  it("sort la ligne de la file au plafond", () => {
    expect(decisionPas(MAX_PASSES_MEME_ETAPE - 1, false)).toEqual({
      passes: MAX_PASSES_MEME_ETAPE,
      sortDeLaFile: true,
    });
  });

  // Le défaut du 22/09/2026 : une ligne qui repasse indéfiniment sur la même
  // étape. Sans plafond elle monopolise la fenêtre de claim (8 lignes) et
  // arrête tout l'import. Avec, elle sort d'elle-même.
  it("finit par sortir une ligne qui ne franchit jamais son étape", () => {
    let passes = 0;
    let sortie = false;
    for (let i = 0; i < 200 && !sortie; i += 1) {
      const d = decisionPas(passes, false);
      passes = d.passes;
      sortie = d.sortDeLaFile;
    }
    expect(sortie).toBe(true);
    expect(passes).toBe(MAX_PASSES_MEME_ETAPE);
  });

  // `nettoyage` et `caption` restent VOLONTAIREMENT sur leur étape en traitant
  // les slides par lots. Un slideshow de 20 slides doit traverser son nettoyage
  // sans jamais être écarté — c'est le piège exact de ce correctif.
  it("laisse une étape multi-passes finir son travail", () => {
    let passes = 0;
    for (let slide = 0; slide < 20; slide += 1) {
      const d = decisionPas(passes, false);
      expect(d.sortDeLaFile).toBe(false);
      passes = d.passes;
    }
    // Puis l'étape est franchie : le compteur repart de zéro.
    expect(decisionPas(passes, true)).toEqual({ passes: 0, sortDeLaFile: false });
  });

  it("garde une marge confortable au-dessus d'un slideshow long", () => {
    expect(MAX_PASSES_MEME_ETAPE).toBeGreaterThan(20);
  });

  it("tolère un compteur absurde en base", () => {
    expect(decisionPas(-3, false).passes).toBe(1);
    expect(decisionPas(2.7, false).passes).toBe(3);
  });
});

describe("decisionPasDejaCompte", () => {
  // `claimContenu` incrémente au claim pour qu'un pas qui tue l'isolat compte
  // quand même son essai. La fin de pas ne doit donc PAS re-compter.
  it("ne re-compte pas un essai déjà compté au claim", () => {
    expect(decisionPasDejaCompte(1, false)).toEqual({ passes: 1, sortDeLaFile: false });
    expect(decisionPasDejaCompte(9, false)).toEqual({ passes: 9, sortDeLaFile: false });
  });

  it("remet à zéro au franchissement d'étape", () => {
    expect(decisionPasDejaCompte(30, true)).toEqual({ passes: 0, sortDeLaFile: false });
  });

  it("sort la ligne de la file au plafond", () => {
    expect(decisionPasDejaCompte(MAX_PASSES_MEME_ETAPE, false)).toEqual({
      passes: MAX_PASSES_MEME_ETAPE,
      sortDeLaFile: true,
    });
  });

  // Le cas réel du 22/09 : cinq lignes réclamées en boucle, chaque pas tuant
  // l'isolat avant d'écrire quoi que ce soit. Compté au claim, le compteur
  // monte malgré tout et la ligne finit par sortir.
  it("éjecte une ligne dont chaque pas tue le worker", () => {
    let passes = 0;
    let sortie = false;
    for (let i = 0; i < 200 && !sortie; i += 1) {
      passes += 1; // l'incrément du claim, seul écrit qui survive
      sortie = decisionPasDejaCompte(passes, false).sortDeLaFile;
    }
    expect(sortie).toBe(true);
    expect(passes).toBe(MAX_PASSES_MEME_ETAPE);
  });

  it("n'écrit jamais un compteur sous 1 quand l'étape n'a pas bougé", () => {
    expect(decisionPasDejaCompte(0, false).passes).toBe(1);
    expect(decisionPasDejaCompte(-5, false).passes).toBe(1);
  });
});
