import { describe, expect, it } from "vitest";

import { promptAmeliorerReview } from "../../../supabase/functions/_shared/ameliorer_review.ts";
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
    expect(remarquesDepuisReglage(null)).toEqual([...REMARQUES_DEFAUT]);
    expect(remarquesDepuisReglage(undefined)).toEqual([...REMARQUES_DEFAUT]);
  });

  it("accepte une liste vide (admin a tout retiré)", () => {
    expect(remarquesDepuisReglage([])).toEqual([]);
  });

  it("déduit, coupe, déduplique", () => {
    expect(normaliserRemarques(["  Hook  ", "hook", "", 12, "a".repeat(200)])).toEqual([
      "Hook",
      "12",
      "a".repeat(160),
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
