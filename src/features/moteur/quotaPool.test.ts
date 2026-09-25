import { describe, expect, it } from "vitest";

import {
  messagePool,
  poolDisponible,
  verdictPool,
  type EtatPoolCompte,
} from "../../../supabase/functions/_shared/quota_pool";
import {
  estCycleComplet,
  estDoublonContenuJour,
} from "../../../supabase/functions/_shared/assignation_quota";

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
  // Le quota d'un créateur ne baisse plus (tierlist + repêchage D) : aucun
  // message ne doit plus en parler. Comparaison insensible à la casse — la
  // première version de ce test cherchait « quota » et laissait passer
  // « Quota inchangé », resté trois heures en prod.
  it("ne parle plus jamais du quota du créateur", () => {
    const cas = [
      base,
      { ...base, candidats: 1, manquants: 2 },
      { ...base, candidats: 2, dejaAssignes: 2 },
      { ...base, echecsDeck: 3 },
    ];
    for (const etat of cas) {
      expect(messagePool(etat).toLowerCase()).not.toContain("quota");
    }
  });

  it("dit quoi faire quand le pool n'est pas la cause", () => {
    const msg = messagePool(base);
    expect(msg).toContain("filet");
    expect(msg).toContain("Assigner");
  });

  it("distingue un deck impossible d'un pool trop mince", () => {
    expect(messagePool({ ...base, echecsDeck: 3 })).toContain("deck impossible");
    expect(messagePool({ ...base, candidats: 1, manquants: 2 })).toContain("trop mince");
  });
});

describe("estDoublonContenuJour", () => {
  it("reconnaît la violation de l'index unique du jour", () => {
    expect(
      estDoublonContenuJour({
        code: "23505",
        message:
          'duplicate key value violates unique constraint "passages_compte_contenu_jour_uidx"',
        details: null,
      }),
    ).toBe(true);
  });

  it("ignore une autre violation d'unicité", () => {
    // Un autre index unique ne doit pas faire repiocher silencieusement.
    expect(
      estDoublonContenuJour({
        code: "23505",
        message: 'duplicate key value violates unique constraint "passages_post_id_uidx"',
      }),
    ).toBe(false);
  });

  it("ignore une erreur qui n'est pas une violation d'unicité", () => {
    expect(estDoublonContenuJour({ code: "23503", message: "fk" })).toBe(false);
    expect(estDoublonContenuJour(null)).toBe(false);
    expect(estDoublonContenuJour("passages_compte_contenu_jour_uidx")).toBe(false);
  });
});

describe("estCycleComplet", () => {
  it("reconnaît le cycle rempli tranché par la transaction (0274)", () => {
    expect(
      estCycleComplet({
        code: "P0002",
        message: "cycle_complet : contenu=90dbf522-20c8-478b-b1da-fb3ad7570eb5 1/1",
        details: null,
      }),
    ).toBe(true);
  });

  it("ignore un autre P0002 : repiocher ne le corrigerait pas", () => {
    expect(estCycleComplet({ code: "P0002", message: "no_data_found" })).toBe(false);
  });

  it("ignore le quota du jour, qui arrête le compte au lieu de repiocher", () => {
    expect(estCycleComplet({ code: "P0001", message: "quota_posts_jour" })).toBe(false);
    expect(estCycleComplet(null)).toBe(false);
    expect(estCycleComplet("cycle_complet")).toBe(false);
  });
});
