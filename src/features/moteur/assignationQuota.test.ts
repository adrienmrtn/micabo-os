import { describe, expect, it } from "vitest";

import {
  estErreurQuotaPostsJour,
  idsPostsHorsQuota,
  manquantsJusquaQuota,
  quotaPostsParJour,
} from "./assignationQuota";

describe("quotaPostsParJour", () => {
  it("borne à 1–3", () => {
    expect(quotaPostsParJour(2)).toBe(2);
    expect(quotaPostsParJour(1)).toBe(1);
    expect(quotaPostsParJour(4)).toBe(3);
    expect(quotaPostsParJour(0)).toBe(1);
    expect(quotaPostsParJour(null)).toBe(1);
  });
});

describe("manquantsJusquaQuota", () => {
  it("complète jusqu'au quota, sans doubler", () => {
    expect(manquantsJusquaQuota(2, 0)).toBe(2);
    expect(manquantsJusquaQuota(2, 2)).toBe(0);
    expect(manquantsJusquaQuota(2, 4)).toBe(0);
    expect(manquantsJusquaQuota(1, 0)).toBe(1);
    expect(manquantsJusquaQuota(2, 2, true)).toBe(1);
  });
});

describe("idsPostsHorsQuota", () => {
  const p = (id: string, statut: string, created_at: string) => ({
    id,
    statut,
    created_at,
  });

  it("garde 2 plus anciens si rien n'est publié", () => {
    expect(
      idsPostsHorsQuota(
        [
          p("a", "assigne", "2026-09-07T22:00:19Z"),
          p("b", "assigne", "2026-09-07T22:00:20Z"),
          p("c", "assigne", "2026-09-07T22:00:24Z"),
          p("d", "assigne", "2026-09-07T22:00:24Z"),
        ],
        2,
      ),
    ).toEqual(["c", "d"]);
  });

  it("garde les publiés puis le plus ancien assigné", () => {
    expect(
      idsPostsHorsQuota(
        [
          p("old", "assigne", "2026-09-07T22:00:10Z"),
          p("pub", "publie", "2026-09-07T22:00:30Z"),
          p("mid", "assigne", "2026-09-07T22:00:20Z"),
          p("new", "assigne", "2026-09-07T22:00:40Z"),
        ],
        2,
      ),
    ).toEqual(["mid", "new"]);
  });

  it("ne retire jamais un publié au-delà du quota", () => {
    expect(
      idsPostsHorsQuota(
        [
          p("p1", "publie", "2026-09-08T08:00:00Z"),
          p("p2", "publie", "2026-09-08T09:00:00Z"),
          p("a", "assigne", "2026-09-07T22:00:00Z"),
        ],
        2,
      ),
    ).toEqual(["a"]);
  });
});

describe("estErreurQuotaPostsJour", () => {
  it("reconnaît l'erreur SQL de course", () => {
    expect(estErreurQuotaPostsJour({ message: "quota_posts_jour 2/2" })).toBe(true);
    expect(estErreurQuotaPostsJour(new Error("FK violation"))).toBe(false);
  });
});
