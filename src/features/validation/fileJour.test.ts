import { describe, expect, it } from "vitest";

import { horsFileValidation, sourceUrlValidation } from "./fileJour";

describe("horsFileValidation", () => {
  it("retire les déjà validés, les UGC vidéo et les publiés", () => {
    expect(
      horsFileValidation({
        postId: "a",
        statut: "assigne",
        ugcAiVideo: false,
        deja: new Set(),
      }),
    ).toBe(false);
    expect(
      horsFileValidation({
        postId: "a",
        statut: "assigne",
        ugcAiVideo: false,
        deja: new Set(["a"]),
      }),
    ).toBe(true);
    expect(
      horsFileValidation({
        postId: "b",
        statut: "assigne",
        ugcAiVideo: true,
        deja: new Set(),
      }),
    ).toBe(true);
    expect(
      horsFileValidation({
        postId: "c",
        statut: "publie",
        ugcAiVideo: false,
        deja: new Set(),
      }),
    ).toBe(true);
  });
});

describe("sourceUrlValidation", () => {
  it("préfère le contenu v-next, sinon le sujet legacy", () => {
    expect(
      sourceUrlValidation({
        passageSource: "https://www.tiktok.com/@a/video/1",
        sujetSource: "https://www.tiktok.com/@b/video/2",
      }),
    ).toBe("https://www.tiktok.com/@a/video/1");
    expect(
      sourceUrlValidation({
        passageSource: null,
        sujetSource: "https://www.tiktok.com/@b/video/2",
      }),
    ).toBe("https://www.tiktok.com/@b/video/2");
    expect(sourceUrlValidation({ passageSource: "  ", sujetSource: null })).toBeNull();
  });
});
