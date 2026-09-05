/**
 * LLM via Fal OpenRouter — texte (`openrouter/router`) et vision
 * (`openrouter/router/vision`). Une seule clé : FAL_KEY.
 */

import { falAuthHeaders, falKey, falQueueAwaitJson, falQueueSubmit } from "./fal_queue.ts";

const TEXTE = "openrouter/router";
const VISION = "openrouter/router/vision";

/** `gemini-2.5-flash` → `google/gemini-2.5-flash` (déjà préfixé : inchangé). */
export function versModeleOpenRouter(model: string): string {
  const m = model.trim();
  if (!m) return "google/gemini-2.5-flash";
  if (m.includes("/")) return m;
  return `google/${m}`;
}

function extraireOutput(data: unknown): string {
  if (typeof data === "string") return data.trim();
  if (!data || typeof data !== "object") return "";
  const o = data as Record<string, unknown>;
  if (typeof o.output === "string") return o.output.trim();
  if (typeof o.text === "string") return o.text.trim();
  if (typeof o.error === "string" && o.error) {
    throw new Error(`Fal LLM: ${o.error}`);
  }
  const nested = o.data;
  if (nested && typeof nested === "object") {
    const d = nested as Record<string, unknown>;
    if (typeof d.output === "string") return d.output.trim();
    if (typeof d.text === "string") return d.text.trim();
  }
  return "";
}

export async function falLlmTexte(input: {
  prompt: string;
  model: string;
  temperature?: number;
  imageUrls?: string[];
}): Promise<string> {
  const key = falKey();
  if (!key) throw new Error("FAL_KEY manquant");

  const images = (input.imageUrls ?? []).filter(Boolean);
  const endpoint = images.length ? VISION : TEXTE;
  const body: Record<string, unknown> = {
    prompt: input.prompt,
    model: versModeleOpenRouter(input.model),
    reasoning: false,
  };
  if (typeof input.temperature === "number") body.temperature = input.temperature;
  if (images.length) body.image_urls = images;

  const sync = await fetch(`https://fal.run/${endpoint}`, {
    method: "POST",
    headers: falAuthHeaders(key),
    body: JSON.stringify(body),
  });
  const syncTexte = await sync.text();
  if (sync.ok) {
    try {
      const out = extraireOutput(JSON.parse(syncTexte));
      if (out) return out;
    } catch {
      if (syncTexte.trim()) return syncTexte.trim();
    }
  }
  if (sync.status === 404 || sync.status === 422) {
    throw new Error(`Fal LLM MODEL_REJECTED:${sync.status}:${syncTexte.slice(0, 180)}`);
  }

  const queued = await falQueueSubmit(endpoint, body);
  const result = await falQueueAwaitJson(endpoint, queued, undefined, 180_000);
  const out = extraireOutput(result);
  if (!out) {
    throw new Error(`Fal LLM vide: ${JSON.stringify(result).slice(0, 200)}`);
  }
  return out;
}
