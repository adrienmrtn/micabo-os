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

/**
 * Doublon du jour rattrapé par l'index unique
 * `passages_compte_contenu_jour_uidx` (0264).
 *
 * `choisirContenu` exclut déjà les slideshows sortis le jour même, mais ses
 * deux garde-fous — lecture en base, liste en mémoire — sont locaux à un
 * appel : deux workers concurrents sur le même compte lisent avant que
 * l'autre n'ait committé. La base tranche, le moteur repioche.
 */
export function estDoublonContenuJour(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const o = err as { code?: unknown; message?: unknown; details?: unknown };
  if (String(o.code ?? "") !== "23505") return false;
  const txt = `${String(o.message ?? "")} ${String(o.details ?? "")}`;
  return /passages_compte_contenu_jour_uidx/i.test(txt);
}

/**
 * Panne d'appel RPC, par opposition à un échec métier.
 *
 * PostgREST préfixe ses propres codes par `PGRST` : fonction absente du cache
 * de schéma (PGRST202), surcharge ambiguë (PGRST203)… Ces erreurs ne dépendent
 * pas du slideshow tiré, donc réessayer avec un autre est inutile — et coûteux,
 * chaque tentative repayant une traduction complète.
 */
export function estPanneRpc(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const code = String((err as { code?: unknown }).code ?? "");
  return /^PGRST/i.test(code);
}
