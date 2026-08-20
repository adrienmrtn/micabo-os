/**
 * Captions visuelles via Fal :
 *   1. fal-ai/florence-2-large/more-detailed-caption
 *   2. fallback fal-ai/moondream2/visual-query
 *
 * Secret : FAL_KEY | FAL_API_KEY
 */

import { falAuthHeaders, falKey, falQueueAwaitJson, falQueueSubmit } from "./fal_queue.ts";

export const FLORENCE_MODEL = "fal-ai/florence-2-large/more-detailed-caption";
export const MOONDREAM_MODEL = "fal-ai/moondream2/visual-query";

const CAPTION_MAX = 180;

const MOONDREAM_PROMPT =
  "Describe this image in one short basic sentence. Focus on the main subject and setting. No lists.";

export type CaptionStatut = "ok" | "aucune";
export type CaptionModele = "florence" | "moondream" | "none";

export interface CaptionResultat {
  caption: string | null;
  statut: CaptionStatut;
  modele: CaptionModele;
  lignes: string[];
}

export function captionEstVide(texte: string | null | undefined): boolean {
  if (!texte) return true;
  const t = texte.replace(/\s+/g, " ").trim();
  if (t.length < 3) return true;
  return /^(none|n\/a|null|undefined|empty|\(aucun texte\)|no caption|unknown)\.?$/i.test(t);
}

export function raccourcirCaption(brut: string, max = CAPTION_MAX): string {
  const t = brut.replace(/\s+/g, " ").trim();
  if (!t) return "";
  const phrase = t.split(/(?<=[.!?])\s+/)[0] ?? t;
  const source = phrase.length <= max * 1.4 ? phrase : t;
  if (source.length <= max) return source;
  const coupe = source.slice(0, max - 1);
  const dernierEspace = coupe.lastIndexOf(" ");
  const base = (dernierEspace > 40 ? coupe.slice(0, dernierEspace) : coupe).trim();
  return `${base}…`;
}

function texteDepuisObjet(o: Record<string, unknown>): string {
  const cles = ["results", "result", "output", "text", "caption", "description", "response"];
  for (const k of cles) {
    const v = o[k];
    if (typeof v === "string" && v.trim()) return v;
  }
  const nested = o.data;
  if (nested && typeof nested === "object") {
    return texteDepuisObjet(nested as Record<string, unknown>);
  }
  return "";
}

export function extraireCaptionFal(data: unknown): string {
  if (typeof data === "string") return data.trim();
  if (!data || typeof data !== "object") return "";
  return texteDepuisObjet(data as Record<string, unknown>).trim();
}

export function normaliserCaptionOk(brut: string): string | null {
  const court = raccourcirCaption(brut);
  return captionEstVide(court) ? null : court;
}

async function falVisionJson(
  modelId: string,
  body: Record<string, unknown>,
  budgetMs = 120_000,
): Promise<Record<string, unknown>> {
  const key = falKey();
  if (!key) throw new Error("FAL_KEY manquant");

  const sync = await fetch(`https://fal.run/${modelId}`, {
    method: "POST",
    headers: falAuthHeaders(key),
    body: JSON.stringify(body),
  });
  const syncTexte = await sync.text();
  if (sync.ok) {
    try {
      return JSON.parse(syncTexte) as Record<string, unknown>;
    } catch {
      return { results: syncTexte };
    }
  }

  const queued = await falQueueSubmit(modelId, body);
  return await falQueueAwaitJson(modelId, queued, undefined, budgetMs);
}

async function captionFlorence(imageUrl: string): Promise<string> {
  const data = await falVisionJson(FLORENCE_MODEL, { image_url: imageUrl });
  return extraireCaptionFal(data);
}

async function captionMoondream(imageUrl: string): Promise<string> {
  const data = await falVisionJson(MOONDREAM_MODEL, {
    image_url: imageUrl,
    prompt: MOONDREAM_PROMPT,
  });
  return extraireCaptionFal(data);
}

/**
 * Florence → Moondream → « pas de caption reconnue ».
 * Ne jette pas : un échec total renvoie statut `aucune`.
 */
export async function capturerCaptionImage(imageUrl: string): Promise<CaptionResultat> {
  const lignes: string[] = [];
  if (!imageUrl) {
    return {
      caption: null,
      statut: "aucune",
      modele: "none",
      lignes: ["url image manquante — pas de caption reconnue"],
    };
  }
  if (!falKey()) {
    throw new Error("FAL_KEY manquant");
  }

  try {
    lignes.push(`① Florence-2 more-detailed-caption`);
    const brut = await captionFlorence(imageUrl);
    const ok = normaliserCaptionOk(brut);
    if (ok) {
      lignes.push(`✓ florence (${ok.length} car.)`);
      return { caption: ok, statut: "ok", modele: "florence", lignes };
    }
    lignes.push(`✗ florence vide / illisible: ${(brut || "").slice(0, 80)}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    lignes.push(`✗ florence: ${msg.slice(0, 180)}`);
  }

  try {
    lignes.push(`② fallback Moondream2 visual-query`);
    const brut = await captionMoondream(imageUrl);
    const ok = normaliserCaptionOk(brut);
    if (ok) {
      lignes.push(`✓ moondream (${ok.length} car.)`);
      return { caption: ok, statut: "ok", modele: "moondream", lignes };
    }
    lignes.push(`✗ moondream vide / illisible: ${(brut || "").slice(0, 80)}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    lignes.push(`✗ moondream: ${msg.slice(0, 180)}`);
  }

  lignes.push("→ abandon — pas de caption reconnue");
  return { caption: null, statut: "aucune", modele: "none", lignes };
}
