import { describe, expect, it } from "vitest";

import { estPropre } from "./slidePropre";
import type { PostSlide } from "./types";

function slide(path: string | null): PostSlide {
  return {
    id: "s",
    post_id: "p",
    position: 1,
    media_id: path ? "m" : null,
    texte_overlay: "x",
    position_sophia: false,
    reference_url: null,
    media_library: path
      ? { url: "https://example.com/x.jpg", storage_path: path, upscale_le: null }
      : null,
  };
}

describe("estPropre", () => {
  it("détecte le dossier propre/", () => {
    expect(estPropre(slide("propre/a.jpg"))).toBe(true);
    expect(estPropre(slide("brut/a.jpg"))).toBe(false);
    expect(estPropre(slide(null))).toBe(false);
  });
});
