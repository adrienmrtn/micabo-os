/** Copie Deno de src/features/moteur/papierAssignation.ts — garder synchro. */
/** Helpers purs — assignation de la vidéo papier aux comptes CM. */

export type CompteCmCible = {
  id: string;
  langue: string;
  type_compte?: string | null;
  is_active?: boolean | null;
};

export type LanguePapierPrete = {
  id: string;
  langue: string;
  statut?: string | null;
  video_url?: string | null;
};

export type PaireAssignationPapier = {
  compteId: string;
  langueId: string;
  langue: string;
};

export function estLanguePapierPrete(row: LanguePapierPrete): boolean {
  return row.statut === "ready" && Boolean(row.video_url);
}

/** Légende TikTok : hook puis CTA, prêts à coller. */
export function captionDepuisLangue(row: {
  hook?: string | null;
  cta?: string | null;
}): string {
  return [row.hook, row.cta]
    .map((s) => String(s ?? "").trim())
    .filter(Boolean)
    .join("\n\n");
}

export function hashtagsDepuisLangue(raw: string | string[] | null | undefined): string {
  if (Array.isArray(raw)) {
    return raw
      .map((h) => String(h).trim())
      .filter(Boolean)
      .map((h) => (h.startsWith("#") ? h : `#${h}`))
      .join(" ");
  }
  return String(raw ?? "").trim();
}

/**
 * Un CM actif reçoit la langue prête qui correspond.
 * Perso / inactifs / sans vidéo ready : ignorés.
 */
export function pairesAssignationPapier(
  comptes: CompteCmCible[],
  langues: LanguePapierPrete[],
): PaireAssignationPapier[] {
  const parLangue = new Map<string, LanguePapierPrete>();
  for (const langue of langues) {
    if (!estLanguePapierPrete(langue)) continue;
    parLangue.set(langue.langue, langue);
  }

  const out: PaireAssignationPapier[] = [];
  for (const compte of comptes) {
    if (compte.type_compte != null && compte.type_compte !== "cm") continue;
    if (compte.is_active === false) continue;
    const langue = parLangue.get(compte.langue);
    if (!langue) continue;
    out.push({ compteId: compte.id, langueId: langue.id, langue: compte.langue });
  }
  return out;
}

export function datesFenetreParis(aujourdhui: string, fenetreJours: number): string[] {
  const n = Math.max(1, Math.round(fenetreJours));
  const out: string[] = [];
  const [y, m, d] = aujourdhui.split("-").map(Number);
  const base = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1));
  for (let i = 0; i < n; i++) {
    const cur = new Date(base);
    cur.setUTCDate(base.getUTCDate() - i);
    out.push(cur.toISOString().slice(0, 10));
  }
  return out;
}
