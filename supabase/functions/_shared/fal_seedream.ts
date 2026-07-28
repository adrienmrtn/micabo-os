/**
 * Nettoyage d'image via Fal AI — Bytedance Seedream 5.0 Pro Edit.
 *
 * Secret requis : `FAL_KEY` (Supabase Edge Function secrets).
 * Endpoint : bytedance/seedream/v5/pro/edit
 *
 * On passe par la queue REST (pas le client npm) pour rester compatible Deno.
 *
 * Note : le partenaire ByteDance applique SA propre validation même avec
 * `enable_safety_checker: false` — certaines photos TikTok renvoient alors
 * un 422 `content_policy_violation`. L'appelant doit basculer sur LaMa/proxy.
 */

const MODEL = "bytedance/seedream/v5/pro/edit";
const QUEUE = `https://queue.fal.run/${MODEL}`;

/** Prompt volontairement minimal — demandé pour le recyclage. */
export const PROMPT_NETTOYAGE_SEEDREAM =
  "Keep the photo, only get rid of the text overlay.";

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
 * Nettoie `imageUrl` via Seedream. Renvoie le JPEG en base64, ou `null`
 * si `FAL_KEY` n'est pas configuré.
 */
export async function nettoyerViaSeedream(imageUrl: string): Promise<string | null> {
  const key = falKey();
  if (!key) return null;

  // auto_1K : ~1–2 min vs auto_2K qui dépasse souvent le budget Edge.
  // enable_safety_checker false : on le demande, même si le partenaire peut
  // quand même appliquer sa validation (422 content_policy).
  const submit = await fetch(QUEUE, {
    method: "POST",
    headers: authHeaders(key),
    body: JSON.stringify({
      prompt: PROMPT_NETTOYAGE_SEEDREAM,
      image_urls: [imageUrl],
      image_size: "auto_1K",
      num_images: 1,
      output_format: "jpeg",
      enable_safety_checker: false,
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

  const debut = Date.now();
  const BUDGET = 140_000;
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
    await new Promise((r) => setTimeout(r, 2000));
  }

  if (statut !== "COMPLETED") {
    throw new Error(`Fal Seedream: timeout (${BUDGET / 1000}s), dernier statut=${statut}`);
  }

  const res = await fetch(resultUrl, { headers: authHeaders(key) });
  const texte = await res.text();
  if (!res.ok) {
    // ByteDance partner checker : souvent un 422 alors que status=COMPLETED.
    if (/content_policy|partner_validation/i.test(texte)) {
      throw new Error(`Fal Seedream: content_policy (partenaire) — ${texte.slice(0, 180)}`);
    }
    throw new Error(`Fal Seedream result ${res.status}: ${texte.slice(0, 250)}`);
  }

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(texte);
  } catch {
    throw new Error(`Fal Seedream: JSON invalide ${texte.slice(0, 200)}`);
  }
  const payload = (data?.data ?? data) as {
    images?: Array<{ url?: string }>;
  };
  const url = payload?.images?.[0]?.url;
  if (!url) {
    throw new Error(`Fal Seedream: aucune image — ${texte.slice(0, 250)}`);
  }

  const img = await fetch(url);
  if (!img.ok) throw new Error(`Fal Seedream: téléchargement résultat ${img.status}`);
  return enBase64(new Uint8Array(await img.arrayBuffer()));
}
