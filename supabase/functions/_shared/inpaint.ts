// Effacement de texte par inpainting — voie principale de nettoyage.
//
// On donne l'image + un masque des zones de texte ; le modèle reconstruit
// UNIQUEMENT sous le masque, sans toucher au reste ni juger la personne.
//
// Fournisseurs, dans l'ordre :
//   1. LaMa via Replicate (REPLICATE_API_TOKEN) — modèle brut, AUCUNE
//      modération, donc il accepte les stills de films. ~0,0004 $/image.
//   2. Stability « Erase » (STABILITY_KEY) — repli ; a une modération qui
//      refuse certains visuels sous copyright.
// Sans aucun jeton, `effacerTexte` renvoie null et l'appelant garde l'original.

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

function enBase64(bytes: Uint8Array): string {
  let binaire = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binaire += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binaire);
}

/**
 * Efface les `zones` de texte et renvoie le résultat en base64.
 *
 * Voie principale : LaMa sur Replicate — un modèle d'inpainting brut, SANS
 * modération de contenu, qui accepte donc les stills de films que Stability
 * refuse. ~0,0004 $ l'image, ~2 s. Repli sur Stability si aucun jeton Replicate.
 * Renvoie null si aucune zone ni aucun fournisseur configuré.
 */
export async function effacerTexte(
  imageUrl: string,
  imageBytes: Uint8Array,
  mime: string,
  zones: Zone[],
): Promise<string | null> {
  if (zones.length === 0) return null;

  const dims = dimensionsImage(imageBytes);
  if (!dims) throw new Error("inpaint: dimensions illisibles");
  const masque = await masquePNG(dims.w, dims.h, zones);

  const jetonReplicate = Deno.env.get("REPLICATE_API_TOKEN");
  if (jetonReplicate) return await fluxFillReplicate(jetonReplicate, imageUrl, masque);

  const cleStability = Deno.env.get("STABILITY_KEY") ?? Deno.env.get("STABILITY_API_KEY");
  if (cleStability) return await stabilityErase(cleStability, imageBytes, mime, masque, dims);

  return null;
}

/**
 * Flux Fill (dev) via Replicate. `Prefer: wait` bloque jusqu'au résultat ; en
 * cas de réponse asynchrone on interroge la prédiction. Le masque part en
 * data-URI, l'image publique par son URL. Convention : blanc = zone à remplir.
 *
 * Contrairement à LaMa (qui floute), c'est un modèle de diffusion : il
 * reconstruit le décor sous le texte de façon photoréaliste. Version figée,
 * récupérée via l'API Replicate ; un modèle communautaire s'appelle par son
 * hash de version sur /v1/predictions.
 */
const FLUX_FILL_VERSION = "a053f84125613d83e65328a289e14eb6639e10725c243e8fb0c24128e5573f4c";

async function fluxFillReplicate(
  jeton: string,
  imageUrl: string,
  masque: Uint8Array,
): Promise<string> {
  const maskDataUri = `data:image/png;base64,${enBase64(masque)}`;

  const res = await fetch("https://api.replicate.com/v1/predictions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jeton}`,
      "Content-Type": "application/json",
      Prefer: "wait",
    },
    body: JSON.stringify({
      version: FLUX_FILL_VERSION,
      input: {
        image: imageUrl,
        mask: maskDataUri,
        // Prompt vide : on ne veut rien inventer, seulement prolonger le décor
        // existant là où le texte a été effacé.
        prompt: "",
        // Sortie ~1 Mpx : net et photoréaliste, largement assez pour TikTok,
        // et surtout assez léger pour que l'Edge Function tienne (match_input
        // sur une source 8 Mpx faisait exploser la mémoire du worker).
        megapixels: "1",
        output_format: "png",
        num_inference_steps: 28,
        // Contenu maison (photos lifestyle) : on coupe le checker de sortie
        // pour éviter un faux positif qui bloquerait un nettoyage légitime.
        disable_safety_checker: true,
      },
    }),
  });
  if (!res.ok) {
    throw new Error(`Replicate ${res.status}: ${(await res.text()).slice(0, 250)}`);
  }

  let prediction = await res.json();

  // Filet si `Prefer: wait` n'a pas suffi : on interroge jusqu'à la fin.
  for (let i = 0; i < 30 && (prediction.status === "starting" || prediction.status === "processing"); i += 1) {
    await new Promise((r) => setTimeout(r, 1500));
    const suivi = await fetch(prediction.urls.get, { headers: { Authorization: `Bearer ${jeton}` } });
    prediction = await suivi.json();
  }

  if (prediction.status !== "succeeded") {
    throw new Error(`Replicate ${prediction.status}: ${JSON.stringify(prediction.error ?? "").slice(0, 200)}`);
  }

  const sortie = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
  if (!sortie) throw new Error("Replicate: aucune image en sortie");

  const img = await fetch(sortie);
  if (!img.ok) throw new Error(`Replicate: récupération du résultat ${img.status}`);
  return enBase64(new Uint8Array(await img.arrayBuffer()));
}

/** Stability « Erase » : repli. A une modération qui refuse certains visuels. */
async function stabilityErase(
  cle: string,
  imageBytes: Uint8Array,
  mime: string,
  masque: Uint8Array,
  dims: { w: number; h: number },
): Promise<string> {
  const form = new FormData();
  form.append("image", new Blob([imageBytes], { type: mime }), "image");
  form.append("mask", new Blob([masque], { type: "image/png" }), "mask.png");
  form.append("output_format", "png");

  const res = await fetch("https://api.stability.ai/v2beta/stable-image/edit/erase", {
    method: "POST",
    headers: { Authorization: `Bearer ${cle}`, Accept: "image/*" },
    body: form,
  });
  if (!res.ok) {
    throw new Error(`Stability ${res.status} (${dims.w}×${dims.h}): ${(await res.text()).slice(0, 200)}`);
  }
  return enBase64(new Uint8Array(await res.arrayBuffer()));
}
