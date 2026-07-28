/**
 * Nettoyage d'image via Fal AI — Bytedance Seedream 5.0 Pro Edit.
 *
 * Secret requis : `FAL_KEY` (Supabase Edge Function secrets).
 * Endpoint : bytedance/seedream/v5/pro/edit
 *
 * On passe par la queue REST (pas le client npm) pour rester compatible Deno.
 */

const MODEL = "bytedance/seedream/v5/pro/edit";
const QUEUE = `https://queue.fal.run/${MODEL}`;

const PROMPT_NETTOYAGE = `Subtle photo restoration.
1. Remove ONLY elements added ON TOP of the photo: captions, subtitles, stickers, watermarks, usernames, UI buttons, CTAs, interface logos, TikTok watermark.
2. Naturally reconstruct the background under those elements so the edit is invisible.
3. NEVER change the person, face, hands, clothes, real objects, background, lighting, colors, or framing.
4. Do not generate any new text, logo, badge, or watermark.
5. Return only the cleaned image.`;

function falKey(): string | null {
  return Deno.env.get("FAL_KEY") ?? Deno.env.get("FAL_API_KEY") ?? null;
}

function enBase64(bytes: Uint8Array): string {
  let binaire = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binaire += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binaire);
}

function authHeaders(key: string): Record<string, string> {
  return {
    Authorization: `Key ${key}`,
    "Content-Type": "application/json",
  };
}

/**
 * Nettoie `imageUrl` via Seedream. Renvoie le JPEG/PNG en base64, ou `null`
 * si `FAL_KEY` n'est pas configuré (l'appelant bascule alors sur un autre voie).
 */
export async function nettoyerViaSeedream(imageUrl: string): Promise<string | null> {
  const key = falKey();
  if (!key) return null;

  const safety =
    (Deno.env.get("FAL_ENABLE_SAFETY") ?? "false").toLowerCase() === "true";

  const submit = await fetch(QUEUE, {
    method: "POST",
    headers: authHeaders(key),
    body: JSON.stringify({
      prompt: PROMPT_NETTOYAGE,
      image_urls: [imageUrl],
      image_size: "auto_2K",
      num_images: 1,
      output_format: "jpeg",
      enable_safety_checker: safety,
    }),
  });

  if (!submit.ok) {
    throw new Error(
      `Fal Seedream submit ${submit.status}: ${(await submit.text()).slice(0, 300)}`,
    );
  }

  const queued = await submit.json();
  const requestId = queued.request_id as string | undefined;
  const statusUrl =
    (queued.status_url as string | undefined) ??
    (requestId ? `${QUEUE}/requests/${requestId}/status` : null);
  const resultUrl =
    (queued.response_url as string | undefined) ??
    (requestId ? `${QUEUE}/requests/${requestId}` : null);

  if (!statusUrl || !resultUrl) {
    throw new Error(`Fal Seedream: réponse queue invalide ${JSON.stringify(queued).slice(0, 200)}`);
  }

  // Budget Edge Function : on poll jusqu'à ~100 s.
  const debut = Date.now();
  const BUDGET = 100_000;
  let statut = queued.status as string | undefined;

  while (Date.now() - debut < BUDGET) {
    const st = await fetch(`${statusUrl}?logs=0`, { headers: authHeaders(key) });
    if (!st.ok) {
      throw new Error(`Fal Seedream status ${st.status}: ${(await st.text()).slice(0, 250)}`);
    }
    const body = await st.json();
    statut = body.status as string;

    if (statut === "COMPLETED") break;
    if (statut === "FAILED" || statut === "CANCELLED") {
      throw new Error(
        `Fal Seedream ${statut}: ${JSON.stringify(body.error ?? body).slice(0, 250)}`,
      );
    }
    await new Promise((r) => setTimeout(r, 1500));
  }

  if (statut !== "COMPLETED") {
    throw new Error(`Fal Seedream: timeout (${BUDGET / 1000}s), dernier statut=${statut}`);
  }

  const res = await fetch(resultUrl, { headers: authHeaders(key) });
  if (!res.ok) {
    throw new Error(`Fal Seedream result ${res.status}: ${(await res.text()).slice(0, 250)}`);
  }
  const data = await res.json();
  // Parfois le résultat est sous .data (client), parfois à la racine (REST).
  const payload = data?.data ?? data;
  const url = payload?.images?.[0]?.url as string | undefined;
  if (!url) {
    throw new Error(`Fal Seedream: aucune image — ${JSON.stringify(payload).slice(0, 250)}`);
  }

  const img = await fetch(url);
  if (!img.ok) throw new Error(`Fal Seedream: téléchargement résultat ${img.status}`);
  return enBase64(new Uint8Array(await img.arrayBuffer()));
}
