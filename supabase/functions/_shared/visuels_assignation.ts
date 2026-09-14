/**
 * Résolution des visuels à l'assignation.
 *
 * Une slide sans image propre est garnie depuis la bibliothèque du label :
 * on note les captions contre le critère de la slide (et son texte), on tire
 * le meilleur match, et à défaut un visuel au hasard du label. Les slides
 * déjà pourvues (import, hook) restent figées.
 *
 * Ce module est ce qui reste de la création semi-manuelle (« Create a post »,
 * retirée le 14/09/2026) : seule la résolution d'images servait aussi au
 * moteur d'assignation, le reste est parti avec la page.
 */

import { decouperEnLots } from "./oubli_source_cible.ts";
import { serviceClient } from "./supabase.ts";

/** Au-delà, PostgREST répond 400 Bad Request (URL `.in()` trop longue). */
const LOT_IN = 80;

export type Supabase = ReturnType<typeof serviceClient>;

export const SLUG_HOOK = "hook";

const STOP = new Set([
  "a", "an", "the", "and", "or", "of", "to", "in", "on", "with", "for", "from",
  "de", "du", "des", "la", "le", "les", "un", "une", "et", "ou", "en", "au",
  "aux", "d", "l", "el", "los", "las", "und", "der", "die", "das",
  "this", "that", "your", "you", "est", "pas", "plus", "dans", "qui", "que",
  "pour", "par", "sur", "how", "why", "what", "when", "not", "are",
]);

const ALIAS: Record<string, string[]> = {
  cafe: ["coffee", "espresso", "latte", "cappuccino"],
  coffee: ["cafe", "espresso"],
  livre: ["book", "books"],
  book: ["livre", "books"],
  books: ["book", "livre"],
  lecture: ["reading", "book"],
  reading: ["lecture", "book"],
  femme: ["woman", "girl"],
  woman: ["femme", "girl"],
  homme: ["man", "guy"],
  man: ["homme", "guy"],
  voiture: ["car"],
  car: ["voiture"],
  argent: ["money", "cash"],
  money: ["argent", "cash"],
  sport: ["gym", "fitness", "workout"],
  gym: ["sport", "fitness", "workout"],
  cuisine: ["kitchen"],
  kitchen: ["cuisine"],
  plage: ["beach"],
  beach: ["plage"],
  ville: ["city"],
  city: ["ville"],
  rue: ["street"],
  street: ["rue"],
  bureau: ["office", "desk"],
  office: ["bureau"],
  matin: ["morning"],
  morning: ["matin"],
  nuit: ["night"],
  night: ["nuit"],
};

export function normaliserRecherche(brut: string): string {
  return brut
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function tokeniserCritere(brut: string): string[] {
  return normaliserRecherche(brut)
    .split(/[^a-z0-9]+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 2 && !STOP.has(w));
}

export function requeteVisuel(
  critere?: string | null,
  texte?: string | null,
): string {
  return [critere, texte]
    .map((s) => String(s ?? "").trim())
    .filter(Boolean)
    .join(" ");
}

export function scoreCaptionCritere(caption: string, requete: string): number {
  const tokens = tokeniserCritere(requete).filter((t) => t.length >= 3);
  const hay = normaliserRecherche(caption);
  if (tokens.length === 0 || !hay) return 0;
  let hit = 0;
  for (const tok of tokens) {
    const variantes = [tok, ...(ALIAS[tok] ?? [])].map(normaliserRecherche);
    if (variantes.some((v) => v.length >= 3 && hay.includes(v))) hit += 1;
  }
  return hit / tokens.length;
}

export function tokensCaptionMatches(caption: string, requete: string): string[] {
  const tokens = tokeniserCritere(requete).filter((t) => t.length >= 3);
  const hay = normaliserRecherche(caption);
  return tokens.filter((tok) =>
    [tok, ...(ALIAS[tok] ?? [])]
      .map(normaliserRecherche)
      .some((v) => v.length >= 3 && hay.includes(v)),
  );
}

export interface MediaCaptionCandidat {
  id: string;
  url?: string;
  caption?: string | null;
  est_hook?: boolean;
}

export interface TirageVisuel<T extends MediaCaptionCandidat> {
  media: T | null;
  score: number;
  fallback: boolean;
  motif: string;
}

export function tirerMediaParCritere<T extends MediaCaptionCandidat>(
  pool: T[],
  critere: string,
  exclus: Set<string>,
  rng: () => number = Math.random,
): TirageVisuel<T> {
  const disponibles = pool.filter((m) => !exclus.has(m.id));
  if (disponibles.length === 0) {
    return { media: null, score: 0, fallback: true, motif: "pool vide" };
  }
  const tokens = tokeniserCritere(critere).filter((t) => t.length >= 3);
  if (tokens.length > 0) {
    let meilleur: T | null = null;
    let meilleurScore = 0;
    for (const m of disponibles) {
      const s = scoreCaptionCritere(m.caption ?? "", critere);
      if (s > meilleurScore) {
        meilleur = m;
        meilleurScore = s;
      }
    }
    if (meilleur && meilleurScore > 0) {
      const hits = tokensCaptionMatches(meilleur.caption ?? "", critere);
      return {
        media: meilleur,
        score: meilleurScore,
        fallback: false,
        motif: `match «${hits.slice(0, 4).join(", ")}» (${Math.round(meilleurScore * 100)} %)`,
      };
    }
  }
  const pick = disponibles[Math.floor(rng() * disponibles.length)]!;
  const avecCaption = disponibles.some((m) => String(m.caption ?? "").trim());
  return {
    media: pick,
    score: 0,
    fallback: true,
    motif: !tokens.length
      ? "critère vide → aléatoire du label"
      : avecCaption
        ? "aucun match caption → aléatoire du label"
        : "aucune caption dans le pool → aléatoire",
  };
}

export async function chargerBiblioLabel(
  supabase: Supabase,
  labelId: string,
  opts: { hookSeulement?: boolean; exclureHook?: boolean } = {},
): Promise<Array<{ id: string; url: string; caption: string | null; est_hook: boolean }>> {
  const { data: liens, error: errL } = await supabase
    .from("media_labels")
    .select("media_id")
    .eq("label_id", labelId)
    .limit(800);
  if (errL) throw errL;
  const ids = [...new Set((liens ?? []).map((l) => l.media_id as string))];
  if (ids.length === 0) return [];

  const out: Array<{ id: string; url: string; caption: string | null; est_hook: boolean }> = [];
  for (const lot of decouperEnLots(ids, LOT_IN)) {
    let q = supabase
      .from("media_library")
      .select("id, url, caption, est_hook")
      .in("id", lot)
      .like("storage_path", "propre/%")
      .eq("texte_restant", false);
    if (opts.hookSeulement) q = q.eq("est_hook", true);
    if (opts.exclureHook) q = q.eq("est_hook", false);
    const { data, error } = await q;
    if (error) throw error;
    for (const m of data ?? []) {
      out.push({
        id: m.id as string,
        url: m.url as string,
        caption: (m.caption as string | null) ?? null,
        est_hook: Boolean(m.est_hook),
      });
    }
  }
  return out.slice(0, 400);
}

export interface SlideStructureVisuels {
  position: number;
  media_id: string | null;
  pinned: boolean;
  critere: string | null;
  raw_url?: string | null;
  reference_url?: string | null;
}

export interface ResolutionVisuelLigne {
  position: number;
  media_id: string | null;
  pinned: boolean;
  critere: string | null;
  fallback: boolean;
  motif: string;
}

/**
 * Résout les media_id d'un slideshow manuel à l'assignation.
 * Slides pinnées (dont le hook) restent figées.
 */
export async function resoudreVisuelsAssignation(
  supabase: Supabase,
  contenuId: string,
  structure: SlideStructureVisuels[],
): Promise<{ parPos: Map<number, string | null>; logs: ResolutionVisuelLigne[] }> {
  const { data: liens } = await supabase
    .from("contenu_labels")
    .select("label_id")
    .eq("contenu_id", contenuId);
  const labelId = (liens ?? [])[0]?.label_id as string | undefined;

  const hooks = labelId
    ? await chargerBiblioLabel(supabase, labelId, { hookSeulement: true })
    : [];
  const pool = labelId
    ? await chargerBiblioLabel(supabase, labelId, { exclureHook: true })
    : [];

  const { data: contenu } = await supabase
    .from("contenus")
    .select("langue_source")
    .eq("id", contenuId)
    .maybeSingle();
  const { data: decks } = await supabase
    .from("contenu_langues")
    .select("langue, slides")
    .eq("contenu_id", contenuId);
  const langue = (contenu?.langue_source as string | undefined) ?? "";
  const deck =
    (decks ?? []).find((d) => d.langue === langue) ?? (decks ?? [])[0] ?? null;
  const texteParPos = new Map<number, string>();
  for (const sl of (deck?.slides ?? []) as Array<{
    position?: number;
    texte_overlay?: string | null;
  }>) {
    const pos = Number(sl.position);
    if (!Number.isFinite(pos)) continue;
    texteParPos.set(pos, String(sl.texte_overlay ?? "").trim());
  }

  const exclus = new Set<string>();
  const parPos = new Map<number, string | null>();
  const logs: ResolutionVisuelLigne[] = [];

  for (const s of structure.slice().sort((a, b) => a.position - b.position)) {
    if (s.media_id) {
      exclus.add(s.media_id);
      parPos.set(s.position, s.media_id);
      logs.push({
        position: s.position,
        media_id: s.media_id,
        pinned: true,
        critere: s.critere ?? null,
        fallback: false,
        motif: s.position === 1 ? "hook / image stockée" : "image stockée (pinned ou import)",
      });
      continue;
    }
    const source = s.position === 1 ? hooks : pool;
    const tirage = tirerMediaParCritere(
      source,
      requeteVisuel(s.critere, texteParPos.get(s.position) ?? ""),
      exclus,
    );
    if (tirage.media) exclus.add(tirage.media.id);
    parPos.set(s.position, tirage.media?.id ?? null);
    logs.push({
      position: s.position,
      media_id: tirage.media?.id ?? null,
      pinned: false,
      critere: s.critere ?? null,
      fallback: tirage.fallback,
      motif: tirage.motif,
    });
    if (tirage.fallback) {
      console.log(
        `[creation-manuelle] contenu=${contenuId} slide=#${s.position} fallback: ${tirage.motif}`,
      );
    }
  }
  return { parPos, logs };
}
