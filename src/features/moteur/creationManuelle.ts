/** ELO par défaut à la validation d'un slideshow semi-manuel (toutes langues). */
export const ELO_MANUEL_DEFAUT = 65;

export const SLIDES_MANUEL_MIN = 2;
export const SLIDES_MANUEL_MAX = 12;

const STOP = new Set([
  "a", "an", "the", "and", "or", "of", "to", "in", "on", "with", "for", "from",
  "de", "du", "des", "la", "le", "les", "un", "une", "et", "ou", "en", "au",
  "aux", "d", "l", "el", "los", "las", "und", "der", "die", "das",
]);

export function tokeniserCritere(brut: string): string[] {
  const t = brut
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  return t
    .split(/[^a-z0-9]+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 2 && !STOP.has(w));
}

/** 0..1 : part des tokens du critère présents dans la caption. */
export function scoreCaptionCritere(caption: string, critere: string): number {
  const q = tokeniserCritere(critere);
  if (q.length === 0) return 0;
  const bag = new Set(tokeniserCritere(caption));
  let hit = 0;
  for (const tok of q) if (bag.has(tok)) hit += 1;
  return hit / q.length;
}

export interface MediaCaptionCandidat {
  id: string;
  caption?: string | null;
  est_hook?: boolean;
}

export interface TirageVisuel<T extends MediaCaptionCandidat> {
  media: T | null;
  score: number;
  fallback: boolean;
  motif: string;
}

/**
 * Résout une image pour un critère dans la biblio du label.
 * Match sur les captions ; sinon image aléatoire du pool (fallback + log).
 */
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

  const tokens = tokeniserCritere(critere);
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
      return {
        media: meilleur,
        score: meilleurScore,
        fallback: false,
        motif: `match caption (${Math.round(meilleurScore * 100)} %)`,
      };
    }
  }

  const pick = disponibles[Math.floor(rng() * disponibles.length)]!;
  return {
    media: pick,
    score: 0,
    fallback: true,
    motif: tokens.length
      ? "aucun match caption → aléatoire du label"
      : "critère vide → aléatoire du label",
  };
}

export function extraireJsonObjet(brut: string): Record<string, unknown> | null {
  const t = brut.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const corps = fence?.[1]?.trim() ?? t;
  const debut = corps.indexOf("{");
  const fin = corps.lastIndexOf("}");
  if (debut < 0 || fin <= debut) return null;
  try {
    return JSON.parse(corps.slice(debut, fin + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export interface SlideGeneree {
  position: number;
  texte: string;
  critere: string;
}

export function parserSlidesGenerees(
  brut: string,
  opts: { hook: string; nbSlides: number },
): SlideGeneree[] {
  const json = extraireJsonObjet(brut);
  const raw = json?.slides;
  const out: SlideGeneree[] = [
    { position: 1, texte: opts.hook.trim(), critere: "" },
  ];
  if (!Array.isArray(raw)) return completerSlides(out, opts.nbSlides);
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const pos = Number(o.position ?? o.slide ?? 0);
    const texte = String(o.texte ?? o.text ?? o.overlay ?? "").trim();
    const critere = String(o.critere ?? o.criterion ?? o.keywords ?? "").trim();
    if (!texte || pos === 1) continue;
    out.push({
      position: Number.isFinite(pos) && pos >= 2 ? pos : out.length + 1,
      texte,
      critere,
    });
  }
  out.sort((a, b) => a.position - b.position);
  const uniques: SlideGeneree[] = [];
  for (const s of out) {
    if (uniques.some((u) => u.position === s.position)) continue;
    uniques.push(s);
  }
  return completerSlides(uniques, opts.nbSlides);
}

function completerSlides(slides: SlideGeneree[], nb: number): SlideGeneree[] {
  const cible = Math.min(SLIDES_MANUEL_MAX, Math.max(SLIDES_MANUEL_MIN, nb));
  const byPos = new Map(slides.map((s) => [s.position, s]));
  const hook = byPos.get(1)?.texte ?? "";
  const out: SlideGeneree[] = [];
  for (let p = 1; p <= cible; p += 1) {
    const exist = byPos.get(p);
    if (exist) out.push({ ...exist, position: p });
    else if (p === 1) out.push({ position: 1, texte: hook, critere: "" });
    else out.push({ position: p, texte: "", critere: "" });
  }
  return out;
}

export function hookTexteDepuisDeck(
  slides: Array<{ position?: number; texte_overlay?: string | null }> | null | undefined,
): string {
  const tries = (slides ?? [])
    .slice()
    .sort((a, b) => Number(a.position ?? 0) - Number(b.position ?? 0));
  const premiere =
    tries.find((s) => Number(s.position) === 1) ?? tries[0] ?? null;
  return (premiere?.texte_overlay ?? "").trim();
}

/** Feed few-shot : un exemple par paragraphe (ligne vide). */
export function exemplesFeedDepuisTexte(brut: string): string[] {
  return brut
    .split(/\n\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 20);
}

export function exemplesFeedVersTexte(feed: unknown): string {
  if (!Array.isArray(feed)) return "";
  return feed
    .map((x) => String(x).trim())
    .filter(Boolean)
    .join("\n\n");
}

export function normaliserEloManuel(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return ELO_MANUEL_DEFAUT;
  return Math.min(100, Math.max(0, n));
}
