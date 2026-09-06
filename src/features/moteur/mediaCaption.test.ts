import { describe, expect, it } from "vitest";

import {
  captionEstVide,
  extraireCaptionFal,
  estLabelHook,
  estLabelSysteme,
  idsLabelsAssignables,
  idsPremiereSlide,
  mediaEstPremiereSlide,
  normaliserCaptionManuelle,
  normaliserCaptionOk,
  pathEstPremiereSlide,
  raccourcirCaption,
  CAPTION_MAX,
  SLUG_HOOK,
} from "./mediaCaption";

describe("estLabelSysteme / hook", () => {
  it("reconnaît hook et ugc-ai-video", () => {
    expect(estLabelSysteme({ slug: SLUG_HOOK })).toBe(true);
    expect(estLabelSysteme({ slug: "ugc-ai-video" })).toBe(true);
    expect(estLabelSysteme({ slug: "alpha-male" })).toBe(false);
    expect(estLabelHook({ slug: "Hook" })).toBe(false);
    expect(estLabelHook({ slug: "hook" })).toBe(true);
  });

  it("exclut hook du pool d'assignation créateurs", () => {
    expect(
      idsLabelsAssignables([
        { id: "hook-id", slug: "hook" },
        { id: "ugc-id", slug: "ugc-ai-video" },
        { id: "study", slug: "study-aes" },
      ]),
    ).toEqual(["study"]);
  });
});

describe("captionEstVide", () => {
  it("rejette les placeholders", () => {
    expect(captionEstVide("")).toBe(true);
    expect(captionEstVide("  ")).toBe(true);
    expect(captionEstVide("n/a")).toBe(true);
    expect(captionEstVide("(aucun texte)")).toBe(true);
    expect(captionEstVide("ab")).toBe(true);
    expect(captionEstVide("A woman standing on a beach")).toBe(false);
  });
});

describe("raccourcirCaption", () => {
  it("garde une phrase courte", () => {
    expect(raccourcirCaption("A red car parked outside.")).toBe("A red car parked outside.");
  });

  it("coupe après la première phrase", () => {
    expect(
      raccourcirCaption("A red car parked outside. There are trees and a long fence behind it."),
    ).toBe("A red car parked outside.");
  });

  it("tronque sans casser un mot", () => {
    const long = `${"word ".repeat(80)}end`;
    const out = raccourcirCaption(long, 40);
    expect(out.endsWith("…")).toBe(true);
    expect(out.length).toBeLessThanOrEqual(41);
    expect(out).not.toMatch(/wo…/);
  });
});

describe("extraireCaptionFal", () => {
  it("lit results Florence", () => {
    expect(extraireCaptionFal({ results: "  A cat on a sofa.  " })).toBe("A cat on a sofa.");
  });

  it("lit output Moondream", () => {
    expect(extraireCaptionFal({ output: "A cat." })).toBe("A cat.");
  });

  it("lit data imbriqué", () => {
    expect(extraireCaptionFal({ data: { text: "Nested" } })).toBe("Nested");
  });

  it("ignore un objet vide", () => {
    expect(extraireCaptionFal({})).toBe("");
    expect(extraireCaptionFal(null)).toBe("");
  });
});

describe("normaliserCaptionOk", () => {
  it("null si vide après raccourci", () => {
    expect(normaliserCaptionOk("n/a")).toBeNull();
    expect(normaliserCaptionOk("A detailed view of a kitchen counter.")).toBe(
      "A detailed view of a kitchen counter.",
    );
  });
});

describe("normaliserCaptionManuelle", () => {
  it("garde le texte de l'admin, même refusé par le filtre modèle", () => {
    expect(normaliserCaptionManuelle("  Une   fiche de révision  ")).toEqual({
      caption: "Une fiche de révision",
      caption_statut: "ok",
    });
    expect(normaliserCaptionManuelle("n/a")).toEqual({
      caption: "n/a",
      caption_statut: "ok",
    });
  });

  it("vide = plus de caption", () => {
    expect(normaliserCaptionManuelle("   ")).toEqual({
      caption: null,
      caption_statut: "aucune",
    });
  });

  it("plafonne à CAPTION_MAX", () => {
    const r = normaliserCaptionManuelle("a".repeat(CAPTION_MAX + 50));
    expect(r.caption).toHaveLength(CAPTION_MAX);
  });
});

describe("premiere slide / Hook", () => {
  const slides = [
    { position: 1, media_id: "m-hook" },
    { position: 2, media_id: "m-mid" },
  ];

  it("détecte la première slide", () => {
    expect(mediaEstPremiereSlide("m-hook", slides)).toBe(true);
    expect(mediaEstPremiereSlide("m-mid", slides)).toBe(false);
    expect(mediaEstPremiereSlide("m-hook", [])).toBe(false);
    expect(idsPremiereSlide(slides)).toEqual(["m-hook"]);
  });

  it("détecte le chemin propre/brut position 1", () => {
    expect(pathEstPremiereSlide("propre/abc/1.jpg")).toBe(true);
    expect(pathEstPremiereSlide("brut/abc/1")).toBe(true);
    expect(pathEstPremiereSlide("propre/abc/2.jpg")).toBe(false);
    expect(pathEstPremiereSlide("propre/abc/10.jpg")).toBe(false);
  });
});
