import { describe, expect, it } from "vitest";
import { metadonneesMp4, mp4SansMetadonnees } from "./mp4Metadonnees";

// Petit MP4 synthétique, boîte par boîte : assez pour tenir la structure
// qu'un vrai fichier Kling ou iPhone présente (vérifié à côté sur des MP4
// ffmpeg : décodage et flux identiques après passage).

function u32(n: number): number[] {
  return [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
}

function ascii(s: string): number[] {
  return [...s].map((c) => c.charCodeAt(0));
}

function boite(type: string, ...contenu: number[][]): number[] {
  const corps = contenu.flat();
  return [...u32(8 + corps.length), ...ascii(type), ...corps];
}

/** mvhd / tkhd / mdhd version 0 : dates aux octets 4..12 du contenu. */
function avecDates(type: string): number[] {
  return boite(type, [0, 0, 0, 0], u32(0x11111111), u32(0x22222222), new Array(20).fill(7));
}

function hdlr(nom: string): number[] {
  return boite("hdlr", [0, 0, 0, 0], u32(0), ascii("vide"), new Array(12).fill(0), ascii(nom), [0]);
}

function stsdAvc1(): number[] {
  const entree = boite(
    "avc1",
    new Array(6).fill(0),
    [0, 1],
    new Array(16).fill(0),
    [0, 2, 0, 4], // 2×4 px
    u32(0x00480000),
    u32(0x00480000),
    u32(0),
    [0, 1],
    [11, ...ascii("Lavc60 x264"), ...new Array(20).fill(0)],
    [0, 0x18, 0xff, 0xff],
  );
  return boite("stsd", [0, 0, 0, 0], u32(1), entree);
}

function table(type: "stco" | "co64", offsets: number[]): number[] {
  const valeurs = offsets.flatMap((o) => (type === "stco" ? u32(o) : [...u32(0), ...u32(o)]));
  return boite(type, [0, 0, 0, 0], u32(offsets.length), valeurs);
}

function moov(offsets: number[], type: "stco" | "co64" = "stco"): number[] {
  const trak = boite(
    "trak",
    avecDates("tkhd"),
    boite(
      "mdia",
      avecDates("mdhd"),
      hdlr("Core Media Video"),
      boite("minf", boite("stbl", stsdAvc1(), table(type, offsets))),
    ),
    boite("udta", boite("©too", ascii("Lavf60"))),
  );
  return boite(
    "moov",
    avecDates("mvhd"),
    trak,
    boite("meta", [0, 0, 0, 0], boite("ilst", ascii("iPhone 15 Pro"))),
    boite("udta", boite("©xyz", ascii("+48.85+002.35/"))),
  );
}

const ftyp = boite("ftyp", ascii("isom"), u32(512), ascii("isomavc1"));
const c2pa = boite("uuid", [0xd8, 0xfe, 0xc3, 0xd6, ...new Array(12).fill(1)], ascii("jumb c2pa manifest"));
const DONNEES = [...ascii("AAAA"), ...ascii("BBBB"), ...ascii("CCCC")];

/** Fichier moov AVANT mdat (faststart) : les offsets dépendent de la taille de moov. */
function faststart(type: "stco" | "co64" = "stco"): Uint8Array {
  // Taille de moov indépendante des valeurs d'offset : on calcule en deux temps.
  const avant = ftyp.length + c2pa.length + moov([0, 0], type).length;
  const debutDonnees = avant + 8;
  const octets = [
    ...ftyp,
    ...c2pa,
    ...moov([debutDonnees, debutDonnees + 8], type),
    ...boite("mdat", DONNEES),
  ];
  return Uint8Array.from(octets);
}

/** Fichier mdat AVANT moov, avec une boîte free et un C2PA devant. */
function moovEnFin(): Uint8Array {
  const debutDonnees = ftyp.length + c2pa.length + 16 + 8;
  return Uint8Array.from([
    ...ftyp,
    ...c2pa,
    ...boite("free", new Array(8).fill(0)),
    ...boite("mdat", DONNEES),
    ...moov([debutDonnees, debutDonnees + 4]),
  ]);
}

/** Les octets désignés par chaque offset de la première table stco/co64. */
function morceaux(o: Uint8Array): string[] {
  const txt = String.fromCharCode(...o);
  const i = Math.max(txt.indexOf("stco"), txt.indexOf("co64"));
  const largeur = txt.indexOf("stco") >= 0 ? 4 : 8;
  const vue = new DataView(o.buffer, o.byteOffset);
  const n = vue.getUint32(i + 8);
  const sortie: string[] = [];
  for (let k = 0; k < n; k += 1) {
    const p = i + 12 + k * largeur;
    const off = largeur === 4 ? vue.getUint32(p) : vue.getUint32(p + 4);
    sortie.push(String.fromCharCode(...o.subarray(off, off + 4)));
  }
  return sortie;
}

describe("mp4SansMetadonnees", () => {
  it("retire udta, meta, uuid (C2PA) et met les dates à zéro", () => {
    const src = faststart();
    expect(metadonneesMp4(src)).toEqual(
      expect.arrayContaining(["uuid", "moov/mvhd:dates", "moov/udta", "moov/meta", "moov/trak/udta"]),
    );
    const propre = mp4SansMetadonnees(src);
    expect(metadonneesMp4(propre)).toEqual([]);
    expect(String.fromCharCode(...propre)).not.toMatch(/iPhone|Lavf|c2pa|48\.85/);
  });

  it("recale stco quand moov précède mdat et rétrécit", () => {
    const src = faststart();
    expect(morceaux(src)).toEqual(["AAAA", "CCCC"]);
    const propre = mp4SansMetadonnees(src);
    expect(propre.length).toBeLessThan(src.length);
    expect(morceaux(propre)).toEqual(["AAAA", "CCCC"]);
  });

  it("recale co64 de la même façon", () => {
    const propre = mp4SansMetadonnees(faststart("co64"));
    expect(morceaux(propre)).toEqual(["AAAA", "CCCC"]);
  });

  it("recale quand des boîtes retirées précèdent un mdat placé avant moov", () => {
    const src = moovEnFin();
    expect(morceaux(src)).toEqual(["AAAA", "BBBB"]);
    const propre = mp4SansMetadonnees(src);
    expect(morceaux(propre)).toEqual(["AAAA", "BBBB"]);
    expect(metadonneesMp4(propre)).toEqual([]);
  });

  it("vide le nom du hdlr et le compressorname, sans toucher au type de piste", () => {
    const propre = String.fromCharCode(...mp4SansMetadonnees(faststart()));
    expect(propre).not.toContain("Core Media Video");
    expect(propre).not.toContain("Lavc60");
    expect(propre).toContain("vide"); // handler_type gardé
    expect(propre).toContain("avc1");
  });

  it("est idempotent", () => {
    const une = mp4SansMetadonnees(faststart());
    expect(mp4SansMetadonnees(une)).toEqual(une);
  });

  it("refuse ce qui n'est pas un MP4, et un MP4 fragmenté", () => {
    expect(() => mp4SansMetadonnees(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]))).toThrow();
    const fragmente = Uint8Array.from([...ftyp, ...moov([0]), ...boite("moof", u32(0))]);
    expect(() => mp4SansMetadonnees(fragmente)).toThrow(/fragmenté/);
  });

  it("lève sur un offset qui ne tombe dans aucun mdat plutôt que d'écrire un fichier cassé", () => {
    const casse = Uint8Array.from([...ftyp, ...moov([999_999]), ...boite("mdat", DONNEES)]);
    expect(() => mp4SansMetadonnees(casse)).toThrow(/hors de tout mdat/);
  });
});
