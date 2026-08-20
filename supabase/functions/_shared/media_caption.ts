/**
 * Persistance captions visuelles + label Hook (1ʳᵉ slide).
 */

import {
  capturerCaptionImage,
  type CaptionModele,
  type CaptionResultat,
  type CaptionStatut,
} from "./fal_caption.ts";
import { messageErreur, serviceClient } from "./supabase.ts";

export type Supabase = ReturnType<typeof serviceClient>;

export const SLUG_HOOK = "hook";

export interface CaptionPersistee {
  mediaId: string;
  caption: string | null;
  statut: CaptionStatut;
  modele: CaptionModele;
  estHook: boolean;
  lignes: string[];
}

let hookLabelIdCache: string | null | undefined;

export async function idLabelHook(supabase: Supabase): Promise<string | null> {
  if (hookLabelIdCache !== undefined) return hookLabelIdCache;
  const { data, error } = await supabase
    .from("labels")
    .select("id")
    .eq("slug", SLUG_HOOK)
    .maybeSingle();
  if (error) {
    hookLabelIdCache = null;
    return null;
  }
  hookLabelIdCache = (data?.id as string | undefined) ?? null;
  return hookLabelIdCache;
}

export function mediaEstPremiereSlide(
  mediaId: string,
  slides: Array<{ position?: number | null; media_id?: string | null }> | null | undefined,
): boolean {
  if (!mediaId) return false;
  return (slides ?? []).some(
    (s) => s.media_id === mediaId && Number(s.position) === 1,
  );
}

/** `propre/{contenu}/1.jpg` ou `brut/{contenu}/1`. */
export function pathEstPremiereSlide(storagePath: string | null | undefined): boolean {
  return /(?:^|\/)(?:propre|brut)\/[^/]+\/1(?:\.|$)/.test(storagePath ?? "");
}

/** Attache le label Hook + flag `est_hook` (idempotent). */
export async function assurerHookMedia(
  supabase: Supabase,
  mediaId: string,
): Promise<boolean> {
  const labelId = await idLabelHook(supabase);
  const { error: errFlag } = await supabase
    .from("media_library")
    .update({ est_hook: true })
    .eq("id", mediaId);
  if (errFlag) throw errFlag;
  if (!labelId) return true;
  const { error } = await supabase.from("media_labels").upsert(
    { media_id: mediaId, label_id: labelId },
    { onConflict: "media_id,label_id" },
  );
  if (error) throw error;
  return true;
}

export async function estPremiereSlideDuContenu(
  supabase: Supabase,
  mediaId: string,
  contenuId?: string | null,
  storagePath?: string | null,
): Promise<boolean> {
  if (pathEstPremiereSlide(storagePath)) return true;
  if (contenuId) {
    const { data } = await supabase
      .from("contenus")
      .select("structure_slides")
      .eq("id", contenuId)
      .maybeSingle();
    return mediaEstPremiereSlide(
      mediaId,
      (data?.structure_slides ?? []) as Array<{ position?: number; media_id?: string }>,
    );
  }

  const { data: media } = await supabase
    .from("media_library")
    .select("id, contenu_id, storage_path")
    .eq("id", mediaId)
    .maybeSingle();
  if (!media) return false;
  if (pathEstPremiereSlide(media.storage_path as string | null)) return true;
  if (media.contenu_id) {
    return estPremiereSlideDuContenu(
      supabase,
      mediaId,
      media.contenu_id as string,
      media.storage_path as string | null,
    );
  }
  return false;
}

export async function persisterCaption(
  supabase: Supabase,
  mediaId: string,
  r: CaptionResultat,
): Promise<void> {
  const { error } = await supabase
    .from("media_library")
    .update({
      caption: r.caption,
      caption_statut: r.statut,
      caption_modele: r.modele,
      caption_le: new Date().toISOString(),
    })
    .eq("id", mediaId);
  if (error) throw error;
}

/**
 * Captionne un média déjà en bibliothèque (URL stockée — pas besoin de TikTok).
 * Applique aussi Hook si c'est la 1ʳᵉ slide.
 */
export async function captionnerMedia(
  supabase: Supabase,
  mediaId: string,
  opts: { forcer?: boolean; imageUrl?: string | null } = {},
): Promise<CaptionPersistee> {
  const { data: media, error } = await supabase
    .from("media_library")
    .select("id, url, caption_statut, contenu_id, est_hook, storage_path")
    .eq("id", mediaId)
    .maybeSingle();
  if (error) throw error;
  if (!media) throw new Error("média introuvable");

  const lignes: string[] = [];
  let caption = null as string | null;
  let statut: CaptionStatut = "aucune";
  let modele: CaptionModele = "none";

  const deja = media.caption_statut as CaptionStatut | null;
  if (deja && !opts.forcer) {
    lignes.push(`déjà captionné (${deja}) — skip modèle`);
    const { data: frais } = await supabase
      .from("media_library")
      .select("caption, caption_statut, caption_modele, est_hook")
      .eq("id", mediaId)
      .single();
    caption = (frais?.caption as string | null) ?? null;
    statut = (frais?.caption_statut as CaptionStatut) ?? deja;
    modele = (frais?.caption_modele as CaptionModele) ?? "none";
  } else {
    const url = (opts.imageUrl || (media.url as string) || "").trim();
    lignes.push(`url=${url.slice(0, 72)}${url.length > 72 ? "…" : ""}`);
    const r = await capturerCaptionImage(url);
    lignes.push(...r.lignes);
    await persisterCaption(supabase, mediaId, r);
    caption = r.caption;
    statut = r.statut;
    modele = r.modele;
  }

  let estHook = Boolean(media.est_hook);
  try {
    const premiere = await estPremiereSlideDuContenu(
      supabase,
      mediaId,
      media.contenu_id as string | null,
      media.storage_path as string | null,
    );
    if (premiere) {
      await assurerHookMedia(supabase, mediaId);
      estHook = true;
      lignes.push("label Hook (1ʳᵉ slide)");
    }
  } catch (e) {
    lignes.push(`warn hook: ${messageErreur(e)}`);
  }

  return { mediaId, caption, statut, modele, estHook, lignes };
}

/** Slides d'un contenu dont le media n'a pas encore de `caption_statut`. */
export async function slidesSansCaption(
  supabase: Supabase,
  slides: Array<{ position: number; media_id: string | null; raw_url?: string | null }>,
): Promise<Array<{ position: number; media_id: string; raw_url?: string | null }>> {
  const ids = slides
    .map((s) => s.media_id)
    .filter((id): id is string => Boolean(id));
  if (ids.length === 0) return [];
  const { data } = await supabase
    .from("media_library")
    .select("id, caption_statut")
    .in("id", ids);
  const faits = new Set(
    (data ?? [])
      .filter((m) => m.caption_statut != null)
      .map((m) => m.id as string),
  );
  return slides
    .filter((s): s is { position: number; media_id: string; raw_url?: string | null } =>
      Boolean(s.media_id) && !faits.has(s.media_id as string),
    );
}

export async function listerMediasARattraper(
  supabase: Supabase,
  opts: { limit?: number } = {},
): Promise<{ id: string; url: string; motif: "caption" | "hook" }[]> {
  const limit = Math.min(2000, Math.max(1, opts.limit ?? 400));
  const { data: sansCaption, error } = await supabase
    .from("media_library")
    .select("id, url")
    .like("storage_path", "propre/%")
    .is("caption_statut", null)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw error;

  const out: { id: string; url: string; motif: "caption" | "hook" }[] = [];
  const vus = new Set<string>();
  for (const m of sansCaption ?? []) {
    vus.add(m.id as string);
    out.push({ id: m.id as string, url: m.url as string, motif: "caption" });
  }

  if (out.length >= limit) return out;

  // Hooks manquants : 1ʳᵉ slide sans est_hook (déjà captionnée ou non).
  const restant = limit - out.length;
  const { data: contenus } = await supabase
    .from("contenus")
    .select("structure_slides")
    .eq("statut", "valide")
    .order("created_at", { ascending: false })
    .limit(300);
  const hookIds: string[] = [];
  for (const c of contenus ?? []) {
    for (const s of (c.structure_slides ?? []) as Array<{
      position?: number;
      media_id?: string;
    }>) {
      if (Number(s.position) === 1 && s.media_id && !vus.has(s.media_id)) {
        hookIds.push(s.media_id);
      }
    }
  }
  const uniques = [...new Set(hookIds)].slice(0, restant);
  if (uniques.length === 0) return out;

  const { data: hooks } = await supabase
    .from("media_library")
    .select("id, url, est_hook")
    .in("id", uniques)
    .eq("est_hook", false);
  for (const m of hooks ?? []) {
    out.push({ id: m.id as string, url: m.url as string, motif: "hook" });
  }
  return out;
}
