import { describe, expect, it } from "vitest";

import {
  corpsAssignationUgcVideoTest,
  ignorerFiltresCompteUgcVideo,
} from "./corpsAssignationUgcVideoTest";

describe("corpsAssignationUgcVideoTest", () => {
  it("envoie libre + reactionId pour le test créateur + réaction", () => {
    expect(
      corpsAssignationUgcVideoTest({
        date: "2026-08-15",
        compteId: "341960f2-aaaa",
        libre: true,
        reactionId: "reac-uuid",
      }),
    ).toMatchObject({
      test: true,
      forcer: true,
      libre: true,
      reactionId: "reac-uuid",
      compteId: "341960f2-aaaa",
    });
  });

  it("reste libre même sans reaction (compte ciblé en test)", () => {
    const body = corpsAssignationUgcVideoTest({
      date: "2026-08-15",
      compteId: "abc",
      libre: true,
    });
    expect(body.libre).toBe(true);
    expect(body.reactionId).toBeUndefined();
  });
});

describe("ignorerFiltresCompteUgcVideo", () => {
  it("skip filtres en test sur un compte précis", () => {
    expect(
      ignorerFiltresCompteUgcVideo({ test: true, compteId: "341960f2" }),
    ).toBe(true);
  });

  it("garde les filtres en prod batch", () => {
    expect(ignorerFiltresCompteUgcVideo({ test: false, compteId: null })).toBe(
      false,
    );
  });
});
