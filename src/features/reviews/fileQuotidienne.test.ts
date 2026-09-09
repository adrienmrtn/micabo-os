import { describe, expect, it } from "vitest";

import { promptAmeliorerReview } from "../../../supabase/functions/_shared/ameliorer_review.ts";
import {
  estLienCourtTiktok,
  extraireIdTiktok,
} from "../../../supabase/functions/_shared/tiktok_lien.ts";
import {
  collerRemarque,
  estHorsFile,
  jourParisDe,
  normaliserRemarques,
  remarquesDepuisReglage,
  REMARQUES_DEFAUT,
  urlEmbedTikTok,
} from "./fileQuotidienne";

describe("jourParisDe", () => {
  it("range 23:30 Paris été dans le bon jour", () => {
    expect(jourParisDe("2026-09-08T21:30:00.000Z")).toBe("2026-09-08");
  });

  it("refuse une date invalide", () => {
    expect(jourParisDe("nope")).toBeNull();
    expect(jourParisDe(null)).toBeNull();
  });
});

describe("estHorsFile", () => {
  it("sort un post déjà reviewé ou passé", () => {
    expect(
      estHorsFile({
        postId: "a",
        publieAt: "2026-09-08T10:00:00.000Z",
        jour: "2026-09-08",
        deja: new Set(["a"]),
      }),
    ).toBe(true);
  });

  it("garde un post publié ce jour-là", () => {
    expect(
      estHorsFile({
        postId: "b",
        publieAt: "2026-09-08T10:00:00.000Z",
        jour: "2026-09-08",
        deja: new Set(),
      }),
    ).toBe(false);
  });
});

describe("remarques", () => {
  it("prend les défauts si le réglage est absent", () => {
    expect(remarquesDepuisReglage(null)).toEqual(REMARQUES_DEFAUT);
    expect(remarquesDepuisReglage(undefined)).toEqual(REMARQUES_DEFAUT);
  });

  it("accepte une liste vide (admin a tout retiré)", () => {
    expect(remarquesDepuisReglage([])).toEqual([]);
  });

  it("migre les anciennes chaînes : titre avant virgule, corps entier", () => {
    expect(
      normaliserRemarques(["Hook trop petit, on le lit trop tard", "Musique trop basse"]),
    ).toEqual([
      { titre: "Hook trop petit", corps: "Hook trop petit, on le lit trop tard" },
      { titre: "Musique trop basse", corps: "Musique trop basse" },
    ]);
  });

  it("garde titre / corps d'un objet, déduplique par titre", () => {
    expect(
      normaliserRemarques([
        { titre: "Hook", corps: "Le hook est trop petit" },
        { titre: "hook", corps: "doublon" },
        { titre: "  Rythme  ", corps: "  Trop lent  " },
      ]),
    ).toEqual([
      { titre: "Hook", corps: "Le hook est trop petit" },
      { titre: "Rythme", corps: "Trop lent" },
    ]);
  });

  it("colle une remarque sans doublon de ligne", () => {
    expect(collerRemarque("", "Hook trop petit")).toBe("Hook trop petit");
    expect(collerRemarque("Rythme lent", "Hook trop petit")).toBe("Rythme lent\nHook trop petit");
    expect(collerRemarque("Hook trop petit", "hook trop petit")).toBe("Hook trop petit");
  });
});

describe("urlEmbedTikTok", () => {
  it("extrait l'id photo ou vidéo", () => {
    expect(urlEmbedTikTok("https://www.tiktok.com/@x/photo/7123")).toBe(
      "https://www.tiktok.com/embed/v2/7123",
    );
    expect(urlEmbedTikTok("https://www.tiktok.com/@x/video/999?foo=1")).toBe(
      "https://www.tiktok.com/embed/v2/999",
    );
    expect(urlEmbedTikTok("https://www.tiktok.com/@x")).toBeNull();
  });

  it("lit item_id après redirection d'un lien court", () => {
    expect(
      extraireIdTiktok(
        "https://www.tiktok.com/@x/photo/7683464897522437384?_r=1&item_id=111",
      ),
    ).toBe("7683464897522437384");
    expect(extraireIdTiktok("https://www.tiktok.com/share?item_id=555")).toBe("555");
    expect(estLienCourtTiktok("https://vt.tiktok.com/ZSqSYW3rS/")).toBe(true);
    expect(estLienCourtTiktok("https://vm.tiktok.com/ZN82uCFrU/")).toBe(true);
    expect(estLienCourtTiktok("https://www.tiktok.com/@x/photo/7123")).toBe(false);
    expect(urlEmbedTikTok("https://vt.tiktok.com/ZSqSYW3rS/")).toBeNull();
  });
});

describe("promptAmeliorerReview", () => {
  it("demande de l'anglais et interdit d'inventer", () => {
    const p = promptAmeliorerReview("hook trop petit");
    expect(p).toMatch(/English only/i);
    expect(p).toMatch(/Do not add new/i);
    expect(p).toMatch(/micabo/);
    expect(p).toContain("hook trop petit");
    expect(p).not.toMatch(/sophia/i);
  });
});
