/** Aligné sur src/features/moteur/oubliSource.ts — ciblage de l'« oubli » d'une source. */

export const BUCKET_MEDIAS = "medias";

/** Handle sans `@`, sans espaces, en minuscules. */
export function normaliserHandle(handle: string | null | undefined): string {
  return (handle ?? "").trim().replace(/^@+/, "").toLowerCase();
}

/** Handle porté par une URL TikTok, ou null si l'URL n'en contient pas. */
export function handleDeLUrl(url: string | null | undefined): string | null {
  const m = (url ?? "").match(/tiktok\.com\/@([^/?#]+)/i);
  return m ? normaliserHandle(m[1]) : null;
}

/**
 * L'URL appartient-elle à CE compte ? Comparaison exacte du handle : un `ilike`
 * `%@sophia%` attraperait aussi `@sophia_officiel`, dont les slideshows ne
 * doivent surtout pas être supprimés.
 */
export function urlDuHandle(url: string | null | undefined, handle: string): boolean {
  const attendu = normaliserHandle(handle);
  if (!attendu) return false;
  return handleDeLUrl(url) === attendu;
}

/** Identifiant numérique du post TikTok, ou null. */
export function idPostTiktokStrict(url: string | null | undefined): string | null {
  return (url ?? "").match(/\/(?:photo|video)\/(\d+)/)?.[1] ?? null;
}

/**
 * Dossiers storage d'un slideshow. On balaie les préfixes en plus des chemins
 * connus de `media_library` : un upload réussi dont la ligne n'a jamais été
 * écrite laisserait sinon un fichier orphelin, et son chemin est unique — il
 * ferait échouer le ré-import.
 */
export function prefixesStorageContenu(contenuId: string): string[] {
  return [`propre/${contenuId}`, `brut/${contenuId}`];
}

/** Dossier `brut/` écrit pendant le scrape, avant même la ligne `contenus`. */
export function prefixeStorageScrape(sourceUrl: string | null | undefined): string | null {
  const id = idPostTiktokStrict(sourceUrl);
  return id ? `brut/${id}` : null;
}

/** Dossier storage d'un sujet legacy. */
export function prefixeStorageSujet(sujetId: string): string {
  return `propre/${sujetId}`;
}

export interface OubliCompteurs {
  contenus: number;
  medias: number;
  /** Objets réellement retirés du bucket. */
  fichiers: number;
  posts: number;
  sujets: number;
  importFile: number;
}

export function compteursVides(): OubliCompteurs {
  return { contenus: 0, medias: 0, fichiers: 0, posts: 0, sujets: 0, importFile: 0 };
}

export function cumulerCompteurs(a: OubliCompteurs, b: Partial<OubliCompteurs>): OubliCompteurs {
  return {
    contenus: a.contenus + (b.contenus ?? 0),
    medias: a.medias + (b.medias ?? 0),
    fichiers: a.fichiers + (b.fichiers ?? 0),
    posts: a.posts + (b.posts ?? 0),
    sujets: a.sujets + (b.sujets ?? 0),
    importFile: a.importFile + (b.importFile ?? 0),
  };
}

/** Découpe pour les `in(...)` PostgREST et les `remove(...)` storage (URL/payload bornés). */
export function decouperEnLots<T>(items: T[], taille: number): T[][] {
  const max = Math.max(1, Math.floor(taille));
  const lots: T[][] = [];
  for (let i = 0; i < items.length; i += max) lots.push(items.slice(i, i + max));
  return lots;
}
