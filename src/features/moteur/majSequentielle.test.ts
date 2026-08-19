import { describe, expect, it } from "vitest";

import {
  attenteInitiale,
  avancerAttente,
  delaiSondage,
  restantFile,
} from "./majSequentielle";

const STALL = 10 * 60_000;
const T0 = 1_000_000;

describe("restantFile", () => {
  it("additionne file de scrape et pipeline", () => {
    expect(restantFile({ file: 3, pipeline: 4 })).toBe(7);
    expect(restantFile({ file: 0, pipeline: 0 })).toBe(0);
  });
});

describe("avancerAttente", () => {
  it("dit vide quand plus rien n'est en file ni en pipeline", () => {
    const { verdict } = avancerAttente(
      attenteInitiale(T0),
      { file: 0, pipeline: 0 },
      T0,
      STALL,
    );
    expect(verdict).toEqual({ type: "vide" });
  });

  it("attend tant que le total descend, même très longtemps", () => {
    let etat = attenteInitiale(T0);
    // 119 items drainés à ~6/min : bien au-delà du seuil de stagnation.
    for (let i = 0; i < 40; i += 1) {
      const pas = avancerAttente(
        etat,
        { file: 0, pipeline: 119 - i * 3 },
        T0 + i * 60_000,
        STALL,
      );
      etat = pas.etat;
      expect(pas.verdict.type).toBe("attendre");
    }
  });

  it("coupe quand le total ne descend plus pendant le délai de stagnation", () => {
    let etat = attenteInitiale(T0);
    const fige = { file: 0, pipeline: 12 };
    etat = avancerAttente(etat, fige, T0, STALL).etat;
    const avant = avancerAttente(etat, fige, T0 + STALL - 1, STALL);
    expect(avant.verdict.type).toBe("attendre");
    const apres = avancerAttente(avant.etat, fige, T0 + STALL, STALL);
    expect(apres.verdict).toEqual({ type: "bloquee", restant: 12, depuisMs: STALL });
  });

  it("une remontée du total ne relance pas le compteur de stagnation", () => {
    // Un item repris passe failed -> running : le total peut remonter sans
    // qu'aucun travail n'avance. Seule une vraie baisse compte comme progrès.
    let etat = attenteInitiale(T0);
    etat = avancerAttente(etat, { file: 0, pipeline: 10 }, T0, STALL).etat;
    etat = avancerAttente(etat, { file: 0, pipeline: 14 }, T0 + 60_000, STALL).etat;
    const pas = avancerAttente(etat, { file: 0, pipeline: 14 }, T0 + STALL, STALL);
    expect(pas.verdict.type).toBe("bloquee");
  });

  it("repart pour un tour complet dès que le total baisse à nouveau", () => {
    let etat = attenteInitiale(T0);
    etat = avancerAttente(etat, { file: 0, pipeline: 10 }, T0, STALL).etat;
    const relance = avancerAttente(etat, { file: 0, pipeline: 9 }, T0 + STALL - 1, STALL);
    expect(relance.verdict.type).toBe("attendre");
    const suite = avancerAttente(
      relance.etat,
      { file: 0, pipeline: 9 },
      T0 + STALL + 1,
      STALL,
    );
    expect(suite.verdict.type).toBe("attendre");
  });

  it("compte aussi les scrapes en file, pas seulement le pipeline", () => {
    const { verdict } = avancerAttente(
      attenteInitiale(T0),
      { file: 5, pipeline: 0 },
      T0,
      STALL,
    );
    expect(verdict).toEqual({ type: "attendre", restant: 5 });
  });
});

describe("delaiSondage", () => {
  it("sonde plus souvent en fin de file", () => {
    expect(delaiSondage(4)).toBe(10_000);
    expect(delaiSondage(20)).toBe(10_000);
    expect(delaiSondage(120)).toBe(20_000);
  });
});
