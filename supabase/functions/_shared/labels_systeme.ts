/** Marques système : pas des niches d’assignation (créateurs / contenus / sources). */
export const SLUG_HOOK = "hook";
export const SLUG_UGC_AI_VIDEO = "ugc-ai-video";

export const SLUGS_LABELS_SYSTEME = [SLUG_HOOK, SLUG_UGC_AI_VIDEO] as const;

export function estLabelSysteme(lab: { slug?: string | null } | null | undefined): boolean {
  const slug = lab?.slug ?? "";
  return slug === SLUG_HOOK || slug === SLUG_UGC_AI_VIDEO;
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
