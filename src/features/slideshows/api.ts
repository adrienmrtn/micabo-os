import { supabase } from "@/lib/supabase/client";
import type {
  PipelineStatus,
  PosterSlideshow,
  SlideshowFrame,
  SlideshowWithDetails,
  SophiaVariant,
} from "./types";

/** Date du jour en YYYY-MM-DD, en heure locale (pas UTC : un poster raisonne
 *  sur sa propre journée, pas sur celle de Greenwich). */
export function today(): string {
  const now = new Date();
  const offsetMs = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offsetMs).toISOString().slice(0, 10);
}

// --- Admin ------------------------------------------------------------------

export async function listSlideshows(
  status?: PipelineStatus,
): Promise<SlideshowWithDetails[]> {
  let query = supabase
    .from("slideshows")
    .select("*, tiktok_accounts(handle, niche), profiles(display_name)")
    .order("created_at", { ascending: false })
    .limit(100);

  if (status) query = query.eq("auto_pipeline_status", status);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as SlideshowWithDetails[];
}

export async function createManualSlideshow(input: {
  tiktokAccountId: string | null;
  posterId: string | null;
  sourceUrl: string;
  title: string;
  hookTitle: string;
  assignedDate: string | null;
}): Promise<SlideshowWithDetails> {
  const { data, error } = await supabase
    .from("slideshows")
    .insert({
      tiktok_account_id: input.tiktokAccountId,
      poster_id: input.posterId,
      source_url: input.sourceUrl.trim() || null,
      title: input.title.trim() || null,
      hook_title: input.hookTitle.trim() || null,
      assigned_date: input.assignedDate,
      is_auto_generated: false,
      // Import manuel : le contenu est déjà prêt, il ne passe pas par le pipeline.
      auto_pipeline_status: "done",
    })
    .select("*, tiktok_accounts(handle, niche), profiles(display_name)")
    .single();

  if (error) throw error;
  return data as SlideshowWithDetails;
}

export async function retryPipeline(slideshowId: string): Promise<void> {
  const { error } = await supabase
    .from("slideshows")
    .update({
      auto_pipeline_status: "pending",
      auto_pipeline_error: null,
      auto_pipeline_step: null,
    })
    .eq("id", slideshowId);

  if (error) throw error;
}

export async function assignSlideshow(input: {
  slideshowId: string;
  posterId: string | null;
  assignedDate: string | null;
}): Promise<void> {
  const { error } = await supabase
    .from("slideshows")
    .update({ poster_id: input.posterId, assigned_date: input.assignedDate })
    .eq("id", input.slideshowId);

  if (error) throw error;
}

// --- Frames -----------------------------------------------------------------

export async function listFrames(slideshowId: string): Promise<SlideshowFrame[]> {
  const { data, error } = await supabase
    .from("slideshow_frames")
    .select("*")
    .eq("slideshow_id", slideshowId)
    .order("position");

  if (error) throw error;
  return (data ?? []) as SlideshowFrame[];
}

export async function addFrame(input: {
  slideshowId: string;
  position: number;
  originalUrl: string;
  translatedText: string;
}): Promise<void> {
  const { error } = await supabase.from("slideshow_frames").insert({
    slideshow_id: input.slideshowId,
    position: input.position,
    original_url: input.originalUrl.trim() || null,
    cleaned_url: input.originalUrl.trim() || null,
    translated_text: input.translatedText.trim() || null,
    clean_status: "done",
  });

  if (error) throw error;
}

export async function updateFrameText(
  frameId: string,
  translatedText: string,
): Promise<void> {
  const { error } = await supabase
    .from("slideshow_frames")
    .update({ translated_text: translatedText })
    .eq("id", frameId);

  if (error) throw error;
}

export async function deleteFrame(frameId: string): Promise<void> {
  const { error } = await supabase.from("slideshow_frames").delete().eq("id", frameId);
  if (error) throw error;
}

// --- Variantes Sophia -------------------------------------------------------

export async function listVariants(slideshowId: string): Promise<SophiaVariant[]> {
  const { data, error } = await supabase
    .from("sophia_variants")
    .select("*")
    .eq("slideshow_id", slideshowId)
    .order("created_at");

  if (error) throw error;
  return (data ?? []) as SophiaVariant[];
}

/**
 * Corriger une variante, c'est aussi enseigner : la correction est archivée
 * pour être réinjectée en few-shot dans les prochaines générations.
 */
export async function correctVariant(input: {
  variantId: string;
  slideshowId: string;
  frameId: string | null;
  originalText: string;
  correctedText: string;
  adminId: string;
}): Promise<void> {
  const { error } = await supabase
    .from("sophia_variants")
    .update({ text: input.correctedText, chosen: true })
    .eq("id", input.variantId);
  if (error) throw error;

  const { error: correctionError } = await supabase.from("sophia_corrections").insert({
    slideshow_id: input.slideshowId,
    frame_id: input.frameId,
    original_text: input.originalText,
    corrected_text: input.correctedText,
    admin_id: input.adminId,
  });
  if (correctionError) throw correctionError;
}

// --- Poster -----------------------------------------------------------------

export async function listMySlideshowsForDate(
  posterId: string,
  date: string,
): Promise<PosterSlideshow[]> {
  const { data, error } = await supabase
    .from("poster_slideshows")
    .select("*")
    .eq("poster_id", posterId)
    .eq("assigned_date", date)
    .order("created_at");

  if (error) throw error;
  return (data ?? []) as PosterSlideshow[];
}

export async function listMySlideshows(posterId: string): Promise<PosterSlideshow[]> {
  const { data, error } = await supabase
    .from("poster_slideshows")
    .select("*")
    .eq("poster_id", posterId)
    .order("assigned_date", { ascending: false })
    .limit(60);

  if (error) throw error;
  return (data ?? []) as PosterSlideshow[];
}

export async function getPosterSlideshow(id: string): Promise<PosterSlideshow | null> {
  const { data, error } = await supabase
    .from("poster_slideshows")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return null;
  return data as PosterSlideshow;
}

export async function markAsPosted(input: {
  slideshowId: string;
  postedUrl: string;
}): Promise<void> {
  const { error } = await supabase
    .from("slideshows")
    .update({
      posted_at: new Date().toISOString(),
      posted_url: input.postedUrl.trim() || null,
    })
    .eq("id", input.slideshowId);

  if (error) throw error;
}
