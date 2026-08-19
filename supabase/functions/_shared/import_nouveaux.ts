/** Aligné sur src/features/moteur/importNouveaux.ts — filtre « nouveaux depuis le dernier import ». */

export function idPostTiktok(url: string): string {
  return url.match(/\/(?:photo|video)\/(\d+)/)?.[1] ?? url;
}

export function normaliserCreateTime(raw: number | null | undefined): number | null {
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0) return null;
  return raw > 1e12 ? Math.floor(raw / 1000) : Math.floor(raw);
}

export function maxIdTiktok(ids: Iterable<string>): bigint | null {
  let max: bigint | null = null;
  for (const id of ids) {
    if (!/^\d+$/.test(id)) continue;
    const n = BigInt(id);
    if (max === null || n > max) max = n;
  }
  return max;
}

export const MARGE_UPDATE_SEC = 2 * 3600;

/**
 * Ce que « Mettre à jour » doit enfiler : tout slideshow exposé par le profil
 * et absent du stock. Le filtre par date ne sert plus qu'à l'affichage — il
 * décidait auparavant de l'enfilage, figeant à vie un premier import tronqué.
 */
export function urlsManquantes(urlsProfil: string[], connusIds: Set<string>): string[] {
  return urlsProfil.filter((url) => !connusIds.has(idPostTiktok(url)));
}

export function estNouveauDepuisImport(opts: {
  url: string;
  createTime?: number | null;
  connusIds: Set<string>;
  dernierImportAt: Date | null;
  maxIdConnu: bigint | null;
}): boolean {
  const id = idPostTiktok(opts.url);
  if (opts.connusIds.has(id)) return false;
  if (!opts.dernierImportAt) return true;
  if (opts.connusIds.size === 0) return true;

  const createTime = normaliserCreateTime(opts.createTime ?? null);
  if (createTime !== null) {
    const seuil = Math.floor(opts.dernierImportAt.getTime() / 1000) - MARGE_UPDATE_SEC;
    return createTime >= seuil;
  }

  if (opts.maxIdConnu !== null && /^\d+$/.test(id)) {
    return BigInt(id) > opts.maxIdConnu;
  }

  return false;
}
