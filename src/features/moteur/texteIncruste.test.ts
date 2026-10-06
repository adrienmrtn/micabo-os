import { describe, expect, it } from "vitest";

import { realignerDeck } from "@/features/moteur/deckStructure";
import {
  cheminIncruste,
  deckIncrustePret,
  deckIncrusteServi,
  jpegSansMetadonnees,
  languesIncrustees,
  versionsIncrustees,
  vignetteIncrustee,
  visuelsIncrustes,
} from "@/features/moteur/texteIncruste";

const deck = (n: number, sans?: number) =>
  Array.from({ length: n }, (_, i) => ({
    position: i + 1,
    media_id: i + 1 === sans ? null : `m${i + 1}`,
    texte_overlay: "",
    position_sophia: false,
  }));

describe("deckIncrustePret", () => {
  it("exige une image à chaque position", () => {
    expect(deckIncrustePret(deck(6))).toBe(true);
    expect(deckIncrustePret(deck(6, 4))).toBe(false);
  });

  it("refuse un deck vide ou absent", () => {
    expect(deckIncrustePret([])).toBe(false);
    expect(deckIncrustePret(null)).toBe(false);
    expect(deckIncrustePret(undefined)).toBe(false);
  });

  it("refuse un trou ou un doublon de position (le défaut de 0279)", () => {
    const troue = deck(3).map((s) => (s.position === 3 ? { ...s, position: 4 } : s));
    expect(deckIncrustePret(troue)).toBe(false);
    const double = deck(3).map((s) => (s.position === 3 ? { ...s, position: 2 } : s));
    expect(deckIncrustePret(double)).toBe(false);
  });

  it("ne dépend pas de l'ordre du tableau", () => {
    expect(deckIncrustePret(deck(4).reverse())).toBe(true);
  });
});

describe("languesIncrustees", () => {
  it("ne garde que les langues complètes : jamais de repli sur une autre", () => {
    expect(
      languesIncrustees([
        { langue: "fr", slides: deck(6) },
        { langue: "de", slides: deck(6) },
        { langue: "tr", slides: deck(6, 2) },
        { langue: "es", slides: [] },
      ]),
    ).toEqual(["de", "fr"]);
  });
});

describe("deckIncrusteServi", () => {
  it("vide le texte, efface le placement et trie les positions", () => {
    const brut = [
      { position: 2, media_id: "b", texte_overlay: "reste", position_sophia: true },
      { position: 1, media_id: "a", texte_overlay: null, position_sophia: false },
    ];
    expect(deckIncrusteServi(brut)).toEqual([
      { position: 1, media_id: "a", texte_overlay: "", position_sophia: false },
      { position: 2, media_id: "b", texte_overlay: "", position_sophia: false },
    ]);
  });
});

describe("visuelsIncrustes", () => {
  it("pose l'image du deck à chaque position, sans référence", () => {
    expect(visuelsIncrustes(deck(2))).toEqual([
      { position: 1, media_id: "m1", reference_url: null },
      { position: 2, media_id: "m2", reference_url: null },
    ]);
  });

  it("lève sur une slide sans image plutôt que livrer une slide blanche", () => {
    expect(() => visuelsIncrustes(deck(3, 2))).toThrow(/#2/);
  });
});

describe("realignerDeck sur un deck incrusté", () => {
  it("emporte l'image de chaque slide avec elle", () => {
    // La 2ᵉ slide est retirée dans l'éditeur : l'ancienne 3 devient la 2.
    const r = realignerDeck(deck(3), [1, 3]);
    expect(r.map((s) => [s.position, (s as { media_id?: string }).media_id])).toEqual([
      [1, "m1"],
      [2, "m3"],
    ]);
    expect(deckIncrustePret(r)).toBe(true);
  });
});

describe("jpegSansMetadonnees", () => {
  const seg = (m: number, contenu: number[]) => [0xff, m, 0, contenu.length + 2, ...contenu];
  const app0 = seg(0xe0, [0x4a, 0x46, 0x49, 0x46, 0]); // JFIF
  const exif = seg(0xe1, [0x45, 0x78, 0x69, 0x66, 0, 0, 1, 2, 3]); // Exif
  const icc = seg(0xe2, [0x49, 0x43, 0x43, 9, 9]);
  const c2pa = seg(0xeb, [0x4a, 0x50, 0x63, 0x32, 0x70, 0x61]);
  const adobe = seg(0xee, [0x41, 0x64, 0x6f, 0x62, 0x65]);
  const com = seg(0xfe, [0x68, 0x69]);
  const dqt = seg(0xdb, [0, 1, 2, 3]);
  const sof = seg(0xc0, [8, 0, 1, 0, 1, 1, 1, 0x11, 0]);
  const image = [0xff, 0xda, 0, 4, 1, 2, 0x55, 0xff, 0x00, 0x66, 0xff, 0xd9];

  it("retire EXIF, ICC, XMP/C2PA, JFIF et commentaires, garde tables et image", () => {
    const entree = Uint8Array.from([0xff, 0xd8, ...app0, ...exif, ...icc, ...c2pa, ...com, ...dqt, ...sof, ...image]);
    const sortie = jpegSansMetadonnees(entree);
    expect([...sortie]).toEqual([0xff, 0xd8, ...dqt, ...sof, ...image]);
  });

  it("garde APP14 (Adobe) : c'est un paramètre de décodage, pas une métadonnée", () => {
    const entree = Uint8Array.from([0xff, 0xd8, ...adobe, ...exif, ...dqt, ...image]);
    expect([...jpegSansMetadonnees(entree)]).toEqual([0xff, 0xd8, ...adobe, ...dqt, ...image]);
  });

  it("rend à l'identique un JPEG déjà nu", () => {
    const nu = Uint8Array.from([0xff, 0xd8, ...dqt, ...sof, ...image]);
    expect([...jpegSansMetadonnees(nu)]).toEqual([...nu]);
  });

  it("refuse ce qui n'est pas un JPEG", () => {
    expect(() => jpegSansMetadonnees(Uint8Array.from([0x89, 0x50, 0x4e, 0x47]))).toThrow();
  });
});

describe("versionsIncrustees et vignetteIncrustee", () => {
  const urls = { m1: "u1", m2: "u2", m3: "u3" };

  it("montre aussi une version incomplète, marquée non prête", () => {
    const v = versionsIncrustees(
      [
        { langue: "fr", slides: deck(3).reverse() },
        { langue: "de", slides: deck(3, 1) },
      ],
      urls,
    );
    expect(v.map((x) => [x.langue, x.prete])).toEqual([
      ["de", false],
      ["fr", true],
    ]);
    expect(v[1]!.images.map((i) => i.url)).toEqual(["u1", "u2", "u3"]);
  });

  it("prend la vignette dans une version prête seulement", () => {
    const v = versionsIncrustees(
      [
        { langue: "de", slides: deck(3, 1) },
        { langue: "fr", slides: deck(3) },
      ],
      urls,
    );
    expect(vignetteIncrustee(v)).toBe("u1");
    expect(vignetteIncrustee([])).toBeNull();
  });
});

describe("cheminIncruste", () => {
  it("range une image par slideshow, langue et position", () => {
    expect(cheminIncruste("c1", "de", 4)).toBe("incruste/c1/de/4.jpg");
  });
});
