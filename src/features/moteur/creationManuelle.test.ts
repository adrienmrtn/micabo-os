import { describe, expect, it } from "vitest";

import {
  extraireJsonObjet,
  exemplesFeedDepuisTexte,
  exemplesFeedVersTexte,
  hookTexteDepuisDeck,
  normaliserEloManuel,
  parserSlidesGenerees,
  scoreCaptionCritere,
  tirerMediaParCritere,
  tokeniserCritere,
  ELO_MANUEL_DEFAUT,
} from "./creationManuelle";

describe("tokeniserCritere / scoreCaptionCritere", () => {
  it("ignore les mots vides", () => {
    expect(tokeniserCritere("café + dark tones")).toEqual(["cafe", "dark", "tones"]);
    expect(tokeniserCritere("the coffee and the book")).toEqual(["coffee", "book"]);
  });

  it("score un overlap partiel", () => {
    expect(scoreCaptionCritere("A dark cafe interior with wood", "cafe dark tones")).toBeCloseTo(
      2 / 3,
    );
    expect(scoreCaptionCritere("A sunny beach", "cafe dark")).toBe(0);
  });
});

describe("tirerMediaParCritere", () => {
  const pool = [
    { id: "a", caption: "A woman reading in a dark cafe" },
    { id: "b", caption: "Bright beach at noon" },
    { id: "c", caption: "Books on a wooden shelf" },
  ];

  it("prend le meilleur match caption", () => {
    const r = tirerMediaParCritere(pool, "cafe dark", new Set());
    expect(r.fallback).toBe(false);
    expect(r.media?.id).toBe("a");
  });

  it("exclut les ids déjà pris", () => {
    const r = tirerMediaParCritere(pool, "cafe dark", new Set(["a"]));
    expect(r.media?.id).not.toBe("a");
  });

  it("fallback aléatoire si aucun match", () => {
    const r = tirerMediaParCritere(pool, "spaceship neon", new Set(), () => 0);
    expect(r.fallback).toBe(true);
    expect(r.media?.id).toBe("a");
    expect(r.motif).toMatch(/aléatoire/);
  });

  it("pool vide", () => {
    const r = tirerMediaParCritere([], "cafe", new Set());
    expect(r.media).toBeNull();
    expect(r.fallback).toBe(true);
  });
});

describe("parserSlidesGenerees", () => {
  it("fixe le hook en slide 1 et lit le JSON", () => {
    const slides = parserSlidesGenerees(
      '```json\n{"slides":[{"position":2,"texte":"Read 20 pages","critere":"book dark"}]}\n```',
      { hook: "how to become dangerously educated", nbSlides: 3 },
    );
    expect(slides[0]).toEqual({
      position: 1,
      texte: "how to become dangerously educated",
      critere: "",
    });
    expect(slides[1]).toMatchObject({ position: 2, texte: "Read 20 pages", critere: "book dark" });
    expect(slides).toHaveLength(3);
    expect(slides[2]).toEqual({ position: 3, texte: "", critere: "" });
  });

  it("ignore un JSON cassé et garde le hook", () => {
    const slides = parserSlidesGenerees("pas du json", { hook: "HOOK", nbSlides: 4 });
    expect(slides[0]).toEqual({ position: 1, texte: "HOOK", critere: "" });
    expect(slides).toHaveLength(4);
    expect(slides[1]).toEqual({ position: 2, texte: "", critere: "" });
  });
});

describe("extraireJsonObjet / hook / elo", () => {
  it("extrait un objet", () => {
    expect(extraireJsonObjet('prefix {"a":1} suffix')).toEqual({ a: 1 });
    expect(extraireJsonObjet("nope")).toBeNull();
  });

  it("lit le hook du deck source", () => {
    expect(
      hookTexteDepuisDeck([
        { position: 2, texte_overlay: "mid" },
        { position: 1, texte_overlay: "  how to  " },
      ]),
    ).toBe("how to");
    expect(hookTexteDepuisDeck([])).toBe("");
    expect(hookTexteDepuisDeck([{ position: 0, texte_overlay: "first" }])).toBe("first");
  });

  it("découpe le feed few-shot", () => {
    expect(exemplesFeedDepuisTexte("A\n\nB\n\n\nC")).toEqual(["A", "B", "C"]);
    expect(exemplesFeedVersTexte(["A", " B ", ""])).toBe("A\n\nB");
  });

  it("borne l'ELO", () => {
    expect(normaliserEloManuel(undefined)).toBe(ELO_MANUEL_DEFAUT);
    expect(normaliserEloManuel(200)).toBe(100);
    expect(normaliserEloManuel(-4)).toBe(0);
    expect(normaliserEloManuel(72)).toBe(72);
  });
});
