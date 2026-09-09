import { quotaPostsParJour } from "@/features/moteur/assignationQuota";
import { jourParisDe } from "@/features/reviews/fileQuotidienne";

/** 5 × 24 h à partir de `comptes.created_at` — ensuite le compte est normal. */
export const ESSAI_DUREE_MS = 5 * 24 * 60 * 60 * 1000;
export const ESSAI_JOURS = 5;
export const DERNIERS_TIKTOKS = 3;

export interface TiktokEssai {
  postId: string;
  publieUrl: string;
  sourceUrl: string | null;
  titre: string | null;
  publieAt: string | null;
}

export interface LignePublicationEssai {
  compteId: string;
  postId: string | null;
  passageId: string | null;
  statut: string | null;
  publieUrl: string | null;
  publieAt: string | null;
  createdAt: string | null;
  vues: number | null;
  likes: number | null;
  commentaires: number | null;
  partages: number | null;
  sourceUrl: string | null;
  titre: string | null;
}

export interface AgregatEssai {
  publies: number;
  dus: number;
  vues: number;
  likes: number;
  commentaires: number;
  partages: number;
  derniers: TiktokEssai[];
}

export interface CompteEssai {
  id: string;
  created_at: string;
  essai_ends_at: string;
  restant_ms: number;
  poster_id: string;
  poster_prenom: string | null;
  poster_nom: string | null;
  poster_email: string | null;
  persona_nom: string | null;
  handle_tiktok: string | null;
  avatar_url: string | null;
  langue: string;
  posts_par_jour: number;
  publies: number;
  dus: number;
  vues: number;
  likes: number;
  commentaires: number;
  partages: number;
  derniers: TiktokEssai[];
}

export function essaiEndsAt(createdAt: string | Date): Date {
  const t = createdAt instanceof Date ? createdAt.getTime() : Date.parse(createdAt);
  return new Date(t + ESSAI_DUREE_MS);
}

export function compteEnEssai(
  createdAt: string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!createdAt) return false;
  const t = Date.parse(createdAt);
  if (Number.isNaN(t)) return false;
  return now.getTime() < t + ESSAI_DUREE_MS;
}

export function essaiRestantMs(
  createdAt: string | null | undefined,
  now: Date = new Date(),
): number {
  if (!createdAt) return 0;
  const t = Date.parse(createdAt);
  if (Number.isNaN(t)) return 0;
  return Math.max(0, t + ESSAI_DUREE_MS - now.getTime());
}

export function formaterCountdownEssai(ms: number): string {
  const reste = Math.max(0, Math.ceil(ms / 1000));
  const j = Math.floor(reste / 86_400);
  const h = Math.floor((reste % 86_400) / 3_600);
  const m = Math.floor((reste % 3_600) / 60);
  if (j >= 1) return `${j} j ${String(h).padStart(2, "0")} h`;
  if (h >= 1) return `${h} h ${String(m).padStart(2, "0")} min`;
  return `${m} min`;
}

/** Jours calendaires Paris depuis la création, capés à 5 (inclusif). */
export function joursQuotaEssai(createdAt: Date, now: Date): number {
  const finEssai = essaiEndsAt(createdAt);
  const fin = now.getTime() < finEssai.getTime() ? now : new Date(finEssai.getTime() - 1);
  const debutJour = jourParisDe(createdAt.toISOString());
  const finJour = jourParisDe(fin.toISOString());
  if (!debutJour || !finJour) return 1;
  const a = Date.parse(`${debutJour}T00:00:00Z`);
  const b = Date.parse(`${finJour}T00:00:00Z`);
  const jours = Math.floor((b - a) / 86_400_000) + 1;
  return Math.min(ESSAI_JOURS, Math.max(1, jours));
}

export function postsDusEssai(postsParJour: number, jours: number): number {
  return quotaPostsParJour(postsParJour) * Math.max(1, jours);
}

export function estLignePubliee(l: LignePublicationEssai): boolean {
  if ((l.statut ?? "") === "publie") return true;
  return Boolean(l.publieUrl?.trim());
}

function tsLigne(l: LignePublicationEssai): number {
  const iso = l.publieAt || l.createdAt;
  if (!iso) return 0;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? 0 : t;
}

function cleDedup(l: LignePublicationEssai): string {
  if (l.postId) return `post:${l.postId}`;
  if (l.passageId) return `passage:${l.passageId}`;
  if (l.publieUrl) return `url:${l.publieUrl}`;
  return `row:${l.createdAt ?? ""}:${l.titre ?? ""}`;
}

function mieux(a: LignePublicationEssai, b: LignePublicationEssai): LignePublicationEssai {
  const urlA = Boolean(a.publieUrl?.trim());
  const urlB = Boolean(b.publieUrl?.trim());
  if (urlA !== urlB) return urlA ? a : b;
  const vuesA = a.vues ?? -1;
  const vuesB = b.vues ?? -1;
  if (vuesA !== vuesB) return vuesA > vuesB ? a : b;
  return tsLigne(a) >= tsLigne(b) ? a : b;
}

export function agregerEssaiCompte(
  createdAt: string,
  postsParJour: number,
  lignes: LignePublicationEssai[],
  now: Date = new Date(),
): AgregatEssai {
  const createdMs = Date.parse(createdAt);
  const nowMs = now.getTime();
  const dus = postsDusEssai(postsParJour, joursQuotaEssai(new Date(createdAt), now));
  const parCle = new Map<string, LignePublicationEssai>();

  for (const l of lignes) {
    if (!estLignePubliee(l)) continue;
    const ts = tsLigne(l);
    if (Number.isFinite(createdMs) && ts > 0 && ts < createdMs) continue;
    if (ts > nowMs) continue;
    const cle = cleDedup(l);
    const deja = parCle.get(cle);
    parCle.set(cle, deja ? mieux(deja, l) : l);
  }

  const uniques = [...parCle.values()].sort((a, b) => tsLigne(b) - tsLigne(a));
  const derniers: TiktokEssai[] = [];
  for (const l of uniques) {
    const url = l.publieUrl?.trim();
    if (!url) continue;
    derniers.push({
      postId: l.postId || l.passageId || url,
      publieUrl: url,
      sourceUrl: l.sourceUrl?.trim() || null,
      titre: l.titre,
      publieAt: l.publieAt,
    });
    if (derniers.length >= DERNIERS_TIKTOKS) break;
  }

  let vues = 0;
  let likes = 0;
  let commentaires = 0;
  let partages = 0;
  for (const l of uniques) {
    vues += Number(l.vues ?? 0);
    likes += Number(l.likes ?? 0);
    commentaires += Number(l.commentaires ?? 0);
    partages += Number(l.partages ?? 0);
  }

  return {
    publies: uniques.length,
    dus,
    vues,
    likes,
    commentaires,
    partages,
    derniers,
  };
}
