import { describe, expect, it } from "vitest";

import { estLabelSurDemande, idsLabelsRepli } from "../../../supabase/functions/_shared/labels_repli.ts";
import {
  estLabelRetire,
  extraireLabelsAssignables,
  idsLabelsAssignables,
} from "../../../supabase/functions/_shared/labels_systeme.ts";

describe("labels système — pas d'assignation créateur", () => {
  it("retire hook du pool", () => {
    expect(
      idsLabelsAssignables([
        { id: "hook", slug: "hook" },
        { id: "study", slug: "study-aes" },
      ]),
    ).toEqual(["study"]);
  });

  it("ignore hook sur un compte au matching minuit", () => {
    const { labelIds, labelNoms } = extraireLabelsAssignables([
      { label_id: "h", labels: { nom: "Hook", slug: "hook" } },
      { label_id: "s", labels: { nom: "Study AES", slug: "study-aes" } },
    ]);
    expect(labelIds).toEqual(["s"]);
    expect(labelNoms).toEqual(["Study AES"]);
  });
});

/**
 * Le 28/09, `leon.lernen977` est né SANS label. Chaîne complète : la file admin
 * était vide, le repli prend le label le MOINS utilisé, un label retiré a zéro
 * compte, donc le repli élisait `cold_study` — et le trigger de 0273 jetait
 * l'insert en silence. Le mécanisme de retrait attirait le repli vers le label
 * retiré.
 */
describe("label retiré — jamais assignable (0277)", () => {
  it("écarte un label retiré du pool", () => {
    expect(
      idsLabelsAssignables([
        { id: "froid", slug: "cold-study", retire_le: "2026-09-24T14:20:20Z" },
        { id: "vivant", slug: "classic-study", retire_le: null },
      ]),
    ).toEqual(["vivant"]);
  });

  it("écarte aussi bien un retiré qu'un label système", () => {
    expect(
      idsLabelsAssignables([
        { id: "h", slug: "hook" },
        { id: "froid", slug: "cold-study", retire_le: "2026-09-24T14:20:20Z" },
        { id: "vivant", slug: "classic-study" },
      ]),
    ).toEqual(["vivant"]);
  });

  it("rend une liste vide plutôt qu'un label retiré", () => {
    // Le point qui compte : mieux vaut NO_LABELS, qui remonte en 409, qu'un
    // label que le trigger jettera sans rien dire.
    expect(
      idsLabelsAssignables([
        { id: "froid", slug: "cold-study", retire_le: "2026-09-24T14:20:20Z" },
      ]),
    ).toEqual([]);
  });

  it("traite l'absence de colonne comme non retiré", () => {
    // Un appelant qui oublie `retire_le` dans son select retrouve le
    // comportement d'avant 0277 : c'est documenté, pas silencieux.
    expect(idsLabelsAssignables([{ id: "x", slug: "classic-study" }])).toEqual(["x"]);
  });

  it("reconnaît un retrait sur la seule colonne retire_le", () => {
    expect(estLabelRetire({ retire_le: "2026-09-24T14:20:20Z" })).toBe(true);
    expect(estLabelRetire({ retire_le: null })).toBe(false);
    expect(estLabelRetire({})).toBe(false);
    expect(estLabelRetire(null)).toBe(false);
    expect(estLabelRetire(undefined)).toBe(false);
  });
});

/**
 * Le 06/10, `white-post` est né avec zéro compte : le repli (« le label le moins
 * utilisé dans la langue ») l'aurait donné à chaque compte créé ensuite, file
 * admin vide. Un label sur demande reste assignable à la main, jamais par le
 * repli.
 */
describe("labels sur demande — jamais tirés par le repli", () => {
  const labels = [
    { id: "classic", slug: "classic-study", retire_le: null },
    { id: "white", slug: "white-post", retire_le: null },
    { id: "hook", slug: "hook", retire_le: null },
  ];

  it("reste assignable à la main", () => {
    expect(idsLabelsAssignables(labels)).toEqual(["classic", "white"]);
  });

  it("sort du pool du repli, comme hook", () => {
    expect(idsLabelsRepli(labels)).toEqual(["classic"]);
  });

  it("rend une liste vide plutôt qu'un label sur demande", () => {
    expect(idsLabelsRepli([{ id: "white", slug: "white-post", retire_le: null }])).toEqual([]);
  });

  it("garde l'exclusion du retiré", () => {
    expect(
      idsLabelsRepli([
        { id: "old", slug: "cold-study", retire_le: "2026-09-24T16:00:00Z" },
        { id: "classic", slug: "classic-study", retire_le: null },
      ]),
    ).toEqual(["classic"]);
  });

  it("reconnaît white-post par son slug", () => {
    expect(estLabelSurDemande({ slug: "white-post" })).toBe(true);
    expect(estLabelSurDemande({ slug: "classic-study" })).toBe(false);
    expect(estLabelSurDemande(null)).toBe(false);
  });
});
