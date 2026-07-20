export type PipelineStatus = "pending" | "running" | "done" | "failed";

export interface Slideshow {
  id: string;
  tiktok_account_id: string | null;
  poster_id: string | null;
  source_url: string | null;
  title: string | null;
  hook_title: string | null;
  audio_url: string | null;
  is_auto_generated: boolean;
  auto_pipeline_status: PipelineStatus;
  auto_pipeline_error: string | null;
  auto_pipeline_step: string | null;
  relevance_score: number | null;
  relevance_reason: string | null;
  assigned_date: string | null;
  posted_at: string | null;
  posted_url: string | null;
  created_at: string;
}

export interface SlideshowWithDetails extends Slideshow {
  tiktok_accounts: { handle: string; niche: string | null } | null;
  profiles: { display_name: string | null } | null;
}

export interface SlideshowFrame {
  id: string;
  slideshow_id: string;
  position: number;
  original_url: string | null;
  cleaned_url: string | null;
  extracted_text: string | null;
  translated_text: string | null;
  clean_status: PipelineStatus;
  clean_attempts: number;
  is_sophia_slide: boolean;
  image_source: "original" | "cleaned" | "library";
}

/** Vue poster : jamais de tiktok_account_id, jamais de source_url. */
export interface PosterSlideshow {
  id: string;
  poster_id: string;
  title: string | null;
  hook_title: string | null;
  audio_url: string | null;
  assigned_date: string | null;
  posted_at: string | null;
  posted_url: string | null;
  created_at: string;
  suggested_creator_handle: string | null;
  niche: string | null;
}

export interface SophiaVariant {
  id: string;
  slideshow_id: string;
  frame_id: string | null;
  text: string;
  chosen: boolean;
}
