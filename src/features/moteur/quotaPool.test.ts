import { describe, expect, it } from "vitest";

import {
  messagePool,
  poolDisponible,
  verdictPool,
  type EtatPoolCompte,
} from "../../../supabase/functions/_shared/quota_pool";

const base: EtatPoolCompte = {
  labelsTxt: "Étude",
  langue: "fr",
  candidats: 11,
  dejaAssignes: 0,
  manquants: 2,
};

describe("verdictPool", () => {
  it("un pool plus large que le manque est suffisant", () => {
    expect(verdictPool(base)).toBe("suffisant");
  });

  it("moins de slideshows dispo que de posts manquants → mince", () => {
    expect(verdictPool({ ...base, candidats: 1, manquants: 2 })).toBe("mince");
  });

  it("tout déjà assigné → épuisé", () => {
    expect(verdictPool({ ...base, candidats: 2, dejaAssignes: 2 })).toBe("epuise");
  });

  it("plus rien à créer reste suffisant", () => {
    expect(verdictPool({ ...base, candidats: 5, dejaAssignes: 4, manquants: 0 })).toBe(
      "suffisant",
    );
  });
});

describe("poolDisponible", () => {
  it("retire les slideshows déjà assignés du jour", () => {
    expect(poolDisponible({ ...base, candidats: 5, dejaAssignes: 3 })).toBe(2);
  });
});

describe("messagePool", () => {
  it("ne menace plus de baisser le quota du créateur", () => {
    for (const etat of [base, { ...base, candidats: 1 }, { ...base, dejaAssignes: 11 }]) {
      expect(messagePool(etat)).not.toContain("quota");
    }
  });

  it("distingue un deck impossible d'un pool trop mince", () => {
    expect(messagePool({ ...base, echecsDeck: 3 })).toContain("deck impossible");
    expect(messagePool({ ...base, candidats: 1, manquants: 2 })).toContain("trop mince");
  });
});
