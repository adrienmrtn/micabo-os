/**
 * Fal — ffmpeg merge-audio-video (clip muet + voix).
 *   fal-ai/ffmpeg-api/merge-audio-video
 */

import {
  falDownloadBytes,
  falQueueAwaitJson,
  falQueueSubmit,
  type FalQueueProgress,
} from "./fal_queue.ts";
import { urlSansCacheBuster } from "./fal_normaliser_video.ts";

const MODEL = "fal-ai/ffmpeg-api/merge-audio-video";

export async function mergerAudioVideoFal(input: {
  videoUrl: string;
  audioUrl: string;
  onProgress?: FalQueueProgress;
}): Promise<{ url: string; bytes: Uint8Array; mime: string }> {
  const video_url = urlSansCacheBuster(input.videoUrl);
  const audio_url = urlSansCacheBuster(input.audioUrl);
  if (!video_url || !audio_url) throw new Error("merge-audio-video: urls vides");
  const queued = await falQueueSubmit(
    MODEL,
    { video_url, audio_url, start_offset: 0 },
    input.onProgress,
  );
  const data = await falQueueAwaitJson(MODEL, queued, input.onProgress, 180_000);
  const payload = (data?.data ?? data) as { video?: { url?: string; content_type?: string } };
  const url = payload?.video?.url;
  if (!url) {
    throw new Error(
      `merge-audio-video: pas de video.url — ${JSON.stringify(data).slice(0, 280)}`,
    );
  }
  const dl = await falDownloadBytes(url, input.onProgress);
  return {
    url: dl.url,
    bytes: dl.bytes,
    mime: payload.video?.content_type?.includes("video") ? payload.video.content_type : "video/mp4",
  };
}
