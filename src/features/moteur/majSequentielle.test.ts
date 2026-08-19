import { describe, expect, it } from "vitest";

import {
  attenteInitiale,
  avancerAttente,
  delaiSondage,
  restantFile,
} from "./majSequentielle";

const STALL = 20 * 60_000;
const T0 = 1_000_000;

/** Raccourci : mesure sans achevé (cas où seul le reste bouge). */
const m = (file: number, pipeline: number, faits = 0) => ({ file, pipeline, faits });

describe("restantFile", () => {
  it("additionne file de scrape et pipeline", () => {
    expect(restantFile(m(3, 4))).toBe(7);
    expect(restantFile(m(0, 0))).toBe(0);
  });
});

describe("avancerAttente", () => {
  it("dit vide quand plus rien n'est en file ni en pipeline", () => {
    const { verdict } = avancerAttente(attenteInitiale(T0), m(0, 0, 100), T0, STALL);
    expect(verdict).toEqual({ type: "vide" });
  });

  it("attend tant que le total descend, même très longtemps", () => {
    let etat = attenteInitiale(T0);
    for (let i = 0; i < 40; i += 1) {
      const pas = avancerAttente(etat, m(0, 119 - i * 3, i * 3), T0 + i * 60_000, STALL);
      etat = pas.etat;
      expect(pas.verdict.type).toBe("attendre");
    }
  });

  it("le reste figé n'est PAS un blocage si du travail s'achève", () => {
    // Le cas du 19/08 : 239 scrapes qui deviennent 239 pipelines, un par un.
    // Le reste ne bouge pas d'un poil, mais le serveur travaille à plein.
    let etat = attenteInitiale(T0);
    for (let i = 0; i < 45; i += 1) {
      const pas = avancerAttente(
        etat,
        // file → pipeline, total constant à 239, achevé qui grimpe.
        m(239 - i * 5, i * 5, 2500 + i * 5),
        T0 + i * 60_000,
        STALL,
      );
      etat = pas.etat;
      expect(pas.verdict).toEqual({ type: "attendre", restant: 239 });
    }
  });

  it("coupe quand rien ne descend ET rien ne s'achève", () => {
    let etat = attenteInitiale(T0);
    const fige = m(0, 12, 500);
    etat = avancerAttente(etat, fige, T0, STALL).etat;
    const avant = avancerAttente(etat, fige, T0 + STALL - 1, STALL);
    expect(avant.verdict.type).toBe("attendre");
    const apres = avancerAttente(avant.etat, fige, T0 + STALL, STALL);
    expect(apres.verdict).toEqual({ type: "bloquee", restant: 12, depuisMs: STALL });
  });

  it("une remontée du reste sans travail achevé ne relance pas le compteur", () => {
    // Un item repris passe failed -> running : le total remonte sans qu'aucun
    // travail n'avance.
    let etat = attenteInitiale(T0);
    etat = avancerAttente(etat, m(0, 10, 500), T0, STALL).etat;
    etat = avancerAttente(etat, m(0, 14, 500), T0 + 60_000, STALL).etat;
    const pas = avancerAttente(etat, m(0, 14, 500), T0 + STALL, STALL);
    expect(pas.verdict.type).toBe("bloquee");
  });

  it("repart pour un tour complet dès qu'un travail s'achève", () => {
    let etat = attenteInitiale(T0);
    etat = avancerAttente(etat, m(0, 10, 500), T0, STALL).etat;
    const relance = avancerAttente(etat, m(0, 10, 501), T0 + STALL - 1, STALL);
    expect(relance.verdict.type).toBe("attendre");
    const suite = avancerAttente(relance.etat, m(0, 10, 501), T0 + STALL + 1, STALL);
    expect(suite.verdict.type).toBe("attendre");
  });

  it("compte aussi les scrapes en file, pas seulement le pipeline", () => {
    const { verdict } = avancerAttente(attenteInitiale(T0), m(5, 0), T0, STALL);
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
