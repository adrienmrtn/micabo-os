import { lienTikTok } from "@/features/hiring/suiviEquipe";

import type { LigneSurveillance, UpworkApproche } from "./types";

/** Rythme : en dessous de 80 % des posts prévus sur 10 jours. */
export const SEUIL_RATIO_POSTS = 0.8;
/** Vues : moyenne des 10 derniers posts sous 500. */
export const SEUIL_VUES_MOY = 500;

export type { LigneSurveillance };

export type CreateurPhase3 = {
  cle: string;
  nom: string;
  handle: string | null;
  tiktokUrl: string | null;
  photoUrl: string | null;
  posterId: string | null;
  posts_10j: number;
  prevus_10j: number;
  vues_10: number;
  posts_mesures: number;
  elo: number | null;
};

export type MoyenneHm = {
  posts_10j: number;
  prevus_10j: number;
  vues_10: number;
  posts_mesures: number;
};

export function ratioPosts(ligne: { posts_10j: number; prevus_10j: number }): number | null {
  if (ligne.prevus_10j <= 0) return null;
  return ligne.posts_10j / ligne.prevus_10j;
}

export function vuesMoyennes(ligne: { vues_10: number; posts_mesures: number }): number {
  if (ligne.posts_mesures <= 0) return 0;
  return ligne.vues_10 / ligne.posts_mesures;
}

export function alerteSurveillance(ligne: {
  posts_10j: number;
  prevus_10j: number;
  vues_10: number;
  posts_mesures: number;
}): boolean {
  const ratio = ratioPosts(ligne);
  return (ratio !== null && ratio < SEUIL_RATIO_POSTS) || vuesMoyennes(ligne) < SEUIL_VUES_MOY;
}

export function moyenneEquipe(lignes: CreateurPhase3[]): MoyenneHm | null {
  if (lignes.length === 0) return null;
  return lignes.reduce<MoyenneHm>(
    (acc, l) => ({
      posts_10j: acc.posts_10j + l.posts_10j,
      prevus_10j: acc.prevus_10j + l.prevus_10j,
      vues_10: acc.vues_10 + l.vues_10,
      posts_mesures: acc.posts_mesures + l.posts_mesures,
    }),
    { posts_10j: 0, prevus_10j: 0, vues_10: 0, posts_mesures: 0 },
  );
}

function depuisLigne(l: LigneSurveillance, approche?: UpworkApproche): CreateurPhase3 {
  const handle = l.handle ?? approche?.tiktok_handle ?? null;
  const lien = lienTikTok(handle);
  return {
    cle: l.compte_id,
    nom: (approche?.nom || l.nom || handle || "—").trim(),
    handle: lien?.at ?? null,
    tiktokUrl: lien?.url ?? null,
    photoUrl: approche?.photo_url ?? null,
    posterId: l.poster_id,
    posts_10j: l.posts_10j,
    prevus_10j: l.prevus_10j,
    vues_10: l.vues_10,
    posts_mesures: l.posts_mesures,
    elo: l.elo,
  };
}

function depuisApproche(a: UpworkApproche): CreateurPhase3 {
  const lien = lienTikTok(a.tiktok_handle);
  return {
    cle: a.id,
    nom: a.nom,
    handle: lien?.at ?? null,
    tiktokUrl: lien?.url ?? null,
    photoUrl: a.photo_url,
    posterId: a.profile_id,
    posts_10j: 0,
    prevus_10j: 0,
    vues_10: 0,
    posts_mesures: 0,
    elo: null,
  };
}

/** Créateurs passés en phase 3 : premier post publié, stats OS si on les a. */
export function createursPhase3(
  approches: UpworkApproche[],
  lignes: LigneSurveillance[],
  hmProfileId: string | null,
): CreateurPhase3[] {
  const parPoster = new Map<string, LigneSurveillance>();
  for (const l of lignes) {
    if (l.poster_id) parPoster.set(l.poster_id, l);
  }

  const out: CreateurPhase3[] = [];
  const vus = new Set<string>();

  for (const a of approches.filter((x) => x.premier_post_ok)) {
    const ligne = a.profile_id ? parPoster.get(a.profile_id) : undefined;
    if (ligne) {
      vus.add(ligne.compte_id);
      out.push(depuisLigne(ligne, a));
    } else {
      vus.add(a.id);
      out.push(depuisApproche(a));
    }
  }

  if (hmProfileId) {
    for (const l of lignes.filter((x) => x.manager_id === hmProfileId)) {
      if (vus.has(l.compte_id)) continue;
      vus.add(l.compte_id);
      const approche = approches.find((a) => a.profile_id && a.profile_id === l.poster_id);
      out.push(depuisLigne(l, approche));
    }
  }

  return out.sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
}

export function encoreEnRecrutement(
  a: UpworkApproche,
  phase3: CreateurPhase3[],
): boolean {
  if (a.premier_post_ok) return false;
  if (a.profile_id && phase3.some((c) => c.posterId === a.profile_id)) return false;
  return true;
}
