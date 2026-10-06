/**
 * Labels SUR DEMANDE : assignables à la main, jamais tirés par le repli
 * (06/10/2026).
 *
 * `white-post` ne sert que des slideshows à texte incrusté (0306), une
 * poignée, et seulement dans les langues qui ont leurs images. Le repli de
 * `manage-users` (`labelMoinsUtiliseParLangue`) prend le label le MOINS utilisé
 * dans la langue : un label sur demande, porté par un ou deux comptes, y
 * gagnait à chaque création de compte — un compte né `white-post` seul
 * s'assèche en deux jours, et en espagnol ou en anglais il ne reçoit rien du
 * tout. Même piège que 0277 : le repli était attiré par ce qu'il devait éviter.
 *
 * Module à part, et non dans `labels_systeme.ts` : ce dernier est tiré par le
 * moteur d'assignation, et y ajouter une fonction, même élaguée, fait
 * « changer » ses bundles (leçon d'`apify_usage.ts`, 0281). Seul
 * `manage-users` lit ce module.
 */
import { idsLabelsAssignables } from "./labels_systeme.ts";

export const SLUGS_LABELS_SUR_DEMANDE = ["white-post"] as const;

export function estLabelSurDemande(lab: { slug?: string | null } | null | undefined): boolean {
  return (SLUGS_LABELS_SUR_DEMANDE as readonly string[]).includes(lab?.slug ?? "");
}

/**
 * IDs que le repli peut donner à un compte qui naît : assignables, et pas sur
 * demande. Mêmes colonnes à sélectionner que `idsLabelsAssignables`, `slug`
 * compris. Une liste vide rend `NO_LABELS`, visible, comme en 0277.
 */
export function idsLabelsRepli(
  labels: Array<{ id?: string | null; slug?: string | null; retire_le?: string | null }>,
): string[] {
  const surDemande = new Set(labels.filter((l) => estLabelSurDemande(l)).map((l) => l.id));
  return idsLabelsAssignables(labels).filter((id) => !surDemande.has(id));
}
