/** Slug unique de cet OS. */
export const SLUG_MICABO = "micabo";
/** Ancien slug d'un autre produit — ne plus l'utiliser comme défaut. */
export const SLUG_SOPHIA = "sophia";

export interface ApplicationOs {
  id: string;
  slug: string;
  nom: string;
  created_at: string;
}

export function normaliserSlugApplication(valeur: unknown): string {
  return String(valeur ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

export function estSlugApplicationValide(slug: string): boolean {
  return /^[a-z][a-z0-9_-]{1,31}$/.test(slug);
}

export function estSlugSophia(slug: string | null | undefined): boolean {
  return slug === SLUG_SOPHIA;
}

export function estSlugMicabo(slug: string | null | undefined): boolean {
  return (slug ?? SLUG_MICABO) === SLUG_MICABO;
}

/**
 * Application d'un import : la source l'emporte, puis l'id explicite,
 * puis le fallback (micabo sur cet OS).
 */
export function resoudreApplicationImport(opts: {
  sourceApplicationId?: string | null;
  explicitApplicationId?: string | null;
  fallbackId: string;
}): string {
  const source = String(opts.sourceApplicationId ?? "").trim();
  if (source) return source;
  const explicit = String(opts.explicitApplicationId ?? "").trim();
  if (explicit) return explicit;
  return opts.fallbackId;
}

export function nomApplication(app: { nom?: string | null; slug?: string | null }): string {
  const nom = String(app.nom ?? "").trim();
  if (nom) return nom;
  const slug = String(app.slug ?? "").trim();
  if (slug === SLUG_MICABO) return "micabo";
  return slug || "micabo";
}

/** Clé du prompt de pertinence. */
export function clePromptPertinence(slug: string | null | undefined): string {
  const cle = normaliserSlugApplication(slug) || SLUG_MICABO;
  return cle === SLUG_MICABO ? "pertinence_micabo" : `pertinence_${cle}`;
}

/** Clé du prompt de placement. */
export function clePromptPlacement(slug: string | null | undefined): string {
  const cle = normaliserSlugApplication(slug) || SLUG_MICABO;
  return `placement_${cle}`;
}

export type FiltreApplicationPoster = "tous" | string;

/** Un poster passe le filtre si au moins un de ses comptes matche l'app. */
export function posterMatcheApplication(
  comptes: Array<{ application_id?: string | null; application_slug?: string | null }>,
  filtre: FiltreApplicationPoster,
  applications: ApplicationOs[],
): boolean {
  if (!filtre || filtre === "tous") return true;
  const cible = applications.find((a) => a.slug === filtre || a.id === filtre);
  if (!cible) return false;
  return comptes.some(
    (c) => c.application_id === cible.id || c.application_slug === cible.slug,
  );
}

export function fileLabelsDeLApplication<T extends { items: unknown[]; par_langue: Record<string, unknown[]> }>(
  file: T & { par_application?: Record<string, { items: T["items"]; par_langue: T["par_langue"] }> },
  slug: string,
): { items: T["items"]; par_langue: T["par_langue"] } {
  const slice = file.par_application?.[slug];
  if (slice) return { items: slice.items ?? [], par_langue: slice.par_langue ?? {} };
  if (estSlugMicabo(slug)) return { items: file.items ?? [], par_langue: file.par_langue ?? {} };
  return { items: [] as T["items"], par_langue: {} as T["par_langue"] };
}

/** Réécrit la file d'une application sans toucher aux autres. */
export function avecFileLabelsApplication<T extends { items: unknown[]; par_langue: Record<string, unknown[]> }>(
  file: T & { par_application?: Record<string, { items: T["items"]; par_langue: T["par_langue"] }> },
  slug: string,
  slice: { items: T["items"]; par_langue: T["par_langue"] },
): T & { par_application: Record<string, { items: T["items"]; par_langue: T["par_langue"] }> } {
  const par_application = { ...(file.par_application ?? {}) };
  par_application[slug] = slice;
  if (estSlugMicabo(slug)) {
    return { ...file, items: slice.items, par_langue: slice.par_langue, par_application };
  }
  return { ...file, par_application };
}
