import { deflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { chunksPng, dimensionsImage, imageSansMetadonnees, pngSansMetadonnees } from "./imageMetadonnees";

function crc32(octets: Uint8Array): number {
  let crc = 0xffffffff;
  for (const b of octets) {
    crc ^= b;
    for (let k = 0; k < 8; k += 1) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, donnees: Uint8Array): Uint8Array {
  const s = new Uint8Array(12 + donnees.length);
  const v = new DataView(s.buffer);
  v.setUint32(0, donnees.length);
  for (let k = 0; k < 4; k += 1) s[4 + k] = type.charCodeAt(k);
  s.set(donnees, 8);
  v.setUint32(8 + donnees.length, crc32(s.subarray(4, 8 + donnees.length)));
  return s;
}

const texte = (s: string) => new TextEncoder().encode(s);

/** PNG 1×1 RGB valide, entouré des métadonnées que laissent Higgsfield, Fal ou Google. */
function pngTemoin(): Uint8Array {
  const ihdr = new Uint8Array(13);
  const v = new DataView(ihdr.buffer);
  v.setUint32(0, 1);
  v.setUint32(4, 1);
  ihdr.set([8, 2, 0, 0, 0], 8);
  const idat = new Uint8Array(deflateSync(Uint8Array.of(0, 200, 100, 50)));
  const parts = [
    Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a),
    chunk("IHDR", ihdr),
    chunk("iCCP", texte("Google/Skia/abc\0\0xyz")),
    chunk("tEXt", texte("Software\0Higgsfield Soul")),
    chunk("iTXt", texte("XML:com.adobe.xmp\0\0\0\0\0<x:xmpmeta>c2pa</x:xmpmeta>")),
    chunk("eXIf", texte("MM\0*exif")),
    chunk("caBX", texte("jumb c2pa manifest")),
    chunk("tIME", Uint8Array.of(7, 234, 10, 6, 12, 0, 0)),
    chunk("pHYs", new Uint8Array(9)),
    chunk("IDAT", idat),
    chunk("IEND", new Uint8Array(0)),
  ];
  const total = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

describe("pngSansMetadonnees", () => {
  it("ne garde que l'image : IHDR, sRGB (à la place du profil ICC), IDAT, IEND", () => {
    const propre = pngSansMetadonnees(pngTemoin());
    expect(chunksPng(propre)).toEqual(["IHDR", "sRGB", "IDAT", "IEND"]);
    const brut = String.fromCharCode(...propre);
    expect(brut).not.toMatch(/Higgsfield|Google|xmp|c2pa|exif/i);
  });

  it("garde les pixels octet pour octet", () => {
    const avant = pngTemoin();
    const apres = pngSansMetadonnees(avant);
    const idat = (o: Uint8Array) => {
      const s = String.fromCharCode(...o);
      const i = s.indexOf("IDAT") - 4;
      const n = new DataView(o.buffer, o.byteOffset).getUint32(i);
      return o.subarray(i, i + 12 + n);
    };
    expect(idat(apres)).toEqual(idat(avant));
  });

  it("est idempotent", () => {
    const une = pngSansMetadonnees(pngTemoin());
    expect(pngSansMetadonnees(une)).toEqual(une);
  });

  it("lève sur un PNG tronqué plutôt que de rendre une image cassée", () => {
    const t = pngTemoin();
    expect(() => pngSansMetadonnees(t.subarray(0, t.length - 12))).toThrow(/IEND/);
  });
});

describe("imageSansMetadonnees", () => {
  it("aiguille PNG et JPEG, refuse le reste", () => {
    expect(imageSansMetadonnees(pngTemoin()).mime).toBe("image/png");
    const jpeg = Uint8Array.of(0xff, 0xd8, 0xff, 0xe1, 0, 4, 0x45, 0x78, 0xff, 0xda, 1, 2, 0xff, 0xd9);
    const r = imageSansMetadonnees(jpeg);
    expect(r.mime).toBe("image/jpeg");
    expect([...r.octets]).toEqual([0xff, 0xd8, 0xff, 0xda, 1, 2, 0xff, 0xd9]);
    expect(() => imageSansMetadonnees(texte("RIFF....WEBP"))).toThrow();
  });
});

describe("dimensionsImage", () => {
  it("lit la taille d'un PNG dans IHDR", () => {
    expect(dimensionsImage(pngTemoin())).toEqual({ largeur: 1, hauteur: 1 });
  });

  it("lit la taille d'un JPEG dans son SOF, après les segments APP", () => {
    // APP1 de 4 octets, puis SOF0 : précision 8, hauteur 1376, largeur 768.
    const jpeg = Uint8Array.of(
      0xff, 0xd8, 0xff, 0xe1, 0, 4, 0x45, 0x78,
      0xff, 0xc0, 0, 11, 8, 0x05, 0x60, 0x03, 0x00, 1, 1, 0x11, 0,
      0xff, 0xda, 1, 2, 0xff, 0xd9,
    );
    expect(dimensionsImage(jpeg)).toEqual({ largeur: 768, hauteur: 1376 });
  });

  it("rend null sur un format inconnu", () => {
    expect(dimensionsImage(texte("RIFF....WEBP"))).toBeNull();
  });
});
