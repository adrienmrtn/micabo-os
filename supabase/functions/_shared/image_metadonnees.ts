/**
 * Image sans métadonnées (AI UGC, 06/10/2026) — module PUR, sans réseau.
 *
 * Les photos des personas servent de photo de profil aux comptes : elles ne
 * doivent rien dire de leur origine. `retirerContentCredentials` (c2pa.ts) ne
 * vise que C2PA ; ici on retire TOUT ce qui n'est pas l'image.
 *
 * - JPEG : `jpegSansMetadonnees` (texte_incruste.ts) — APP0 à APP15 sauf
 *   APP14, et COM. Les données image passent octet pour octet.
 * - PNG : on ne garde que les chunks qui décrivent l'image elle-même
 *   (IHDR, PLTE, IDAT, IEND, tRNS, gAMA, cHRM, sRGB, et l'animation d'un
 *   APNG). Partent tEXt / iTXt / zTXt (XMP, logiciel, prompt), eXIf, tIME,
 *   caBX (C2PA), pHYs, bKGD, sPLT… Un profil iCCP part aussi : son nom
 *   (« Google/Skia… ») signe l'outil ; un chunk sRGB le remplace, les sorties
 *   de ces modèles étant en sRGB.
 * - Les pixels ne sont pas touchés. Un filigrane INVISIBLE écrit dans les
 *   pixels (SynthID de Google, sur les images Nano Banana) n'est pas une
 *   métadonnée : ce module ne le voit pas et ne peut pas le retirer.
 */

import { jpegSansMetadonnees } from "./texte_incruste.ts";

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

const PNG_GARDES = new Set([
  "IHDR", "PLTE", "IDAT", "IEND", "tRNS", "gAMA", "cHRM", "sRGB",
  // APNG : sans eux, une image animée perdrait ses images.
  "acTL", "fcTL", "fdAT",
]);

let TABLE_CRC: Uint32Array | null = null;

function crc32(octets: Uint8Array): number {
  if (!TABLE_CRC) {
    TABLE_CRC = new Uint32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      TABLE_CRC[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (const b of octets) crc = TABLE_CRC[(crc ^ b) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunkPng(type: string, donnees: Uint8Array): Uint8Array {
  const sortie = new Uint8Array(12 + donnees.length);
  const vue = new DataView(sortie.buffer);
  vue.setUint32(0, donnees.length);
  for (let k = 0; k < 4; k += 1) sortie[4 + k] = type.charCodeAt(k);
  sortie.set(donnees, 8);
  vue.setUint32(8 + donnees.length, crc32(sortie.subarray(4, 8 + donnees.length)));
  return sortie;
}

export function estPng(octets: Uint8Array): boolean {
  return octets.length > 8 && PNG_SIGNATURE.every((b, i) => octets[i] === b);
}

export function estJpeg(octets: Uint8Array): boolean {
  return octets.length > 3 && octets[0] === 0xff && octets[1] === 0xd8;
}

/** Les types de chunks d'un PNG, dans l'ordre (pour les tests et les contrôles). */
export function chunksPng(octets: Uint8Array): string[] {
  if (!estPng(octets)) throw new Error("chunksPng : ce n'est pas un PNG");
  const vue = new DataView(octets.buffer, octets.byteOffset, octets.byteLength);
  const types: string[] = [];
  let i = 8;
  while (i + 12 <= octets.length) {
    const n = vue.getUint32(i);
    types.push(String.fromCharCode(octets[i + 4]!, octets[i + 5]!, octets[i + 6]!, octets[i + 7]!));
    i += 12 + n;
  }
  return types;
}

export function pngSansMetadonnees(octets: Uint8Array): Uint8Array {
  if (!estPng(octets)) throw new Error("pngSansMetadonnees : ce n'est pas un PNG");
  const vue = new DataView(octets.buffer, octets.byteOffset, octets.byteLength);
  const morceaux: Uint8Array[] = [octets.subarray(0, 8)];
  let i = 8;
  let avaitIccp = false;
  let aSrgb = false;
  let fin = false;
  while (i + 12 <= octets.length && !fin) {
    const n = vue.getUint32(i);
    const type = String.fromCharCode(octets[i + 4]!, octets[i + 5]!, octets[i + 6]!, octets[i + 7]!);
    const bout = i + 12 + n;
    if (bout > octets.length) throw new Error(`pngSansMetadonnees : chunk ${type} tronqué`);
    if (type === "iCCP") avaitIccp = true;
    if (type === "sRGB") aSrgb = true;
    if (PNG_GARDES.has(type)) morceaux.push(octets.subarray(i, bout));
    if (type === "IEND") fin = true;
    i = bout;
  }
  if (!fin) throw new Error("pngSansMetadonnees : IEND absent");
  if (avaitIccp && !aSrgb) {
    // Intention de rendu 0 (perceptuelle). Un sRGB doit précéder PLTE et
    // IDAT : il entre juste après IHDR.
    morceaux.splice(2, 0, chunkPng("sRGB", Uint8Array.of(0)));
  }
  let total = 0;
  for (const m of morceaux) total += m.length;
  const sortie = new Uint8Array(total);
  let o = 0;
  for (const m of morceaux) {
    sortie.set(m, o);
    o += m.length;
  }
  return sortie;
}

/** JPEG ou PNG sans métadonnées, avec son type. Lève sur un autre format. */
export function imageSansMetadonnees(octets: Uint8Array): { octets: Uint8Array; mime: string; ext: string } {
  if (estJpeg(octets)) return { octets: jpegSansMetadonnees(octets), mime: "image/jpeg", ext: "jpg" };
  if (estPng(octets)) return { octets: pngSansMetadonnees(octets), mime: "image/png", ext: "png" };
  throw new Error("imageSansMetadonnees : JPEG ou PNG attendu");
}
