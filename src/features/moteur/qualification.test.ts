import { describe, expect, it } from "vitest";

import {
  donneesDepuisPassages,
  enSurveillance,
  estEnTrial,
  finSkip,
  qualifierCompte,
  seuilBien,
  seuilInactif,
  seuilStar,
  trialAAlerter,
  type PassageJuge,
} from "./qualification";

describe("seuils ramenés au nombre de posts prévus", () => {
  it("retombe sur l'énoncé quand 10 posts étaient prévus", () => {
    expect(seuilInactif(10)).toBe(6); // 6 ou moins → INACTIF
    expect(seuilBien(10)).toBe(8); // au moins 8 → BIEN
    expect(seuilStar(10)).toBe(9); // au moins 9 → STAR
  });

  it("suit la proportion quand moins de 10 posts étaient prévus", () => {
    expect(seuilInactif(5)).toBe(3);
    expect(seuilBien(5)).toBe(4);
    expect(seuilStar(5)).toBe(5);
    expect(seuilBien(4)).toBe(4);
    expect(seuilStar(3)).toBe(3);
  });
});

describe("qualifierCompte", () => {
  it("INACTIF dès 6 publiés sur 10 prévus, quelles que soient les vues", () => {
    expect(qualifierCompte({ prevus: 10, publies: 6, moyenneVues: 50_000 })).toBe("INACTIF");
    expect(qualifierCompte({ prevus: 10, publies: 6, moyenneVues: null })).toBe("INACTIF");
  });

  it("laisse passer 7 sur 10", () => {
    expect(qualifierCompte({ prevus: 10, publies: 7, moyenneVues: 2_000 })).toBe("PASSABLE");
  });

  it("MAUVAISES_VUES sous 600 de moyenne", () => {
    expect(qualifierCompte({ prevus: 10, publies: 10, moyenneVues: 599 })).toBe("MAUVAISES_VUES");
    expect(qualifierCompte({ prevus: 10, publies: 10, moyenneVues: 600 })).toBe("PASSABLE");
  });

  it("BIEN à partir de 1 000 de moyenne et 8 posts sur 10", () => {
    expect(qualifierCompte({ prevus: 10, publies: 8, moyenneVues: 1_000 })).toBe("BIEN");
    expect(qualifierCompte({ prevus: 10, publies: 7, moyenneVues: 1_000 })).toBe("PASSABLE");
    expect(qualifierCompte({ prevus: 10, publies: 8, moyenneVues: 999 })).toBe("PASSABLE");
  });

  it("STAR au-dessus de 10 000 de moyenne et 9 posts sur 10", () => {
    expect(qualifierCompte({ prevus: 10, publies: 9, moyenneVues: 10_001 })).toBe("STAR");
    expect(qualifierCompte({ prevus: 10, publies: 10, moyenneVues: 80_000 })).toBe("STAR");
  });

  it("ne dégrade pas un STAR en BIEN : les deux bandes sont emboîtées", () => {
    // 80 000 vues et 10/10 coche aussi les conditions de BIEN. « La moins
    // bonne » ne s'applique qu'entre ce qui monte et ce qui descend.
    expect(qualifierCompte({ prevus: 10, publies: 10, moyenneVues: 80_000 })).not.toBe("BIEN");
  });

  it("50 000 vues mais 8 posts sur 10 : BIEN, pas STAR ni PASSABLE", () => {
    expect(qualifierCompte({ prevus: 10, publies: 8, moyenneVues: 50_000 })).toBe("BIEN");
  });

  it("prend la moins bonne quand un compte coche plusieurs cases", () => {
    // Assidu mais invisible : les vues l'emportent vers le bas.
    expect(qualifierCompte({ prevus: 10, publies: 10, moyenneVues: 300 })).toBe("MAUVAISES_VUES");
    // Gros chiffres mais absent : l'inactivité l'emporte, et elle est pire.
    expect(qualifierCompte({ prevus: 10, publies: 5, moyenneVues: 300 })).toBe("INACTIF");
  });

  it("ne juge pas les vues d'un compte dont rien n'est mesuré", () => {
    expect(qualifierCompte({ prevus: 10, publies: 10, moyenneVues: null })).toBe("PASSABLE");
  });

  it("ne juge pas un compte sans aucun créneau échu", () => {
    expect(qualifierCompte({ prevus: 0, publies: 0, moyenneVues: null })).toBe("PASSABLE");
  });

  it("juge un compte qui n'a eu que 4 créneaux à la même proportion", () => {
    expect(qualifierCompte({ prevus: 4, publies: 2, moyenneVues: 5_000 })).toBe("INACTIF");
    expect(qualifierCompte({ prevus: 4, publies: 4, moyenneVues: 5_000 })).toBe("BIEN");
  });
});

describe("essai et file de surveillance", () => {
  const cree = new Date("2026-09-01T00:00:00Z");
  const h = (n: number) => new Date(cree.getTime() + n * 3_600_000);

  it("dure 80 heures", () => {
    expect(estEnTrial(cree, h(79))).toBe(true);
    expect(estEnTrial(cree, h(81))).toBe(false);
  });

  it("alerte 30 heures avant la fin, pas avant", () => {
    expect(trialAAlerter(cree, h(49))).toBe(false);
    expect(trialAAlerter(cree, h(51))).toBe(true);
    expect(trialAAlerter(cree, h(81))).toBe(false);
  });

  it("met en file les comptes INACTIF et MAUVAISES_VUES", () => {
    const now = h(200);
    const base = { creeLe: cree.toISOString() };
    expect(enSurveillance({ ...base, qualification: "INACTIF" }, now)).toBe(true);
    expect(enSurveillance({ ...base, qualification: "MAUVAISES_VUES" }, now)).toBe(true);
    expect(enSurveillance({ ...base, qualification: "PASSABLE" }, now)).toBe(false);
    expect(enSurveillance({ ...base, qualification: "STAR" }, now)).toBe(false);
  });

  it("un skip sort le compte de la file, puis expire", () => {
    const now = h(200);
    const skip = finSkip(now).toISOString();
    expect(
      enSurveillance({ creeLe: cree.toISOString(), qualification: "INACTIF", skipJusqua: skip }, now),
    ).toBe(false);
    const plusTard = new Date(now.getTime() + 8 * 24 * 3_600_000);
    expect(
      enSurveillance(
        { creeLe: cree.toISOString(), qualification: "INACTIF", skipJusqua: skip },
        plusTard,
      ),
    ).toBe(true);
  });

  it("une fin d'essai passe outre le skip : c'est une échéance, pas une relance", () => {
    const now = h(60);
    const skip = finSkip(now).toISOString();
    expect(
      enSurveillance({ creeLe: cree.toISOString(), qualification: "STAR", skipJusqua: skip }, now),
    ).toBe(true);
  });
});

describe("donneesDepuisPassages", () => {
  const p = (o: Partial<PassageJuge>): PassageJuge => ({
    date_publication_prevue: null,
    publie_at: null,
    publie_url: null,
    statut: null,
    vues: null,
    ...o,
  });

  it("ne garde que les 10 derniers créneaux échus, le jour même exclu", () => {
    const rows = Array.from({ length: 14 }, (_, i) =>
      p({ date_publication_prevue: `2026-09-${String(i + 1).padStart(2, "0")}`, statut: "publie" }),
    );
    rows.push(p({ date_publication_prevue: "2026-09-20", statut: "assigne" })); // aujourd'hui
    const d = donneesDepuisPassages(rows, "2026-09-20");
    expect(d.prevus).toBe(10);
    expect(d.publies).toBe(10);
  });

  it("compte comme publié un passage qui porte un lien ou une date, même sans statut", () => {
    const rows = [
      p({ date_publication_prevue: "2026-09-01", publie_url: "https://tiktok.com/x" }),
      p({ date_publication_prevue: "2026-09-02", publie_at: "2026-09-02T10:00:00Z" }),
      p({ date_publication_prevue: "2026-09-03", statut: "assigne" }),
    ];
    const d = donneesDepuisPassages(rows, "2026-09-10");
    expect(d.prevus).toBe(3);
    expect(d.publies).toBe(2);
  });

  it("ignore les posts de test des deux côtés", () => {
    const rows = [
      p({ date_publication_prevue: "2026-09-01", statut: "publie", vues: 10_000, est_test: true }),
      p({ date_publication_prevue: "2026-09-02", statut: "publie", vues: 500 }),
    ];
    const d = donneesDepuisPassages(rows, "2026-09-10");
    expect(d.prevus).toBe(1);
    expect(d.moyenneVues).toBe(500);
  });

  it("ne compte dans la moyenne que les posts mesurés", () => {
    const rows = [
      p({ date_publication_prevue: "2026-09-01", statut: "publie", vues: 1_000 }),
      p({ date_publication_prevue: "2026-09-02", statut: "publie", vues: null }),
    ];
    expect(donneesDepuisPassages(rows, "2026-09-10").moyenneVues).toBe(1_000);
  });

  it("rend une moyenne nulle quand rien n'est mesuré", () => {
    const rows = [p({ date_publication_prevue: "2026-09-01", statut: "publie", vues: null })];
    expect(donneesDepuisPassages(rows, "2026-09-10").moyenneVues).toBeNull();
  });
});
