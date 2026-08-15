/**
 * Fal — trim temporel lossless quand possible
 *   fal-ai/workflow-utilities/trim-video
 *
 * Stream copy (pas de recodage) → FPS / bitrate / codec de la source conservés.
 * Sert à couper les reactions TikTok sans passer par MediaRecorder canvas.
 */

import {
  falDownloadBytes,
  falQueueAwaitJson,
  falQueueSubmit,
  type FalQueueProgress,
} from "./fal_queue.ts";
import { urlSansCacheBuster } from "./fal_normaliser_video.ts";

const MODEL = "fal-ai/workflow-utilities/trim-video";

export async function trimmerVideoFal(input: {
  videoUrl: string;
  startSec: number;
  endSec: number;
  onProgress?: FalQueueProgress;
}): Promise<{ url: string; bytes: Uint8Array; mime: string; trimmedDuration: number | null }> {
  const video_url = urlSansCacheBuster(input.videoUrl);
  if (!video_url) throw new Error("trim-video: videoUrl vide");
  const start = Math.max(0, input.startSec);
  const end = Math.max(start + 0.05, input.endSec);

  const queued = await falQueueSubmit(
    MODEL,
    {
      video_url,
      start_time: start,
      end_time: end,
    },
    input.onProgress,
  );
  const data = await falQueueAwaitJson(MODEL, queued, input.onProgress, 180_000);
  const payload = (data?.data ?? data) as {
    video?: { url?: string; content_type?: string };
    trimmed_duration?: number;
  };
  const url = payload?.video?.url;
  if (!url) {
    throw new Error(
      `trim-video: pas de video.url — ${JSON.stringify(data).slice(0, 300)}`,
    );
  }
  const dl = await falDownloadBytes(url, input.onProgress);
  const trimmed = Number(payload.trimmed_duration ?? 0);
  return {
    url: dl.url,
    bytes: dl.bytes,
    mime: payload.video?.content_type?.includes("video")
      ? payload.video.content_type
      : "video/mp4",
    trimmedDuration: Number.isFinite(trimmed) && trimmed > 0 ? trimmed : null,
  };
}
