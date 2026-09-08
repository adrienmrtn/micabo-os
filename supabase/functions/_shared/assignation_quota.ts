/** Quota d'assignation slideshow : 1–3 posts / compte / jour Paris. */

export function quotaPostsParJour(brut: unknown): number {
  const n = Number(brut);
  if (!Number.isFinite(n)) return 1;
  return Math.min(3, Math.max(1, Math.round(n)));
}

export function manquantsJusquaQuota(
  quota: number,
  dejaLa: number,
  forcer = false,
): number {
  if (forcer) return 1;
  return Math.max(0, quota - dejaLa);
}

/** Posts en trop : on garde les publiés puis les plus anciens, jamais un `publie`. */
export function idsPostsHorsQuota<
  T extends { id: string; statut: string; created_at: string },
>(posts: T[], quota: number): string[] {
  const q = quotaPostsParJour(quota);
  const tries = [...posts].sort((a, b) => {
    const pa = a.statut === "publie" ? 0 : 1;
    const pb = b.statut === "publie" ? 0 : 1;
    if (pa !== pb) return pa - pb;
    return a.created_at.localeCompare(b.created_at);
  });
  return tries.filter((p, i) => i >= q && p.statut !== "publie").map((p) => p.id);
}

export function estErreurQuotaPostsJour(err: unknown): boolean {
  const morceaux: string[] = [];
  if (err && typeof err === "object") {
    const o = err as { message?: unknown; details?: unknown; hint?: unknown };
    if (o.message != null) morceaux.push(String(o.message));
    if (o.details != null) morceaux.push(String(o.details));
    if (o.hint != null) morceaux.push(String(o.hint));
  } else if (err != null) {
    morceaux.push(String(err));
  }
  return /quota_posts_jour/i.test(morceaux.join(" "));
}
