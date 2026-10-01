import { describe, expect, it } from "vitest";

import {
  DELAI_MIN_RELEVE_MS,
  estApifyEpuise,
  metricsAScraper,
  passageARelever,
  POSTS_RELEVES,
  POSTS_RELEVES_MAX,
  profondeurScrape,
  RAFRAICHIR_APRES_MS,
  RELEVE_ECHECS_MAX,
  RELEVE_FIGE_APRES_JOURS,
  repliAutorise,
  type PassageReleve,
} from "./releveFile";
import { MESURE_JOURS, PASSAGE_PERIME_JOURS } from "./tierlist";

const HEURE_MS = 3_600_000;
const JOUR_MS = 24 * HEURE_MS;
const maintenant = Date.parse("2026-10-01T22:05:00Z");
const ilYA = (ms: number) => new Date(maintenant - ms).toISOString();

/** Publié il y a `jours` jours, dernier relevé il y a `releve` ms (null = jamais). */
const passage = (jours: number, releve: number | null, extra: Partial<PassageReleve> = {}): PassageReleve => ({
  publie_at: ilYA(jours * JOUR_MS),
  date_publication_prevue: ilYA(jours * JOUR_MS).slice(0, 10),
  stats_maj_at: releve == null ? null : ilYA(releve),
  ...extra,
});

describe("bornes du relevé", () => {
  it("fige un passage après la péremption et la mesure, jamais avant", () => {
    // Un passage qu'on peut encore déclarer périmé doit pouvoir être mesuré,
    // et le chiffre lu à J+2 par la requalification doit être frais.
    expect(RELEVE_FIGE_APRES_JOURS).toBeGreaterThan(PASSAGE_PERIME_JOURS);
    expect(RELEVE_FIGE_APRES_JOURS).toBeGreaterThan(MESURE_JOURS);
  });

  it("rafraîchit entre deux passes de minuit, jamais entre minuit et 13:00", () => {
    // 13 h séparent la passe de minuit de celle de 13:00 Paris : en dessous,
    // la seconde re-scraperait tout ce que la première vient de mesurer.
    expect(RAFRAICHIR_APRES_MS).toBeGreaterThan(13 * HEURE_MS);
    // Au-dessus de 24 h moins la durée d'un drain, la passe de minuit
    // suivante raterait ce qui est dû.
    expect(RAFRAICHIR_APRES_MS).toBeLessThanOrEqual(23 * HEURE_MS);
  });
});

describe("passageARelever", () => {
  it("laisse mûrir un post publié il y a moins de 45 min", () => {
    const p = { ...passage(0, null), publie_at: ilYA(DELAI_MIN_RELEVE_MS - 60_000) };
    expect(passageARelever(p, maintenant)).toBe(false);
  });

  it("relève un passage jamais mesuré", () => {
    expect(passageARelever(passage(1, null), maintenant)).toBe(true);
  });

  it("re-mesure un passage récent relevé il y a plus de 20 h, pas avant", () => {
    expect(passageARelever(passage(3, 21 * HEURE_MS), maintenant)).toBe(true);
    expect(passageARelever(passage(3, 10 * HEURE_MS), maintenant)).toBe(false);
  });

  it("fige un passage mesuré publié depuis plus de RELEVE_FIGE_APRES_JOURS", () => {
    expect(passageARelever(passage(RELEVE_FIGE_APRES_JOURS + 1, 2 * JOUR_MS), maintenant)).toBe(false);
    expect(passageARelever(passage(RELEVE_FIGE_APRES_JOURS - 1, 2 * JOUR_MS), maintenant)).toBe(true);
  });

  it("continue de chercher un vieux passage jamais mesuré, jusqu'au plafond d'échecs", () => {
    expect(passageARelever(passage(20, null), maintenant)).toBe(true);
    expect(passageARelever(passage(20, null, { stats_echecs: RELEVE_ECHECS_MAX }), maintenant)).toBe(false);
    expect(passageARelever(passage(1, null, { stats_echecs: RELEVE_ECHECS_MAX }), maintenant)).toBe(false);
  });

  it("ne retente pas un passage essayé depuis moins de 20 h", () => {
    const p = passage(1, null, { stats_echecs: 1, stats_tentative_at: ilYA(5 * HEURE_MS) });
    expect(passageARelever(p, maintenant)).toBe(false);
    expect(passageARelever({ ...p, stats_tentative_at: ilYA(21 * HEURE_MS) }, maintenant)).toBe(true);
  });

  it("date un passage sans publie_at par son créneau prévu", () => {
    const p: PassageReleve = { publie_at: null, date_publication_prevue: "2026-09-20", stats_maj_at: ilYA(2 * JOUR_MS) };
    expect(passageARelever(p, maintenant)).toBe(false);
  });
});

describe("repliAutorise", () => {
  it("n'autorise le scrapePost de repli que dans la fenêtre de relevé", () => {
    expect(repliAutorise(passage(2, null), maintenant)).toBe(true);
    expect(repliAutorise(passage(RELEVE_FIGE_APRES_JOURS + 2, null), maintenant)).toBe(false);
  });
});

describe("profondeurScrape", () => {
  it("ne scrape rien quand rien n'est dû", () => {
    expect(profondeurScrape([passage(1, 30 * HEURE_MS)], [], maintenant)).toBe(0);
  });

  it("garde le plancher pour un seul post récent", () => {
    const dus = [passage(0.5, null)];
    expect(profondeurScrape([...dus, passage(3, 1)], dus, maintenant)).toBe(POSTS_RELEVES);
  });

  it("se cale sur l'âge du plus vieux dû, pas sur le nombre de dus", () => {
    // Deux posts par jour sur 8 jours ; un seul dû, vieux de 6 jours :
    // il faut remonter les 13 posts publiés depuis, pas 2 × 1.
    const publies = Array.from({ length: 16 }, (_, i) => passage(i * 0.5, 30 * HEURE_MS));
    const dus = [passage(6, 30 * HEURE_MS)];
    expect(profondeurScrape(publies, dus, maintenant)).toBe(Math.ceil(13 * 1.25) + 2);
  });

  it("plafonne à POSTS_RELEVES_MAX", () => {
    const publies = Array.from({ length: 60 }, (_, i) => passage(i * 0.5, null));
    expect(profondeurScrape(publies, publies, maintenant)).toBe(POSTS_RELEVES_MAX);
  });
});

describe("metricsAScraper", () => {
  it("scrape le total du profil au plus une fois toutes les 20 h", () => {
    expect(metricsAScraper(null, maintenant)).toBe(true);
    expect(metricsAScraper(ilYA(5 * HEURE_MS), maintenant)).toBe(false);
    expect(metricsAScraper(ilYA(21 * HEURE_MS), maintenant)).toBe(true);
  });
});

describe("estApifyEpuise", () => {
  it("reconnaît le 402 d'Apify à court de crédit", () => {
    expect(estApifyEpuise('Apify 402: {"error":{"type":"not-enough-usage-to-run-paid-actor"}}')).toBe(true);
    expect(estApifyEpuise("Apify 500: boom")).toBe(false);
  });
});
