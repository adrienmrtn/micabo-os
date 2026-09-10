import {
  estLienCourtTiktok,
  extraireIdTiktok,
  urlEmbedTikTokDepuisId,
} from "../../../supabase/functions/_shared/tiktok_lien.ts";

export { estLienCourtTiktok, extraireIdTiktok, urlEmbedTikTokDepuisId };

export const CLE_REMARQUES = "review_quotidienne_remarques";

export interface RemarqueGenerique {
  /**
   * Identifiant stable, indépendant du titre : c'est lui qui tient le lien vers
   * la vidéo. Sans ça, renommer une puce détacherait son enregistrement.
   */
  id: string;
  titre: string;
  corps: string;
  /** Vidéo d'explication (URL publique). Null = puce sans vidéo. */
  videoUrl?: string | null;
  /** Chemin storage, gardé pour pouvoir remplacer ou supprimer le fichier. */
  videoPath?: string | null;
}

/**
 * Identifiant dérivé du titre, pour les puces d'avant les vidéos : elles n'ont
 * pas d'`id` en base, et il faut leur en donner un qui ne bouge pas d'une
 * lecture à l'autre. Dès qu'on enregistre, l'id est écrit noir sur blanc et
 * cesse de dépendre du titre.
 */
export function idDepuisTitre(titre: string): string {
  return titre
    .normalize("NFD")
    // Échappements explicites : des caractères combinants écrits en clair sont
    // invisibles à la relecture et ne survivent pas à tous les outils.
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export const REMARQUES_DEFAUT: RemarqueGenerique[] = [
  { id: "hook-trop-petit", titre: "Hook trop petit", corps: "Hook trop petit, on le lit trop tard" },
  { id: "texte-mal-cale", titre: "Texte mal calé", corps: "Texte mal calé sur l'image" },
  { id: "rythme-trop-lent", titre: "Rythme trop lent", corps: "Rythme trop lent vs l'original" },
  {
    id: "slides-differentes",
    titre: "Slides différentes",
    corps: "Les slides ne suivent pas l'original",
  },
  { id: "musique", titre: "Musique", corps: "Musique trop basse ou coupée" },
  { id: "bien-cale", titre: "Bien calé", corps: "Bien calé — continue comme ça" },
];

export const TITRE_MAX = 48;
export const CORPS_MAX = 800;
export const REMARQUE_MAX = CORPS_MAX;
export const REMARQUES_MAX = 24;

export function jourParisDe(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(d);
}

/** Réglage jamais posé → défauts. Tableau vide admin = aucune puce. */
export function remarquesDepuisReglage(brut: unknown | null | undefined): RemarqueGenerique[] {
  if (brut === undefined || brut === null) return REMARQUES_DEFAUT.map((r) => ({ ...r }));
  return normaliserRemarques(brut);
}

export function normaliserRemarques(brut: unknown): RemarqueGenerique[] {
  if (!Array.isArray(brut)) return [];
  const out: RemarqueGenerique[] = [];
  const vus = new Set<string>();
  for (const [i, x] of brut.entries()) {
    const r = remarqueDepuisBrut(x, i);
    if (!r) continue;
    if (vus.has(r.id)) continue;
    vus.add(r.id);
    out.push(r);
    if (out.length >= REMARQUES_MAX) break;
  }
  return out;
}

function compact(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function texteOuNull(v: unknown): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  return s || null;
}

function remarqueDepuisBrut(x: unknown, index: number): RemarqueGenerique | null {
  const avecId = (r: Omit<RemarqueGenerique, "id"> & { id?: string }): RemarqueGenerique => ({
    ...r,
    id: r.id || idDepuisTitre(r.titre) || idDepuisTitre(r.corps) || `remarque-${index + 1}`,
  });

  if (typeof x === "string") {
    const t = compact(x).slice(0, CORPS_MAX);
    if (!t) return null;
    const coupe = t.search(/[,—]/);
    const titre = compact(coupe > 0 ? t.slice(0, coupe) : t).slice(0, TITRE_MAX);
    return avecId({ titre: titre || t.slice(0, TITRE_MAX), corps: t });
  }
  if (!x || typeof x !== "object") return null;
  const o = x as {
    id?: unknown;
    titre?: unknown;
    corps?: unknown;
    title?: unknown;
    body?: unknown;
    videoUrl?: unknown;
    video_url?: unknown;
    videoPath?: unknown;
    video_path?: unknown;
  };
  const corps = compact(String(o.corps ?? o.body ?? "")).slice(0, CORPS_MAX);
  const titre = compact(String(o.titre ?? o.title ?? "")).slice(0, TITRE_MAX);
  if (!titre && !corps) return null;
  return avecId({
    id: texteOuNull(o.id) ?? undefined,
    titre: titre || corps.slice(0, TITRE_MAX),
    corps: corps || titre,
    videoUrl: texteOuNull(o.videoUrl ?? o.video_url),
    videoPath: texteOuNull(o.videoPath ?? o.video_path),
  });
}

export function collerRemarque(actuel: string, remarque: string): string {
  const ajout = remarque.trim();
  if (!ajout) return actuel;
  const t = actuel.replace(/\s+$/, "");
  if (!t) return ajout;
  if (t.split(/\n/).some((l) => l.trim().toLowerCase() === ajout.toLowerCase())) return actuel;
  return `${t}\n${ajout}`;
}

/** Copie figée d'une puce au moment de l'envoi (colonne `reviews.remarques`). */
export interface RemarqueEnvoyee {
  id: string;
  titre: string;
  corps: string;
  video_url: string | null;
}

/** Ne part avec la review que ce qui sert à la rejouer : titre, corps, vidéo. */
export function snapshotRemarques(remarques: RemarqueGenerique[]): RemarqueEnvoyee[] {
  return remarques.map((r) => ({
    id: r.id,
    titre: r.titre,
    corps: r.corps,
    video_url: r.videoUrl ?? null,
  }));
}

export function normaliserRemarquesEnvoyees(brut: unknown): RemarqueEnvoyee[] {
  if (!Array.isArray(brut)) return [];
  const out: RemarqueEnvoyee[] = [];
  for (const [i, x] of brut.entries()) {
    const r = remarqueDepuisBrut(x, i);
    if (!r) continue;
    out.push({ id: r.id, titre: r.titre, corps: r.corps, video_url: r.videoUrl ?? null });
  }
  return out;
}

/**
 * Ce que le créateur voit, dans l'ordre.
 *
 * Une puce sans vidéo n'a pas d'étape : son texte a déjà été collé dans le
 * corps du retour, l'afficher deux fois ne dirait rien de plus. Le texte
 * complet ferme la marche — c'est lui qui porte le « Compris ».
 */
export type EtapeReview =
  | { type: "video"; id: string; titre: string; corps: string; videoUrl: string }
  | { type: "texte"; body: string };

export function etapesReview(review: {
  body: string;
  remarques?: unknown;
}): EtapeReview[] {
  const etapes: EtapeReview[] = [];
  for (const r of normaliserRemarquesEnvoyees(review.remarques)) {
    if (!r.video_url) continue;
    etapes.push({
      type: "video",
      id: r.id,
      titre: r.titre,
      corps: r.corps,
      videoUrl: r.video_url,
    });
  }
  etapes.push({ type: "texte", body: review.body });
  return etapes;
}

export function urlEmbedTikTok(url: string | null | undefined): string | null {
  return urlEmbedTikTokDepuisId(extraireIdTiktok(url));
}

export function estHorsFile(opts: {
  postId: string;
  publieAt: string | null;
  jour: string;
  deja: ReadonlySet<string>;
}): boolean {
  if (opts.deja.has(opts.postId)) return true;
  return jourParisDe(opts.publieAt) !== opts.jour;
}
