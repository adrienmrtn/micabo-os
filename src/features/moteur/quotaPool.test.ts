import { describe, expect, it } from "vitest";

import {
  messagePool,
  poolAutoriseBaisseQuota,
  poolDisponible,
  verdictPool,
} from "../../../supabase/functions/_shared/quota_pool.ts";

const base = {
  labelsTxt: "y2k_study",
  langue: "tr",
  candidats: 11,
  dejaAssignes: 0,
  manquants: 2,
};

describe("verdict pool — relatif au manque du créateur", () => {
  it("11 candidats pour 2 posts manquants : pool suffisant", () => {
    expect(verdictPool(base)).toBe("suffisant");
    expect(poolDisponible(base)).toBe(11);
  });

  it("pool suffisant ne baisse jamais le quota du créateur", () => {
    expect(poolAutoriseBaisseQuota(verdictPool(base))).toBe(false);
  });

  it("moins de slideshows dispo que de posts manquants : trop mince", () => {
    const etat = { ...base, candidats: 3, dejaAssignes: 2 };
    expect(verdictPool(etat)).toBe("mince");
    expect(poolAutoriseBaisseQuota(verdictPool(etat))).toBe(true);
  });

  it("tout le pool déjà assigné ce jour : épuisé", () => {
    const etat = { ...base, candidats: 4, dejaAssignes: 4 };
    expect(verdictPool(etat)).toBe("epuise");
    expect(poolAutoriseBaisseQuota(verdictPool(etat))).toBe(true);
  });

  it("quota déjà rempli (0 manquant) : un seul dispo suffit", () => {
    expect(verdictPool({ ...base, candidats: 5, dejaAssignes: 4, manquants: 0 })).toBe(
      "suffisant",
    );
  });
});

describe("message pool", () => {
  it("pool suffisant : pointe le passage / le deck, pas la bibliothèque", () => {
    const msg = messagePool(base);
    expect(msg).toContain("suffisant");
    expect(msg).toContain("Quota inchangé");
    expect(msg).not.toContain("trop mince");
  });

  it("pool suffisant avec decks ratés : nomme la traduction / Sophia", () => {
    const msg = messagePool({ ...base, echecsDeck: 3 });
    expect(msg).toContain("deck impossible sur 3 slideshow(s)");
    expect(msg).toContain("traduction / Sophia");
  });

  it("pool trop mince : demande d'importer / labelliser", () => {
    const msg = messagePool({ ...base, candidats: 1, manquants: 2 });
    expect(msg).toContain("trop mince");
    expect(msg).toContain("importe / labellise");
  });

  it("pool épuisé : dit que tout est déjà assigné ce jour", () => {
    const msg = messagePool({ ...base, candidats: 2, dejaAssignes: 2 });
    expect(msg).toContain("épuisé");
    expect(msg).toContain("déjà assignés");
  });
});
