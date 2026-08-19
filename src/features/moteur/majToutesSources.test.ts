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
    maxFaits: null,
    dernierProgresAt: null,
    journal: [],
    ...over,
  };
}

const m = (file: number, pipeline: number, faits = 0) => ({ file, pipeline, faits });

describe("deciderTick", () => {
  it("enfile le prochain compte seulement si la file est vide", () => {
    const d = deciderTick(run(), m(0, 0), T0);
    expect(d).toEqual({ type: "enfiler", index: 0, compte: COMPTES[0] });
  });

  it("n'enfile jamais un compte tant qu'il reste du scrape ou du pipeline", () => {
    const d = deciderTick(run({ index: 1, faits: 1 }), m(0, 5), T0);
    expect(d.type).toBe("attendre");
    if (d.type === "attendre") expect(d.restant).toBe(5);
  });

  it("passe au compte suivant (index) une fois la file vidée", () => {
    const d = deciderTick(run({ index: 1, faits: 1 }), m(0, 0), T0);
    expect(d).toEqual({ type: "enfiler", index: 1, compte: COMPTES[1] });
  });

  it("termine quand tous les comptes sont passés", () => {
    const d = deciderTick(run({ index: 3, faits: 3 }), m(0, 0), T0);
    expect(d).toEqual({ type: "done" });
  });

  it("laisse passer un scrape en cours dont le reste ne bouge pas", () => {
    // Régression 19/08 : 239 scrapes se transformaient en 239 pipelines, total
    // constant. L'ancien garde-fou coupait la séquence à 13/21 pour rien.
    const enCours = run({
      index: 1,
      faits: 1,
      minRestant: 239,
      maxFaits: 2500,
      dernierProgresAt: T0,
      restant: 239,
    });
    const d = deciderTick(enCours, m(100, 139, 2639), T0 + STAGNATION_MS + 60_000);
    expect(d.type).toBe("attendre");
  });

  it("coupe si rien ne descend et rien ne s'achève", () => {
    const fige = run({
      minRestant: 12,
      maxFaits: 500,
      dernierProgresAt: T0,
      restant: 12,
    });
    const avant = deciderTick(fige, m(0, 12, 500), T0 + STAGNATION_MS - 1);
    expect(avant.type).toBe("attendre");
    const apres = deciderTick(fige, m(0, 12, 500), T0 + STAGNATION_MS);
    expect(apres.type).toBe("bloquee");
  });

  it("ne fait rien si la séquence n'est plus running (annulée / finie)", () => {
    expect(deciderTick(run({ statut: "cancelled" }), m(0, 0), T0).type).toBe("rien");
    expect(deciderTick(run({ statut: "done" }), m(0, 0), T0).type).toBe("rien");
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
