import { describe, expect, it } from "vitest";

import {
  agregerEssaiCompte,
  compteEnEssai,
  ESSAI_DUREE_MS,
  essaiEndsAt,
  essaiRestantMs,
  estLignePubliee,
  formaterCountdownEssai,
  joursQuotaEssai,
  postsDusEssai,
  type LignePublicationEssai,
} from "./essai";

const CREATED = "2026-09-04T08:00:00.000Z"; // 10:00 Paris (CEST)

function ligne(p: Partial<LignePublicationEssai> & { postId: string }): LignePublicationEssai {
  return {
    compteId: "c1",
    passageId: p.passageId ?? null,
    statut: p.statut ?? "publie",
    publieUrl:
      p.publieUrl === undefined
        ? `https://www.tiktok.com/@x/video/${p.postId}`
        : p.publieUrl,
    publieAt: p.publieAt ?? "2026-09-05T10:00:00.000Z",
    createdAt: p.createdAt ?? "2026-09-05T09:00:00.000Z",
    vues: p.vues ?? 100,
    likes: p.likes ?? 10,
    commentaires: p.commentaires ?? 1,
    partages: p.partages ?? 2,
    sourceUrl: p.sourceUrl ?? "https://www.tiktok.com/@ref/video/1",
    titre: p.titre ?? "Hook",
    postId: p.postId,
  };
}

describe("compteEnEssai", () => {
  it("est vrai pendant 5 × 24 h depuis la création", () => {
    const now = new Date("2026-09-08T08:00:00.000Z");
    expect(compteEnEssai(CREATED, now)).toBe(true);
    expect(compteEnEssai(CREATED, new Date("2026-09-09T07:59:59.000Z"))).toBe(true);
    expect(compteEnEssai(CREATED, new Date("2026-09-09T08:00:00.000Z"))).toBe(false);
  });

  it("rejette une date absente ou invalide", () => {
    expect(compteEnEssai(null)).toBe(false);
    expect(compteEnEssai("nope")).toBe(false);
  });
});

describe("essaiEndsAt / essaiRestantMs", () => {
  it("pose la fin à created_at + 5 jours", () => {
    expect(essaiEndsAt(CREATED).toISOString()).toBe("2026-09-09T08:00:00.000Z");
    expect(essaiRestantMs(CREATED, new Date(CREATED))).toBe(ESSAI_DUREE_MS);
    expect(essaiRestantMs(CREATED, new Date("2026-09-09T08:00:00.000Z"))).toBe(0);
  });
});

describe("formaterCountdownEssai", () => {
  it("affiche jours + heures, puis heures + minutes", () => {
    expect(formaterCountdownEssai(5 * 86_400_000)).toBe("5 j 00 h");
    expect(formaterCountdownEssai(2 * 86_400_000 + 3 * 3_600_000)).toBe("2 j 03 h");
    expect(formaterCountdownEssai(90 * 60_000)).toBe("1 h 30 min");
    expect(formaterCountdownEssai(45 * 60_000)).toBe("45 min");
  });
});

describe("joursQuotaEssai", () => {
  it("compte les jours Paris inclusifs, capés à 5", () => {
    const created = new Date(CREATED);
    expect(joursQuotaEssai(created, new Date("2026-09-04T12:00:00.000Z"))).toBe(1);
    expect(joursQuotaEssai(created, new Date("2026-09-06T12:00:00.000Z"))).toBe(3);
    expect(joursQuotaEssai(created, new Date("2026-09-08T12:00:00.000Z"))).toBe(5);
    // 6ᵉ jour calendaire encore dans la fenêtre 120 h → cap 5
    expect(joursQuotaEssai(created, new Date("2026-09-09T07:00:00.000Z"))).toBe(5);
  });
});

describe("postsDusEssai", () => {
  it("quota 1–3 × jours", () => {
    expect(postsDusEssai(1, 3)).toBe(3);
    expect(postsDusEssai(2, 5)).toBe(10);
    expect(postsDusEssai(9, 2)).toBe(6);
    expect(postsDusEssai(0, 4)).toBe(4);
  });
});

describe("estLignePubliee", () => {
  it("accepte statut publie ou un lien TikTok", () => {
    expect(estLignePubliee(ligne({ postId: "a", statut: "publie", publieUrl: null }))).toBe(true);
    expect(
      estLignePubliee(
        ligne({ postId: "b", statut: "assigne", publieUrl: "https://www.tiktok.com/@x/video/1" }),
      ),
    ).toBe(true);
    expect(estLignePubliee(ligne({ postId: "c", statut: "assigne", publieUrl: null }))).toBe(false);
  });
});

describe("agregerEssaiCompte", () => {
  const now = new Date("2026-09-08T12:00:00.000Z");

  it("déduplique les passages d'un même post et somme les stats", () => {
    const out = agregerEssaiCompte(
      CREATED,
      1,
      [
        ligne({ postId: "p1", passageId: "a", vues: 10, likes: 1, publieAt: "2026-09-05T10:00:00.000Z" }),
        ligne({
          postId: "p1",
          passageId: "b",
          vues: 40,
          likes: 4,
          publieAt: "2026-09-05T11:00:00.000Z",
        }),
        ligne({ postId: "p2", vues: 5, likes: 2, publieAt: "2026-09-06T10:00:00.000Z" }),
        ligne({
          postId: "ignore",
          statut: "assigne",
          publieUrl: null,
          vues: 999,
        }),
      ],
      now,
    );
    expect(out.publies).toBe(2);
    expect(out.dus).toBe(5);
    expect(out.vues).toBe(45);
    expect(out.likes).toBe(6);
    expect(out.derniers.map((d) => d.postId)).toEqual(["p2", "p1"]);
  });

  it("ignore un publié antérieur à la création du compte", () => {
    const out = agregerEssaiCompte(
      CREATED,
      2,
      [ligne({ postId: "old", publieAt: "2026-09-01T10:00:00.000Z", vues: 80 })],
      now,
    );
    expect(out.publies).toBe(0);
    expect(out.vues).toBe(0);
    expect(out.dus).toBe(10);
  });

  it("garde au plus 3 derniers TikToks avec lien", () => {
    const lignes = [1, 2, 3, 4].map((n) =>
      ligne({
        postId: `p${n}`,
        publieAt: `2026-09-0${4 + n}T10:00:00.000Z`,
        titre: `T${n}`,
      }),
    );
    const out = agregerEssaiCompte(CREATED, 1, lignes, now);
    expect(out.publies).toBe(4);
    expect(out.derniers).toHaveLength(3);
    expect(out.derniers.map((d) => d.postId)).toEqual(["p4", "p3", "p2"]);
  });
});
