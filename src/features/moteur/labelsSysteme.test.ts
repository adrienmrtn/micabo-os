import { describe, expect, it } from "vitest";

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
