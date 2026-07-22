// Effacement de texte par inpainting — filet de secours quand Gemini refuse de
// retoucher une image (typiquement un visage réel).
//
// Contrairement à un modèle génératif, un service d'effacement par masque ne
// juge pas le contenu : on lui donne l'image + un masque des zones de texte, il
// reconstruit UNIQUEMENT sous le masque. Aucun refus possible.
//
// Provider : Stability AI « Erase » (https://api.stability.ai). Il faut une clé
// STABILITY_API_KEY dans les secrets. Sans clé, `inpaintTexte` renvoie null et
// l'appelant garde l'original : le fallback est inerte tant que la clé manque.

export interface Zone {
  // Fractions de la largeur/hauteur, origine coin haut-gauche.
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Largeur/hauteur d'un JPEG ou PNG, lues dans l'en-tête sans décoder l'image. */
export function dimensionsImage(bytes: Uint8Array): { w: number; h: number } | null {
  // PNG : signature puis IHDR (largeur/hauteur en big-endian aux offsets 16/20).
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    const dv = new DataView(bytes.buffer, bytes.byteOffset);
    return { w: dv.getUint32(16), h: dv.getUint32(20) };
  }

  // JPEG : on avance de marqueur en marqueur jusqu'à un SOF (0xC0..0xCF, hors
  // C4/C8/CC), qui porte hauteur puis largeur.
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    let i = 2;
    while (i < bytes.length) {
      if (bytes[i] !== 0xff) {
        i += 1;
        continue;
      }
      const marqueur = bytes[i + 1];
      if (
        marqueur >= 0xc0 &&
        marqueur <= 0xcf &&
        marqueur !== 0xc4 &&
        marqueur !== 0xc8 &&
        marqueur !== 0xcc
      ) {
        const h = (bytes[i + 5] << 8) | bytes[i + 6];
        const w = (bytes[i + 7] << 8) | bytes[i + 8];
        return { w, h };
      }
      const longueur = (bytes[i + 2] << 8) | bytes[i + 3];
      i += 2 + longueur;
    }
  }

  return null;
}

// --- Encodage PNG du masque (niveaux de gris, blanc = à effacer) -------------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

async function deflate(data: Uint8Array): Promise<Uint8Array> {
  // CompressionStream('deflate') produit du zlib (RFC1950), ce qu'attend un IDAT.
  const flux = new Response(
    new Blob([data]).stream().pipeThrough(new CompressionStream("deflate")),
  );
  return new Uint8Array(await flux.arrayBuffer());
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = new TextEncoder().encode(type);
  const corps = new Uint8Array(typeBytes.length + data.length);
  corps.set(typeBytes, 0);
  corps.set(data, typeBytes.length);

  const out = new Uint8Array(8 + data.length + 4);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  out.set(corps, 4);
  dv.setUint32(4 + corps.length, crc32(corps));
  return out;
}

/** Masque PNG 8 bits : fond noir, rectangles blancs sur les zones de texte. */
async function masquePNG(w: number, h: number, zones: Zone[]): Promise<Uint8Array> {
  // Une scanline = 1 octet de filtre (0) + w octets (0 = noir, 255 = blanc).
  const brut = new Uint8Array((w + 1) * h);
  for (const z of zones) {
    const x0 = Math.max(0, Math.floor(z.x * w));
    const y0 = Math.max(0, Math.floor(z.y * h));
    const x1 = Math.min(w, Math.ceil((z.x + z.w) * w));
    const y1 = Math.min(h, Math.ceil((z.y + z.h) * h));
    for (let y = y0; y < y1; y += 1) {
      const base = y * (w + 1) + 1;
      for (let x = x0; x < x1; x += 1) brut[base + x] = 255;
    }
  }

  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, w);
  dv.setUint32(4, h);
  ihdr[8] = 8; // profondeur
  ihdr[9] = 0; // niveaux de gris
  // 10..12 = 0 (compression, filtre, entrelacement)

  const idat = await deflate(brut);
  const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const parts = [
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", new Uint8Array(0)),
  ];
  const total = parts.reduce((n, p) => n + p.length, 0);
  const png = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    png.set(p, offset);
    offset += p.length;
  }
  return png;
}

// --- Appel du service d'effacement ------------------------------------------

/**
 * Efface les `zones` de texte de l'image et renvoie le résultat en base64.
 * Renvoie null si aucune clé, aucune zone, ou en cas d'erreur — l'appelant
 * gardera alors l'original.
 */
export async function inpaintTexte(
  imageBytes: Uint8Array,
  mime: string,
  zones: Zone[],
): Promise<string | null> {
  const key = Deno.env.get("STABILITY_API_KEY");
  if (!key || zones.length === 0) return null;

  const dims = dimensionsImage(imageBytes);
  if (!dims) return null;

  try {
    const masque = await masquePNG(dims.w, dims.h, zones);

    const form = new FormData();
    form.append("image", new Blob([imageBytes], { type: mime }), "image");
    form.append("mask", new Blob([masque], { type: "image/png" }), "mask.png");
    form.append("output_format", "png");

    const res = await fetch("https://api.stability.ai/v2beta/stable-image/edit/erase", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, Accept: "image/*" },
      body: form,
    });
    if (!res.ok) {
      throw new Error(`Stability ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }

    const bytes = new Uint8Array(await res.arrayBuffer());
    let binaire = "";
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      binaire += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
    }
    return btoa(binaire);
  } catch (error) {
    console.warn(`[inpaint] échec, on garde l'original : ${error}`);
    return null;
  }
}
