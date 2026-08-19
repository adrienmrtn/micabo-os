import { describe, expect, it } from "vitest";

import {
  MAX_TENTATIVES_NETTOYAGE,
  fileNettoyage,
  nettoyageTermine,
  prochainesSlidesANettoyer,
  slidesEpuisees,
  tentativesSlide,
} from "./nettoyageFile";

const slide = (
  position: number,
  media_id: string | null = null,
  tentatives?: number,
) => ({ position, media_id, tentatives });

describe("tentativesSlide", () => {
  it("traite l’absence de compteur comme zéro", () => {
    expect(tentativesSlide(slide(0))).toBe(0);
    expect(tentativesSlide(slide(0, null, 3))).toBe(3);
  });

  it("ignore les valeurs aberrantes venues du JSONB", () => {
    expect(tentativesSlide({ position: 0, media_id: null, tentatives: -2 })).toBe(0);
    expect(
      tentativesSlide({
        position: 0,
        media_id: null,
        tentatives: Number.NaN,
      }),
    ).toBe(0);
    expect(tentativesSlide({ position: 0, media_id: null, tentatives: 2.7 })).toBe(2);
  });
});

describe("fileNettoyage", () => {
  it("ne garde que les slides sans média", () => {
    const slides = [slide(0, "m0"), slide(1), slide(2, "m2"), slide(3)];
    expect(fileNettoyage(slides).map((s) => s.position)).toEqual([1, 3]);
  });

  it("sert la moins tentée d’abord — une slide capricieuse ne bloque plus le diaporama", () => {
    const slides = [slide(0, null, 3), slide(1), slide(2, null, 1)];
    expect(fileNettoyage(slides).map((s) => s.position)).toEqual([1, 2, 0]);
  });

  it("départage par position à nombre de tentatives égal", () => {
    const slides = [slide(4, null, 1), slide(2, null, 1), slide(3, null, 1)];
    expect(fileNettoyage(slides).map((s) => s.position)).toEqual([2, 3, 4]);
  });
});

describe("prochainesSlidesANettoyer", () => {
  it("limite le nombre de slides par passage", () => {
    const slides = [slide(0), slide(1), slide(2)];
    expect(prochainesSlidesANettoyer(slides, 1).map((s) => s.position)).toEqual([0]);
    expect(prochainesSlidesANettoyer(slides, 2).map((s) => s.position)).toEqual([0, 1]);
  });

  it("écarte les slides à bout d’essais au lieu de les rejouer sans fin", () => {
    const slides = [slide(0, null, MAX_TENTATIVES_NETTOYAGE), slide(1)];
    expect(prochainesSlidesANettoyer(slides, 1).map((s) => s.position)).toEqual([1]);
  });

  it("ne renvoie rien quand tout est nettoyé ou épuisé", () => {
    const slides = [slide(0, "m0"), slide(1, null, MAX_TENTATIVES_NETTOYAGE)];
    expect(prochainesSlidesANettoyer(slides, 2)).toEqual([]);
  });

  it("borne le passage à zéro slide sur une taille négative", () => {
    expect(prochainesSlidesANettoyer([slide(0)], -1)).toEqual([]);
  });
});

describe("slidesEpuisees", () => {
  it("remonte les slides à traiter en repli brut", () => {
    const slides = [
      slide(0, null, MAX_TENTATIVES_NETTOYAGE),
      slide(1, null, MAX_TENTATIVES_NETTOYAGE - 1),
      slide(2, "m2", MAX_TENTATIVES_NETTOYAGE),
    ];
    expect(slidesEpuisees(slides).map((s) => s.position)).toEqual([0]);
  });
});

describe("boucle de nettoyage : la file finit toujours par se vider", () => {
  it("épuise une slide qui échoue en MAX_TENTATIVES passages, puis passe à la suivante", () => {
    const slides = [slide(0), slide(1)];
    const echecs = new Set([0]);
    const tentees: number[] = [];

    // Un passage = ce que fait `avancerImport` : compteur AVANT le provider,
    // puis media_id si le nettoyage a rendu quelque chose.
    for (let passage = 0; passage < 20; passage += 1) {
      for (const s of slidesEpuisees(slides)) s.media_id = `brut-${s.position}`;
      for (const s of prochainesSlidesANettoyer(slides, 1)) {
        s.tentatives = tentativesSlide(s) + 1;
        tentees.push(s.position);
        if (!echecs.has(s.position)) s.media_id = `propre-${s.position}`;
      }
      if (nettoyageTermine(slides)) break;
    }

    expect(nettoyageTermine(slides)).toBe(true);
    expect(slides[0].media_id).toBe("brut-0");
    expect(slides[1].media_id).toBe("propre-1");
    // La slide saine n’attend pas les 4 échecs de la slide 0 pour passer.
    expect(tentees.indexOf(1)).toBe(1);
    expect(tentees.filter((p) => p === 0)).toHaveLength(MAX_TENTATIVES_NETTOYAGE);
  });

  it("termine même si toutes les slides échouent", () => {
    const slides = [slide(0), slide(1), slide(2)];
    let appels = 0;

    for (let passage = 0; passage < 50; passage += 1) {
      for (const s of slidesEpuisees(slides)) s.media_id = `brut-${s.position}`;
      for (const s of prochainesSlidesANettoyer(slides, 1)) {
        s.tentatives = tentativesSlide(s) + 1;
        appels += 1;
      }
      if (nettoyageTermine(slides)) break;
    }

    expect(nettoyageTermine(slides)).toBe(true);
    expect(appels).toBe(3 * MAX_TENTATIVES_NETTOYAGE);
  });

  it("ne rejoue pas indéfiniment une slide dont le worker meurt avant l’écriture du média", () => {
    // Reproduit le bug : le compteur est écrit APRÈS l'appel provider, donc un
    // worker tué au mur Edge ne laisse aucune trace.
    const slides = [slide(0), slide(1)];
    const tenteesSansCompteur: number[] = [];
    for (let passage = 0; passage < 6; passage += 1) {
      const cible = slides.filter((s) => !s.media_id)[0];
      if (!cible) break;
      tenteesSansCompteur.push(cible.position);
      // worker tué : ni media_id ni tentatives persistés
    }
    expect(new Set(tenteesSansCompteur)).toEqual(new Set([0]));

    // Avec le compteur write-ahead, la même slide sort de la file.
    const tenteesAvecCompteur: number[] = [];
    for (let passage = 0; passage < 6; passage += 1) {
      for (const s of slidesEpuisees(slides)) s.media_id = `brut-${s.position}`;
      const cible = prochainesSlidesANettoyer(slides, 1)[0];
      if (!cible) break;
      cible.tentatives = tentativesSlide(cible) + 1;
      tenteesAvecCompteur.push(cible.position);
    }
    expect(tenteesAvecCompteur).toContain(1);
  });
});
