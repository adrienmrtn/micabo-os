/**
 * Identifiant d'un post TikTok pour l'embed QA (photo / vidéo / query).
 * Distinct de `idPostTiktokStrict` (oubli source) : ici on accepte aussi
 * `item_id` / `share_item_id` après redirection d'un lien court.
 */

export function extraireIdTiktok(url: string | null | undefined): string | null {
  const brut = (url ?? "").trim();
  if (!brut) return null;
  const photoVideo = brut.match(/\/(?:photo|video)\/(\d+)/);
  if (photoVideo) return photoVideo[1];
  const query = brut.match(/[?&](?:item_id|share_item_id)=(\d+)/i);
  return query?.[1] ?? null;
}

/** Lien « Partager » TikTok : vm. / vt. / /t/ — pas d'id dans l'URL. */
export function estLienCourtTiktok(url: string | null | undefined): boolean {
  const u = (url ?? "").trim();
  if (!u) return false;
  if (extraireIdTiktok(u)) return false;
  return /(?:vm|vt)\.tiktok\.com\//i.test(u) || /tiktok\.com\/t\//i.test(u);
}

export function urlEmbedTikTokDepuisId(id: string | null | undefined): string | null {
  if (!id) return null;
  return `https://www.tiktok.com/embed/v2/${id}`;
}
