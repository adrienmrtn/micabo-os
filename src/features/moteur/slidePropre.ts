import type { PostSlide } from "./types";

export function estPropre(slide: PostSlide): boolean {
  return Boolean(slide.media_library?.storage_path?.startsWith("propre/"));
}
