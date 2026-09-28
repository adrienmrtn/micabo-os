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

/**
 * Un label RETIRÉ n'est pas assignable (0277, 28/09/2026).
 *
 * Sans ça, `labelMoinsUtiliseParLangue` choisissait le label retiré
 * **précisément parce qu'il est retiré** : le repli prend le label le MOINS
 * utilisé, et un label retiré a zéro compte. L'insert partait ensuite dans le
 * trigger de 0273, qui le jette en silence — et le compte naissait sans label,
 * donc sans aucun post, sans une erreur nulle part. Vu le 28/09 sur
 * `leon.lernen977` : `cold_study` 0 compte contre `classic_study` 27.
 *
 * Le mécanisme de retrait attirait donc le repli vers le label retiré. C'est
 * l'inverse de ce qu'il devait faire.
 */
export function estLabelRetire(lab: { retire_le?: string | null } | null | undefined): boolean {
  return Boolean(lab?.retire_le);
}

/**
 * IDs utilisables pour un créateur / une intersection minuit.
 *
 * Les appelants doivent sélectionner `retire_le` en plus de `id, slug` : une
 * ligne sans la colonne passe pour non retirée, ce qui est le comportement
 * d'avant 0277 et rouvrirait le piège en silence.
 */
export function idsLabelsAssignables(
  labels: Array<{ id?: string | null; slug?: string | null; retire_le?: string | null }>,
): string[] {
  return labels
    .filter((l) => Boolean(l.id) && !estLabelSysteme(l) && !estLabelRetire(l))
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
