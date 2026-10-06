import { describe, expect, it } from "vitest";
import {
  coutRendu,
  dureeReactionValide,
  formeConforme,
  formeTraductionTenue,
  lireTraductionUgc,
  promptTraductionUgc,
  idVideoTiktok,
  instantsPlanche,
  lireCoupe,
  lireDebutDemo,
  MOTEURS_KLING,
  normaliserTextes,
  pasPlanche,
  promptPersona,
  ratioNanoBanana,
  renduAssezLong,
} from "./ugcVideo";

describe("coût d'un rendu", () => {
  it("additionne l'image du persona et Kling à la seconde", () => {
    // 6 s en v2.6 pro : 0,15 + 6 × 0,112
    expect(coutRendu("kling-v2.6-pro", 6)).toBe(0.822);
    expect(coutRendu("kling-v3-pro", 6)).toBe(1.158);
  });

  it("ne compte que l'image quand la durée est inconnue", () => {
    expect(coutRendu("kling-v3-standard", null)).toBe(0.15);
  });

  it("a un endpoint motion-control pour chaque moteur", () => {
    for (const m of Object.values(MOTEURS_KLING)) expect(m.endpoint).toMatch(/motion-control$/);
  });
});

describe("gardes de durée", () => {
  it("borne la réaction entre 3 et 30 s", () => {
    expect(dureeReactionValide(2.9)).toBe(false);
    expect(dureeReactionValide(3)).toBe(true);
    expect(dureeReactionValide(30)).toBe(true);
    expect(dureeReactionValide(30.5)).toBe(false);
  });

  it("refuse un rendu tronqué sous 85 % de la réaction", () => {
    expect(renduAssezLong(5.1, 6)).toBe(true);
    expect(renduAssezLong(5, 6)).toBe(false);
    expect(renduAssezLong(null, 6)).toBe(false);
  });
});

describe("planche", () => {
  it("vise une image toutes les 0,5 s, moins dense sur une longue vidéo", () => {
    expect(pasPlanche(12, 30)).toBe(15);
    expect(pasPlanche(60, 30)).toBe(38); // 60 / 48 = 1,25 s
    expect(pasPlanche(10, 0)).toBe(15); // fps inconnu : 30
  });

  it("date les images uniformément de 0 à la fin (mesure Fal du 06/10)", () => {
    expect(instantsPlanche(8, 3)).toEqual([0, 0.43, 0.86, 1.29, 1.71, 2.14, 2.57, 3]);
    expect(instantsPlanche(1, 3)).toEqual([0]);
    expect(instantsPlanche(0, 3)).toEqual([]);
  });
});

describe("lireCoupe", () => {
  it("lit le JSON du modèle, même entouré de texte", () => {
    const c = lireCoupe('Voici : {"debut_s": 0.4, "fin_s": 5.2, "demo_debut_s": 5.6, "raison": "écran ensuite"}', 20);
    expect(c).toEqual({ debut_s: 0.4, fin_s: 5.2, demo_debut_s: 5.6, raison: "écran ensuite" });
  });

  it("borne à la vidéo et refuse un segment de moins d'une seconde", () => {
    expect(lireCoupe('{"debut_s": -1, "fin_s": 99}', 12)?.fin_s).toBe(12);
    expect(lireCoupe('{"debut_s": 2, "fin_s": 2.5}', 12)).toBeNull();
    expect(lireCoupe("pas de json", 12)).toBeNull();
  });
});

describe("prompts du persona", () => {
  it("le décor du persona ne prend que la pose de la frame source", () => {
    expect(promptPersona("persona")).toMatch(/ONLY for the pose/);
    expect(promptPersona("persona")).toMatch(/No text/);
  });

  it("le décor d'origine transfère l'identité et retire le texte", () => {
    expect(promptPersona("source")).toMatch(/Transfer the FULL identity/);
    expect(promptPersona("source")).toMatch(/no text at all/);
  });

  it("demandent une seule photo, jamais une grille (triptyque d'Inès, 06/10)", () => {
    for (const d of ["persona", "source"] as const) expect(promptPersona(d)).toMatch(/never a grid/);
  });
});

describe("format de l'image du persona", () => {
  it("prend le format Nano Banana le plus proche de l'image de départ", () => {
    expect(ratioNanoBanana(576, 1024)).toBe("9:16");
    expect(ratioNanoBanana(1080, 1920)).toBe("9:16");
    expect(ratioNanoBanana(1080, 1350)).toBe("4:5");
    expect(ratioNanoBanana(1920, 1080)).toBe("16:9");
    expect(ratioNanoBanana(0, 0)).toBe("9:16");
  });

  it("refuse une image rendue qui n'a pas la forme demandée", () => {
    expect(formeConforme(768, 1376, "9:16")).toBe(true);
    expect(formeConforme(1080, 1920, "9:16")).toBe(true);
    // Le triptyque d'Inès : paysage pour une demande en 9:16.
    expect(formeConforme(1080, 590, "9:16")).toBe(false);
    expect(formeConforme(1024, 1024, "9:16")).toBe(false);
  });
});

describe("début de la démo", () => {
  it("null, absent ou vide veut dire pas de démo, jamais 0 s", () => {
    expect(lireDebutDemo(null)).toBeNull();
    expect(lireDebutDemo(undefined)).toBeNull();
    expect(lireDebutDemo("")).toBeNull();
    expect(lireDebutDemo("abc")).toBeNull();
    expect(lireDebutDemo(6.2)).toBe(6.2);
    expect(lireDebutDemo("6.2")).toBe(6.2);
    expect(lireDebutDemo(0)).toBe(0);
  });
});

describe("textes et liens", () => {
  it("garde un texte par segment, réaction d'abord", () => {
    expect(
      normaliserTextes([
        { segment: "demo", texte: " regarde ça\r\n" },
        { segment: "reaction", texte: "POV" },
        { segment: "reaction", texte: "doublon" },
        { segment: "autre", texte: "x" },
      ]),
    ).toEqual([
      { segment: "reaction", texte: "POV" },
      { segment: "demo", texte: "regarde ça" },
    ]);
    expect(normaliserTextes(null)).toEqual([]);
  });

  it("lit l'id d'un lien TikTok long, rien sur un lien court", () => {
    expect(idVideoTiktok("https://www.tiktok.com/@x/video/7691007701127564576?lang=fr")).toBe("7691007701127564576");
    expect(idVideoTiktok("https://vm.tiktok.com/ZMabc/")).toBeNull();
  });
});

describe("texte à coller par langue", () => {
  const original = [
    { segment: "reaction" as const, texte: "Pov t'arrives\na apprendre 150\npages en 1h\ngrâce à ce mec\nqui t'a parlé\nde la méthode" },
    { segment: "demo" as const, texte: "" },
  ];

  it("donne au modèle le nombre de lignes de chaque segment", () => {
    expect(promptTraductionUgc(original, "de")).toContain('<reaction lignes="6">');
    expect(promptTraductionUgc(original, "de")).toContain("die micabo-App");
  });

  it("refuse une traduction qui perd ses lignes (l'allemand sur une ligne, 06/10)", () => {
    expect(formeTraductionTenue(original[0]!.texte, "POV du lernst 150 Seiten in 1h dank diesem Typen")).toBe(false);
    expect(formeTraductionTenue(original[0]!.texte, "a\nb\nc\nd\ne")).toBe(true);
    expect(formeTraductionTenue(original[0]!.texte, "a\nb\nc\nd\ne\nf\ng")).toBe(true);
    expect(formeTraductionTenue("une seule ligne", "tout autre chose")).toBe(true);
    expect(lireTraductionUgc('{"reaction": "POV alles auf einer Zeile", "demo": ""}', original)).toBeNull();
    expect(lireTraductionUgc('{"reaction": "a\\nb\\nc\\nd\\ne\\nf", "demo": ""}', original)?.[0]?.texte).toBe("a\nb\nc\nd\ne\nf");
  });

  it("refuse un segment plein revenu vide, garde un segment vide", () => {
    expect(lireTraductionUgc('{"reaction": "", "demo": ""}', original)).toBeNull();
  });
});
