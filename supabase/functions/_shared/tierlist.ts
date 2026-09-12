/**
 * Tierlist des slideshows — remplace l'ELO par langue.
 *
 * Un slideshow a UN tier (D → S+), pas un score par langue. Le tier fixe le
 * nombre de passages à effectuer ; quand ils sont faits (et mesurés), le cron
 * de minuit requalifie le post sur la moyenne de vues de ces passages.
 *
 * Les bandes de requalification sont absolues (la moyenne `m` décide seule du
 * tier visé), avec deux garde-fous :
 *   - on ne descend jamais de plus d'un cran par requalification ;
 *   - sortir de D demande 1 000 vues alors qu'on ne tombe de C que sous 600
 *     (hystérésis volontaire : D est collant).
 * La montée, elle, n'est pas plafonnée (un C à 200 k vues va en S+).
 */

export type Tier = "D" | "C" | "B" | "A" | "S" | "S+";

/** Du plus faible au plus fort — l'index sert au clamp de descente. */
export const TIERS: readonly Tier[] = ["D", "C", "B", "A", "S", "S+"] as const;

/** Passages à effectuer sur un cycle, par tier. */
export const PASSAGES_PAR_TIER: Record<Tier, number> = {
  D: 0,
  C: 1,
  B: 2,
  A: 4,
  S: 8,
  "S+": 16,
};

/** Bandes absolues de vues moyennes → tier visé. */
const BANDES: Array<{ min: number; tier: Tier }> = [
  { min: 150_000, tier: "S+" },
  { min: 30_000, tier: "S" },
  { min: 5_000, tier: "A" },
  { min: 1_000, tier: "B" },
  { min: 600, tier: "C" },
  { min: 0, tier: "D" },
];

/** Vues moyennes minimales pour qu'un post en D sorte de D. */
export const SORTIE_D_MIN_VUES = 1_000;

/** Seuil d'import : sous cette note /100, le TikTok n'est pas importé. */
export const NOTE_IMPORT_MIN = 55;
/** Note d'import → B à partir de 60, A à partir de 70. */
export const NOTE_IMPORT_B = 60;
export const NOTE_IMPORT_A = 70;

/**
 * Vues minimales du TikTok d'origine pour entrer au-dessus de C.
 *
 * La note mélange pertinence et vues : un TikTok très pertinent mais peu vu
 * pouvait entrer en B, voire en A. On n'accorde plus 2 à 4 passages à un
 * slideshow dont la source n'a jamais convaincu personne — il entre en C et
 * remonte s'il le mérite chez nous.
 */
export const VUES_SOURCE_MIN_B_PLUS = 10_000;

/** Vues d'un passage à partir desquelles on replanifie le même post à J+7. */
export const VUES_REPOST_BONUS = 50_000;
/** Décalage du repost bonus, en jours. */
export const REPOST_BONUS_JOURS = 7;

/** Un passage n'est « mesuré » qu'après ce délai (vues stabilisées). */
export const MESURE_JOURS = 3;
/** Cycle qui traîne (passages jamais publiés) : requalification forcée. */
export const CYCLE_TIMEOUT_JOURS = 14;

export function estTier(valeur: unknown): valeur is Tier {
  return typeof valeur === "string" && (TIERS as readonly string[]).includes(valeur);
}

export function indexTier(tier: Tier): number {
  return TIERS.indexOf(tier);
}

export function passagesPourTier(tier: Tier): number {
  return PASSAGES_PAR_TIER[tier];
}

/** Tier visé par une moyenne de vues, sans mémoire du tier actuel. */
export function tierDepuisMoyenne(m: number): Tier {
  const vues = Number.isFinite(m) ? Math.max(0, m) : 0;
  for (const bande of BANDES) {
    if (vues >= bande.min) return bande.tier;
  }
  return "D";
}

/**
 * Nouveau tier après un cycle complet.
 * `m` = moyenne des vues des passages mesurés depuis la dernière requalification.
 */
export function requalifier(actuel: Tier, m: number): Tier {
  // D est collant : il faut 1 000 vues pour en sortir (et non 600).
  if (actuel === "D" && m < SORTIE_D_MIN_VUES) return "D";

  const vise = tierDepuisMoyenne(m);
  const plancher = Math.max(0, indexTier(actuel) - 1);
  const idx = Math.max(indexTier(vise), plancher);
  return TIERS[idx]!;
}

/**
 * Premier placement à l'import. `null` = sous le seuil, TikTok non importé.
 *
 * `vuesSource` est plafonnant : sous `VUES_SOURCE_MIN_B_PLUS`, l'entrée se fait
 * en C quelle que soit la note.
 */
export function tierImport(note: number, vuesSource: number | null | undefined): Tier | null {
  if (!Number.isFinite(note) || note < NOTE_IMPORT_MIN) return null;
  if ((vuesSource ?? 0) < VUES_SOURCE_MIN_B_PLUS) return "C";
  if (note < NOTE_IMPORT_B) return "C";
  if (note < NOTE_IMPORT_A) return "B";
  return "A";
}

/**
 * Reprise du stock : ancien ELO de la langue native → tier.
 * Volontairement plus généreux que `tierImport` — ces scores ont déjà bougé
 * avec les performances réelles des posts.
 */
export function tierDepuisEloLegacy(elo: number): Tier {
  if (!Number.isFinite(elo) || elo < 50) return "D";
  if (elo < 55) return "C";
  if (elo < 60) return "B";
  if (elo < 70) return "A";
  if (elo < 80) return "S";
  return "S+";
}

/** Un passage ne compte dans un cycle qu'une fois ses vues stabilisées. */
export function passageMesure(
  p: { statut: string; publie_at: string | null; vues: number | null },
  maintenant = Date.now(),
): boolean {
  if (p.statut !== "publie" || p.vues == null) return false;
  if (!p.publie_at) return false;
  const t = Date.parse(p.publie_at);
  if (!Number.isFinite(t)) return false;
  return maintenant - t >= MESURE_JOURS * 86_400_000;
}

function jourParis(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date(iso));
}

/** Ajoute des jours calendaires, ancré midi UTC (pas de bascule DST). */
export function ajouterJoursParis(yyyyMmDd: string, delta: number): string {
  const d = new Date(`${yyyyMmDd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(d);
}

/**
 * Jour prévu d'un repost bonus : J+7 après la publication, jamais dans le passé
 * (stats relevées tardivement → on repousse à demain).
 */
export function jourRepostBonus(publieAt: string | null, aujourdhui: string): string {
  const base = publieAt ? jourParis(publieAt) : aujourdhui;
  const prevu = ajouterJoursParis(base, REPOST_BONUS_JOURS);
  return prevu > aujourdhui ? prevu : ajouterJoursParis(aujourdhui, 1);
}

/** Plancher du tirage prioritaire : B et au-dessus. */
export const TIER_TIRAGE_PRIORITAIRE: Tier = "B";

/**
 * Un C ne sort que si le pool n'a plus rien en B ou mieux.
 *
 * Le tier ne pondère pas le tirage (il fixe le nombre de passages dus), mais
 * on ne veut pas voir partir un C tant qu'il reste du B+ à servir : renvoie le
 * sous-ensemble B+ s'il n'est pas vide, la liste entière sinon. À l'intérieur
 * du groupe retenu, le tirage reste uniforme.
 */
export function prioriserTiersHauts<T extends { tier: string | null }>(candidats: T[]): T[] {
  const plancher = indexTier(TIER_TIRAGE_PRIORITAIRE);
  const hauts = candidats.filter((c) => estTier(c.tier) && indexTier(c.tier) >= plancher);
  return hauts.length > 0 ? hauts : candidats;
}
