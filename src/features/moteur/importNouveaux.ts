/** Identifiant numérique TikTok, quelle que soit la forme de l'URL. */
export function idPostTiktok(url: string): string {
  return url.match(/\/(?:photo|video)\/(\d+)/)?.[1] ?? url;
}

/** Apify renvoie parfois des ms ; on normalise en secondes Unix. */
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

/** Marge (2 h) : un post publié pendant le scrape précédent ne doit pas être loupé. */
export const MARGE_UPDATE_SEC = 2 * 3600;

/** Une URL scrapable est celle d'un post précis, pas celle d'un profil. */
export function estUrlDePost(url: string): boolean {
  return /\/(?:photo|video)\/\d+/.test(url);
}

/**
 * Panne de capacité côté fournisseur, pas défaut du post : budget Apify saturé,
 * quota, ou erreur serveur. Ça se retente — ça ne se compte pas comme un échec.
 */
export function estErreurCapacite(message: string): boolean {
  return (
    /memory-limit-exceeded|rate.?limit|too many requests|quota/i.test(message) ||
    /Apify (?:402|429|5\d\d)\b/.test(message)
  );
}

export type CandidatImportNouveau = {
  url: string;
  createTime?: number | null;
};

/**
 * Un TikTok est « nouveau depuis le dernier import » s'il n'est pas déjà en
 * stock, et s'il a été publié après ce scrape (date Apify, sinon id snowflake
 * plus récent que le plus récent déjà importé de cette source).
 * Les anciens — déjà importés ou clairement antérieurs — sont écartés.
 */
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

/**
 * Ce que « Mettre à jour » doit enfiler : tout slideshow exposé par le profil
 * et absent du stock.
 *
 * Le filtre par date ne sert plus qu'à l'affichage. Il décidait auparavant de
 * l'enfilage, si bien qu'un premier import tronqué (plafond de listing, handle
 * invalide) était définitivement figé : les manquants étant antérieurs au
 * dernier scrape, l'update répondait « aucun nouveau TikTok » pendant que des
 * dizaines de slideshows restaient introuvables.
 */
export function urlsManquantes(urlsProfil: string[], connusIds: Set<string>): string[] {
  return urlsProfil.filter((url) => !connusIds.has(idPostTiktok(url)));
}

export function filtrerNouveauxDepuisImport(
  candidats: CandidatImportNouveau[],
  connusIds: Set<string>,
  dernierImportAt: Date | null,
  maxIdConnu: bigint | null = maxIdTiktok(connusIds),
): CandidatImportNouveau[] {
  return candidats.filter((c) =>
    estNouveauDepuisImport({
      url: c.url,
      createTime: c.createTime,
      connusIds,
      dernierImportAt,
      maxIdConnu,
    }),
  );
}
