import { describe, expect, it } from "vitest";

import {
  bilanCycle,
  CYCLE_TIMEOUT_JOURS,
  jourRepostBonus,
  MESURE_JOURS,
  PASSAGE_PERIME_JOURS,
  RATTRAPAGE_JOURS_DEFAUT,
  RECUL_MEME_COMPTE_JOURS,
  REPOST_BONUS_JOURS,
  passageMesure,
  passagePerime,
  passageRegle,
} from "./tierlist";

const JOUR_MS = 86_400_000;
const maintenant = Date.parse("2026-09-11T12:00:00Z");
const ilYA = (jours: number) => new Date(maintenant - jours * JOUR_MS).toISOString();
/** Jour Paris (yyyy-mm-dd) d'il y a `jours` jours. */
const jour = (jours: number) => ilYA(jours).slice(0, 10);

/** Publié il y a `depuis` jours, vues relevées. */
const mesure = (depuis: number, vues: number) => ({
  statut: "publie",
  publie_at: ilYA(depuis),
  vues,
  date_publication_prevue: jour(depuis),
});
/** Assigné sur un créneau vieux de `depuis` jours, jamais publié. */
const noShow = (depuis: number) => ({
  statut: "assigne",
  publie_at: null,
  vues: null,
  date_publication_prevue: jour(depuis),
});

describe("passageMesure", () => {
  it("attend MESURE_JOURS après la publication", () => {
    const p = { statut: "publie", publie_at: ilYA(MESURE_JOURS - 1), vues: 4200 };
    expect(passageMesure(p, maintenant)).toBe(false);
    expect(passageMesure({ ...p, publie_at: ilYA(MESURE_JOURS) }, maintenant)).toBe(true);
  });

  it("exige des vues relevées", () => {
    expect(
      passageMesure({ statut: "publie", publie_at: ilYA(5), vues: null }, maintenant),
    ).toBe(false);
  });

  it("ignore un passage non publié", () => {
    expect(
      passageMesure({ statut: "assigne", publie_at: null, vues: null }, maintenant),
    ).toBe(false);
  });
});

describe("jourRepostBonus", () => {
  it("tombe 7 jours après la publication", () => {
    expect(jourRepostBonus("2026-09-04T18:00:00Z", "2026-09-06")).toBe("2026-09-11");
  });

  it("repousse à demain si J+7 est déjà passé (stats relevées tard)", () => {
    expect(jourRepostBonus("2026-08-20T10:00:00Z", "2026-09-11")).toBe("2026-09-12");
  });

  it("part d'aujourd'hui quand la date de publication manque", () => {
    expect(jourRepostBonus(null, "2026-09-11")).toBe("2026-09-18");
  });
});

describe("passagePerime / passageRegle", () => {
  it("ne périme pas un passage mesuré", () => {
    const p = mesure(6, 4_200);
    expect(passageMesure(p, maintenant)).toBe(true);
    expect(passagePerime(p, maintenant)).toBe(false);
    expect(passageRegle(p, maintenant)).toBe(true);
  });

  it("laisse le cycle attendre un passage encore en vol", () => {
    // Le créateur a encore son créneau.
    expect(passageRegle(noShow(1), maintenant)).toBe(false);
    // Publié hier : vues pas stabilisées, on attend MESURE_JOURS.
    expect(passageRegle(mesure(1, 800), maintenant)).toBe(false);
  });

  it("périme un passage jamais publié passé le délai", () => {
    expect(passagePerime(noShow(PASSAGE_PERIME_JOURS - 1), maintenant)).toBe(false);
    expect(passagePerime(noShow(PASSAGE_PERIME_JOURS + 1), maintenant)).toBe(true);
  });

  it("périme un passage publié que le relevé n'a jamais accroché", () => {
    const sansVues = (depuis: number) => ({ ...mesure(depuis, 0), vues: null });
    // Encore dans la fenêtre de scrape (4 j) : on attend.
    expect(passagePerime(sansVues(PASSAGE_PERIME_JOURS - 1), maintenant)).toBe(false);
    expect(passagePerime(sansVues(PASSAGE_PERIME_JOURS + 1), maintenant)).toBe(true);
  });

  it("ne périme jamais un passage sans créneau ni publication", () => {
    const orphelin = {
      statut: "brouillon",
      publie_at: null,
      vues: null,
      date_publication_prevue: null,
    };
    expect(passagePerime(orphelin, maintenant)).toBe(false);
    expect(passageRegle(orphelin, maintenant)).toBe(false);
  });
});

describe("bilanCycle", () => {
  it("clôt un cycle dont tous les passages sont mesurés", () => {
    const b = bilanCycle([mesure(4, 1_000), mesure(5, 3_000)], 2, maintenant);
    expect(b).toEqual({ mesures: 2, perimes: 0, clos: true, m: 2_000 });
  });

  it("clôt malgré un créateur qui n'a jamais posté", () => {
    // Le cas qui gelait un slideshow 14 jours : 1 passage sur 2 avait rendu.
    const b = bilanCycle([mesure(4, 5_000), noShow(PASSAGE_PERIME_JOURS + 2)], 2, maintenant);
    expect(b.clos).toBe(true);
    expect(b.perimes).toBe(1);
    // Un périmé ne vaut pas zéro vue : il ne pèse pas dans la moyenne.
    expect(b.m).toBe(5_000);
  });

  it("attend un passage encore en vol", () => {
    expect(bilanCycle([mesure(4, 5_000), mesure(1, 900)], 2, maintenant).clos).toBe(false);
    expect(bilanCycle([mesure(4, 5_000), noShow(0)], 2, maintenant).clos).toBe(false);
  });

  it("attend tant que le cycle n'est pas rempli", () => {
    expect(bilanCycle([mesure(4, 5_000)], 2, maintenant).clos).toBe(false);
  });

  it("clôt un cycle entièrement périmé, sans moyenne", () => {
    // m null → tier inchangé et cycle rouvert : le slideshow repart.
    const b = bilanCycle([noShow(9), noShow(8)], 2, maintenant);
    expect(b).toEqual({ mesures: 0, perimes: 2, clos: true, m: null });
  });

  it("ne bloque pas sur un cycle qui a débordé la cible", () => {
    const b = bilanCycle([mesure(4, 1_000), mesure(5, 1_000), mesure(6, 4_000)], 2, maintenant);
    expect(b.clos).toBe(true);
    expect(b.mesures).toBe(3);
    expect(b.m).toBe(2_000);
  });
});

/**
 * Ces trois constantes ne sont pas indépendantes, et le vérifier coûte moins
 * cher que de s'en apercevoir sur la tierlist.
 *
 * Le 17/09/2026, descendre la fenêtre de scrape à 2 jours en gardant
 * MESURE_JOURS = 2 aurait fait lire, à J+2, une valeur de vues figée à J+1 : le
 * post sort de la fenêtre de relevé avant d'être mesuré. Sur la courbe du
 * projet (médianes 1 073 à J+1 contre 1 491 à J+2) c'est ~72 % du réel, et la
 * bande C/B étant à 1 000 vues pile, tout ce qui vit entre 1 000 et 1 491
 * basculait en C — le palier dont `prioriserTiersHauts` ne fait jamais
 * remonter personne.
 */
describe("invariants des délais", () => {
  it("relève encore le post au moment où on le mesure", () => {
    // Sinon `vues` est figé avant l'échéance de mesure : on juge sur du vieux.
    expect(RATTRAPAGE_JOURS_DEFAUT).toBeGreaterThan(MESURE_JOURS);
  });

  it("ne périme pas un passage qu'on est encore en train de relever", () => {
    expect(PASSAGE_PERIME_JOURS).toBeGreaterThan(RATTRAPAGE_JOURS_DEFAUT);
  });

  it("laisse le timeout de cycle au-dessus de tout le reste", () => {
    // Le filet des cycles qui traînent doit rester le dernier recours.
    expect(CYCLE_TIMEOUT_JOURS).toBeGreaterThan(PASSAGE_PERIME_JOURS);
  });
});

/**
 * Un slideshow qui revient sur le même compte est soit une décision, soit un
 * bug. Le 19/09/2026 c'était un bug : la fenêtre anti-doublon ne couvrait que
 * le jour même, et 46 posts sont repartis en ligne à l'identique.
 */
describe("retour d'un slideshow sur le même compte", () => {
  it("laisse le repost bonus rester le seul répéteur délibéré", () => {
    // Le repost bonus rejoue volontairement à J+7 (> 50 000 vues, tracé par
    // `bonus_repost`). Si le tirage ordinaire pouvait produire la même
    // répétition au même moment, un doublon ne serait plus lisible en base.
    expect(RECUL_MEME_COMPTE_JOURS).toBeGreaterThan(REPOST_BONUS_JOURS);
  });

  it("couvre plus que le cycle le plus long", () => {
    // Un cycle qui traîne est requalifié de force à 14 jours ; le recul doit
    // survivre à ce délai, sinon un slideshow peut revenir avant d'être jugé.
    expect(RECUL_MEME_COMPTE_JOURS).toBeGreaterThan(CYCLE_TIMEOUT_JOURS);
  });
});
