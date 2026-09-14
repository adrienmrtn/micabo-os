/**
 * Marques système : pas des niches d’assignation (créateurs / contenus / sources).
 *
 * `ugc-ai-video` est parti avec la page AI Videos (14/09/2026) ; la garde SQL
 * de `0241_hook_pas_assignable.sql` le cite encore, elle ne matchera plus.
 */
export const SLUG_HOOK = "hook";

export const SLUGS_LABELS_SYSTEME = [SLUG_HOOK] as const;

export function estLabelSysteme(lab: { slug?: string | null } | null | undefined): boolean {
  return (lab?.slug ?? "") === SLUG_HOOK;
}

/** IDs utilisables pour un créateur / une intersection minuit. */
export function idsLabelsAssignables(
  labels: Array<{ id?: string | null; slug?: string | null }>,
): string[] {
  return labels
    .filter((l) => Boolean(l.id) && !estLabelSysteme(l))
    .map((l) => l.id as string);
}

export function extraireLabelsAssignables<
  T extends { label_id?: string | null; labels?: { nom?: string | null; slug?: string | null } | null },
>(rows: T[]): { labelIds: string[]; labelNoms: string[] } {
  const ok = rows.filter((r) => Boolean(r.label_id) && !estLabelSysteme(r.labels));
  return {
    labelIds: ok.map((r) => r.label_id as string),
    labelNoms: ok
      .map((r) => r.labels?.nom as string | undefined)
      .filter((n): n is string => Boolean(n)),
  };
}
