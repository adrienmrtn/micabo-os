import { describe, expect, it } from "vitest";

import {
  STAGNATION_MS,
  deciderTick,
  etatDepuisRun,
  type MajSourcesRun,
} from "./majSequentielle";

const T0 = 1_000_000;
const COMPTES = [
  { id: "a", handle: "alpha", langue: "fr" },
  { id: "b", handle: "beta", langue: "fr" },
  { id: "c", handle: "gamma", langue: "fr" },
];

function run(over: Partial<MajSourcesRun> = {}): MajSourcesRun {
  return {
    statut: "running",
    comptes: COMPTES,
    index: 0,
    faits: 0,
    handle: null,
    phase: "attente",
    restant: 0,
    minRestant: null,
    dernierProgresAt: null,
    journal: [],
    ...over,
  };
}

describe("deciderTick", () => {
  it("enfile le prochain compte seulement si la file est vide", () => {
    const d = deciderTick(run(), { file: 0, pipeline: 0 }, T0);
    expect(d).toEqual({ type: "enfiler", index: 0, compte: COMPTES[0] });
  });

  it("n'enfile jamais un compte tant qu'il reste du scrape ou du pipeline", () => {
    const d = deciderTick(run({ index: 1, faits: 1 }), { file: 0, pipeline: 5 }, T0);
    expect(d.type).toBe("attendre");
    if (d.type === "attendre") expect(d.restant).toBe(5);
  });

  it("passe au compte suivant (index) une fois la file vidée", () => {
    const d = deciderTick(run({ index: 1, faits: 1 }), { file: 0, pipeline: 0 }, T0);
    expect(d).toEqual({ type: "enfiler", index: 1, compte: COMPTES[1] });
  });

  it("termine quand tous les comptes sont passés", () => {
    const d = deciderTick(run({ index: 3, faits: 3 }), { file: 0, pipeline: 0 }, T0);
    expect(d).toEqual({ type: "done" });
  });

  it("coupe si la file ne descend plus pendant le délai de stagnation", () => {
    const fige = run({ minRestant: 12, dernierProgresAt: T0, restant: 12 });
    const avant = deciderTick(fige, { file: 0, pipeline: 12 }, T0 + STAGNATION_MS - 1);
    expect(avant.type).toBe("attendre");
    const apres = deciderTick(fige, { file: 0, pipeline: 12 }, T0 + STAGNATION_MS);
    expect(apres.type).toBe("bloquee");
  });

  it("ne fait rien si la séquence n'est plus running (annulée / finie)", () => {
    expect(deciderTick(run({ statut: "cancelled" }), { file: 0, pipeline: 0 }, T0).type).toBe(
      "rien",
    );
    expect(deciderTick(run({ statut: "done" }), { file: 0, pipeline: 0 }, T0).type).toBe("rien");
  });
});

describe("etatDepuisRun — survit à la fermeture de page", () => {
  it("reconstitue l'UI depuis l'état persisté, sans session navigateur", () => {
    const persisté = run({
      index: 2,
      faits: 2,
      handle: "gamma",
      phase: "import",
      restant: 0,
    });
    // Simule un reload : plus aucun store client, seulement Postgres.
    expect(etatDepuisRun(persisté)).toEqual({
      actif: true,
      total: 3,
      faits: 2,
      handle: "gamma",
      phase: "import",
      restant: 0,
    });
  });

  it("n'affiche plus la barre une fois la séquence terminée ou annulée", () => {
    expect(etatDepuisRun(run({ statut: "done", faits: 3 })).actif).toBe(false);
    expect(etatDepuisRun(run({ statut: "cancelled", faits: 1 })).actif).toBe(false);
    expect(etatDepuisRun(null).actif).toBe(false);
  });
});
