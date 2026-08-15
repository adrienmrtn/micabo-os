/**
 * Re-encode une vidéo (souvent WebM MediaRecorder) en MP4 H.264 propre
 * pour Kling motion-control, qui renvoie sinon « Video format is invalid ».
 *
 *   fal-ai/ffmpeg-api/metadata → dimensions
 *   fal-ai/workflow-utilities/scale-video → libx264 mp4
 */

import {
  falDownloadBytes,
  falQueueAwaitJson,
  falQueueSubmit,
  type FalQueueProgress,
} from "./fal_queue.ts";

const MODEL_META = "fal-ai/ffmpeg-api/metadata";
const MODEL_SCALE = "fal-ai/workflow-utilities/scale-video";

/** URL publique sans cache-buster `?v=` (Fal sniffe parfois mal). */
export function urlSansCacheBuster(url: string): string {
  const u = String(url ?? "").trim();
  const i = u.indexOf("?");
  return i >= 0 ? u.slice(0, i) : u;
}

export interface VideoMetaSonde {
  durationSec: number | null;
  fps: number | null;
  width: number | null;
  height: number | null;
}

export function formaterVideoMeta(m: VideoMetaSonde): string {
  const parts: string[] = [];
  if (m.durationSec != null) parts.push(`${m.durationSec.toFixed(2)}s`);
  if (m.fps != null && m.fps > 0) parts.push(`${m.fps} fps`);
  if (m.width && m.height) parts.push(`${m.width}×${m.height}`);
  return parts.length ? parts.join(" · ") : "?";
}

/** Durée / fps / résolution via fal-ai/ffmpeg-api/metadata (best-effort). */
export async function sonderVideoMeta(
  mediaUrl: string,
  onProgress?: FalQueueProgress,
): Promise<VideoMetaSonde> {
  const vide: VideoMetaSonde = {
    durationSec: null,
    fps: null,
    width: null,
    height: null,
  };
  const clean = urlSansCacheBuster(mediaUrl);
  if (!clean) return vide;
  try {
    const queuedMeta = await falQueueSubmit(
      MODEL_META,
      { media_url: clean, extract_frames: false },
      onProgress,
    );
    const meta = await falQueueAwaitJson(
      MODEL_META,
      queuedMeta,
      onProgress,
      120_000,
    );
    const payload = (meta?.data ?? meta) as {
      media?: {
        duration?: number;
        fps?: number;
        resolution?: { width?: number; height?: number };
        width?: number;
        height?: number;
      };
    };
    const m = payload.media;
    const d = Number(m?.duration ?? 0);
    const fps = Number(m?.fps ?? 0);
    const w = Number(m?.resolution?.width ?? m?.width ?? 0);
    const h = Number(m?.resolution?.height ?? m?.height ?? 0);
    return {
      durationSec: Number.isFinite(d) && d > 0 ? d : null,
      fps: Number.isFinite(fps) && fps > 0 ? fps : null,
      width: w >= 64 ? w : null,
      height: h >= 64 ? h : null,
    };
  } catch {
    return vide;
  }
}

/** Durée en secondes via fal-ai/ffmpeg-api/metadata (null si indisponible). */
export async function sonderDureeSec(
  mediaUrl: string,
  onProgress?: FalQueueProgress,
): Promise<number | null> {
  return (await sonderVideoMeta(mediaUrl, onProgress)).durationSec;
}

function pairPair(n: number): number {
  const v = Math.max(2, Math.round(n));
  return v % 2 === 0 ? v : v + 1;
}

/**
 * Retourne une URL MP4 H.264 (CDN Fal) utilisable par Kling.
 * Si l'entrée est déjà un mp4 « propre », on re-encode quand même (léger)
 * pour garantir codec/container acceptés.
 */
export async function normaliserVideoMp4PourKling(
  videoUrl: string,
  onProgress?: FalQueueProgress,
  opts?: { width?: number; height?: number },
): Promise<{ url: string; bytes: Uint8Array; mime: string }> {
  const clean = urlSansCacheBuster(videoUrl);
  if (!clean) throw new Error("normaliserVideoMp4: videoUrl vide");

  await onProgress?.({
    phase: "submit",
    detail: `normalise → MP4 H.264 · ${clean.slice(-48)}`,
  });

  // Dimensions source (best-effort) ; défaut 9:16 TikTok 1080p.
  let width = opts?.width ?? 1080;
  let height = opts?.height ?? 1920;
  try {
    const queuedMeta = await falQueueSubmit(
      MODEL_META,
      { media_url: clean, extract_frames: false },
      onProgress,
    );
    const meta = await falQueueAwaitJson(MODEL_META, queuedMeta, onProgress, 120_000);
    const payload = (meta?.data ?? meta) as {
      media?: {
        resolution?: { width?: number; height?: number };
        width?: number;
        height?: number;
      };
    };
    const m = payload.media;
    const w = Number(m?.resolution?.width ?? m?.width ?? 0);
    const h = Number(m?.resolution?.height ?? m?.height ?? 0);
    if (w >= 64 && h >= 64) {
      width = pairPair(w);
      height = pairPair(h);
      // Cap raisonnable (Kling / coûts) tout en gardant le ratio.
      const maxW = 1080;
      if (width > maxW) {
        const s = maxW / width;
        width = maxW;
        height = pairPair(height * s);
      }
    }
  } catch (e) {
    await onProgress?.({
      phase: "poll",
      detail: `metadata ignore (${e instanceof Error ? e.message : String(e)}) — défaut 1080×1920`,
    });
  }

  const queued = await falQueueSubmit(
    MODEL_SCALE,
    {
      video_url: clean,
      width,
      height,
      mode: "pad",
      pad_color: "black",
      codec: "libx264",
      preset: "fast",
      crf: 20,
    },
    onProgress,
  );
  const data = await falQueueAwaitJson(MODEL_SCALE, queued, onProgress, 300_000);
  const payload = (data?.data ?? data) as {
    video?: { url?: string; content_type?: string };
  };
  const url = payload?.video?.url;
  if (!url) {
    throw new Error(
      `normaliserVideoMp4: pas de video.url — ${JSON.stringify(data).slice(0, 280)}`,
    );
  }
  const dl = await falDownloadBytes(url, onProgress);
  return {
    url: dl.url,
    bytes: dl.bytes,
    mime: payload.video?.content_type ?? "video/mp4",
  };
}
