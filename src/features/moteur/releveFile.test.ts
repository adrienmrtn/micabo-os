import { describe, expect, it } from "vitest";

import {
  apparierParLien,
  estApifyEpuise,
  idPostTiktok,
  lienTiktok,
  MESURE_A_MS,
  mesureFaite,
  passageARelever,
  POSTS_RELEVES,
  POSTS_RELEVES_MAX,
  profondeurScrape,
  RELEVE_ECHECS_MAX,
  RETENTER_APRES_MS,
  SANS_LIEN_MAX_JOURS,
  type PassageReleve,
} from "./releveFile";
import { MESURE_JOURS } from "./tierlist";

const HEURE_MS = 3_600_000;
const JOUR_MS = 24 * HEURE_MS;
const maintenant = Date.parse("2026-10-01T22:05:00Z");
const ilYA = (ms: number) => new Date(maintenant - ms).toISOString();
const LIEN = "https://vm.tiktok.com/ZGdQwYpaw/";

/**
 * Publié il y a `jours` jours, relevé `releveApres` jours après la
 * publication (null = jamais mesuré).
 */
const passage = (
  jours: number,
  releveApres: number | null,
  extra: Partial<PassageReleve> = {},
): PassageReleve => ({
  publie_at: ilYA(jours * JOUR_MS),
  date_publication_prevue: ilYA(jours * JOUR_MS).slice(0, 10),
  publie_url: LIEN,
  stats_maj_at: releveApres == null ? null : ilYA((jours - releveApres) * JOUR_MS),
  ...extra,
});

describe("bornes du relevé", () => {
  it("mesure à l'âge que lit la requalification, pas un autre", () => {
    expect(MESURE_A_MS).toBe(MESURE_JOURS * JOUR_MS);
  });

  it("ne retente pas entre minuit et 13:00 Paris, mais le lendemain", () => {
    // 13 h séparent la passe de minuit de celle de 13:00 : un échec de minuit
    // ne doit pas être repayé à 13:00, mais repris à la passe de minuit suivante.
    expect(RETENTER_APRES_MS).toBeGreaterThan(13 * HEURE_MS);
    expect(RETENTER_APRES_MS).toBeLessThanOrEqual(23 * HEURE_MS);
  });
});

describe("passageARelever — une mesure, à J+2", () => {
  it("laisse mûrir un post de moins de deux jours, même jamais mesuré", () => {
    expect(passageARelever(passage(0.1, null), maintenant)).toBe(false);
    expect(passageARelever(passage(1.9, null), maintenant)).toBe(false);
  });

  it("relève un post qui a atteint J+2 sans mesure", () => {
    expect(passageARelever(passage(2.01, null), maintenant)).toBe(true);
  });

  it("ne re-mesure JAMAIS un post déjà mesuré à J+2", () => {
    expect(passageARelever(passage(2.5, 2.1), maintenant)).toBe(false);
    expect(passageARelever(passage(6, 2), maintenant)).toBe(false);
  });

  it("re-mesure une seule fois à J+2 un post relevé trop tôt (avant le 01/10)", () => {
    const tot = passage(2.5, 0.4);
    expect(mesureFaite(tot)).toBe(false);
    expect(passageARelever(tot, maintenant)).toBe(true);
  });

  it("arrête de payer après RELEVE_ECHECS_MAX échecs", () => {
    expect(passageARelever(passage(3, null, { stats_echecs: RELEVE_ECHECS_MAX - 1 }), maintenant)).toBe(true);
    expect(passageARelever(passage(3, null, { stats_echecs: RELEVE_ECHECS_MAX }), maintenant)).toBe(false);
  });

  it("ne retente pas un relevé RATÉ depuis moins de 20 h", () => {
    const tente = (h: number) => passage(3, null, { stats_tentative_at: ilYA(h * HEURE_MS) });
    expect(passageARelever(tente(5), maintenant)).toBe(false);
    expect(passageARelever(tente(21), maintenant)).toBe(true);
  });

  it("n'attend pas 20 h pour refaire à J+2 un relevé RÉUSSI pris trop tôt", () => {
    // Publié il y a 2,1 jours, relevé avec succès il y a 6 h (à J+1,85) :
    // la mesure de J+2 se prend dès cette passe, pas le lendemain.
    const releve = ilYA(6 * HEURE_MS);
    const tot = passage(2.1, null, { stats_maj_at: releve, stats_tentative_at: releve });
    expect(passageARelever(tot, maintenant)).toBe(true);
  });

  it("date un passage sans publie_at par son créneau prévu", () => {
    const p = { publie_at: null, date_publication_prevue: "2026-09-28", publie_url: LIEN };
    expect(passageARelever(p, maintenant)).toBe(true);
    expect(passageARelever({ ...p, date_publication_prevue: "2026-10-01" }, maintenant)).toBe(false);
  });

  it("cherche un post sans lien tant qu'il est récent, plus après", () => {
    expect(passageARelever(passage(3, null, { publie_url: null }), maintenant)).toBe(true);
    expect(passageARelever(passage(SANS_LIEN_MAX_JOURS + 1, null, { publie_url: null }), maintenant)).toBe(false);
    // Des hashtags collés à la place du lien comptent comme « sans lien ».
    const hashtags = passage(SANS_LIEN_MAX_JOURS + 1, null, { publie_url: "#methodetude #revisions" });
    expect(passageARelever(hashtags, maintenant)).toBe(false);
  });
});

describe("lienTiktok / idPostTiktok", () => {
  it("reconnaît un lien TikTok, court ou complet, et refuse le reste", () => {
    expect(lienTiktok("https://vt.tiktok.com/ZSqMCJwgD/")).toBe(true);
    expect(lienTiktok("https://www.tiktok.com/@ela.sinav959/photo/7555")).toBe(true);
    expect(lienTiktok("#motivation #discipline #croissanceperso")).toBe(false);
    expect(lienTiktok("https://example.com/tiktok.com")).toBe(false);
    expect(lienTiktok(null)).toBe(false);
  });

  it("lit l'identifiant d'un lien résolu, pas d'un lien court", () => {
    expect(idPostTiktok("https://www.tiktok.com/@x/photo/7555123?_r=1")).toBe("7555123");
    expect(idPostTiktok("https://www.tiktok.com/@x/video/42")).toBe("42");
    expect(idPostTiktok("https://vm.tiktok.com/ZGdQwYpaw/")).toBeNull();
  });
});

describe("apparierParLien", () => {
  const r = (postId: string, vues: number) => ({
    postId,
    webVideoUrl: `https://www.tiktok.com/@x/photo/${postId}`,
    stats: { vues, likes: 0, commentaires: 0, partages: 0 },
  });

  it("rapproche chaque passage de son post par l'identifiant, quel que soit l'ordre", () => {
    const demandes = [
      { passage: { id: "a" }, idPost: "1" },
      { passage: { id: "b" }, idPost: "2" },
    ];
    const m = apparierParLien(demandes, [r("2", 200), r("1", 100)]);
    expect(m.get("a")?.stats.vues).toBe(100);
    expect(m.get("b")?.stats.vues).toBe(200);
  });

  it("ne rapproche rien au hasard quand plusieurs liens restent illisibles", () => {
    const demandes = [
      { passage: { id: "a" }, idPost: null },
      { passage: { id: "b" }, idPost: null },
    ];
    expect(apparierParLien(demandes, [r("1", 100), r("2", 200)]).size).toBe(0);
  });

  it("rapproche un lien court non résolu par le lien que renvoie l'actor", () => {
    const demandes = [
      { passage: { id: "a" }, idPost: null, url: "https://vm.tiktok.com/ZGdQwYpaw/" },
      { passage: { id: "b" }, idPost: "2", url: "https://www.tiktok.com/@x/photo/2" },
    ];
    const resultats = [
      { ...r("7", 700), lienDemande: "https://vm.tiktok.com/ZGdQwYpaw" },
      r("2", 200),
    ];
    const m = apparierParLien(demandes, resultats);
    expect(m.get("a")?.stats.vues).toBe(700);
    expect(m.get("b")?.stats.vues).toBe(200);
  });

  it("accepte le seul résultat d'un seul lien, même illisible", () => {
    const m = apparierParLien([{ passage: { id: "a" }, idPost: null }], [r("9", 900)]);
    expect(m.get("a")?.stats.vues).toBe(900);
  });

  it("laisse sans correspondance un post qu'Apify n'a pas rendu (supprimé)", () => {
    const demandes = [
      { passage: { id: "a" }, idPost: "1" },
      { passage: { id: "b" }, idPost: "2" },
    ];
    const m = apparierParLien(demandes, [r("1", 100)]);
    expect(m.has("a")).toBe(true);
    expect(m.has("b")).toBe(false);
  });
});

describe("profondeurScrape (posts sans lien seulement)", () => {
  it("ne scrape rien quand rien n'est cherché", () => {
    expect(profondeurScrape([passage(1, null)], [], maintenant)).toBe(0);
  });

  it("garde le plancher pour un seul post récent", () => {
    const cherches = [passage(2.1, null, { publie_url: null })];
    expect(profondeurScrape([...cherches, passage(1, null)], cherches, maintenant)).toBe(POSTS_RELEVES);
  });

  it("se cale sur l'âge du plus vieux cherché, pas sur leur nombre", () => {
    // Deux posts par jour sur 8 jours ; un seul cherché, vieux de 6 jours :
    // il faut remonter les 13 posts publiés depuis.
    const publies = Array.from({ length: 16 }, (_, i) => passage(i * 0.5, null));
    const cherches = [passage(6, null, { publie_url: null })];
    expect(profondeurScrape(publies, cherches, maintenant)).toBe(Math.ceil(13 * 1.25) + 2);
  });

  it("plafonne à POSTS_RELEVES_MAX", () => {
    const publies = Array.from({ length: 60 }, (_, i) => passage(i * 0.5, null));
    expect(profondeurScrape(publies, publies, maintenant)).toBe(POSTS_RELEVES_MAX);
  });
});

describe("estApifyEpuise", () => {
  it("reconnaît le 402 d'Apify à court de crédit", () => {
    expect(estApifyEpuise('Apify 402: {"error":{"type":"not-enough-usage-to-run-paid-actor"}}')).toBe(true);
    expect(estApifyEpuise("Apify 500: boom")).toBe(false);
  });
});
