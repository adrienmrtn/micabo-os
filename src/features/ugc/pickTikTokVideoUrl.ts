/** Choix de l’URL vidéo Apify — pas de recodage, octets tels quels. */
export function pickTikTokVideoUrl(item: {
  mediaUrls?: string[];
  videoMeta?: { downloadAddr?: string };
}): string | null {
  const media = (item.mediaUrls ?? []).filter(
    (u): u is string => typeof u === "string" && u.length > 0,
  );
  const mp4s = media.filter((u) => /\.mp4(\?|$)/i.test(u));
  if (mp4s.length > 0) return mp4s[mp4s.length - 1]!;
  if (media.length > 0) return media[media.length - 1]!;
  return item.videoMeta?.downloadAddr?.trim() || null;
}
