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

/**
 * Passages à effectuer sur un cycle, par tier.
 *
 * Divisés par deux le 17/09/2026. Le tirage étant uniforme *par slideshow* et
 * non *par passage dû*, le nombre de passages fixe surtout la DURÉE pendant
 * laquelle un slideshow reste dans le pool — un S+ à 16 passages mettait seize
 * fois plus longtemps qu'un C à remplir son cycle, donc à être requalifié, donc
 * à sortir de son gel une fois à x/x. Moitié moins de passages, c'est moitié
 * moins d'attente entre deux verdicts, et un pool qui tourne deux fois plus.
 *
 * B tombe à 1, à égalité avec C : le nombre de passages ne distingue plus ces
 * deux tiers, seule `prioriserTiersHauts` le fait — un B sort avant un C.
 */
export const PASSAGES_PAR_TIER: Record<Tier, number> = {
  D: 0,
  C: 1,
  B: 1,
  A: 2,
  S: 4,
  "S+": 8,
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

/**
 * Recul minimum avant qu'un slideshow puisse revenir sur le MÊME compte.
 *
 * Jusqu'au 19/09/2026, `choisirContenu` n'excluait que les slideshows déjà
 * sortis **le jour même** : un contenu publié le 16 redevenait tirable le 17.
 * Sur 17 comptes actifs, 15 ont reçu au moins un doublon et **46 sont partis
 * deux fois en ligne**, avec des écarts de 1 à 10 jours — le tout sans qu'un
 * seul pool soit épuisé (105+ inédits par compte, plus de 50 jours d'autonomie).
 *
 * Doit rester AU-DESSUS de `REPOST_BONUS_JOURS`. Rejouer un post sur le même
 * compte est une décision qui se prend, pas un hasard de tirage : elle a son
 * mécanisme (> 50 000 vues, J+7, `bonus_repost = true`, hors cycle). Si le
 * recul descendait à 7 jours ou moins, le tirage ordinaire pourrait produire
 * la même répétition au même moment, sans le mérite ni la traçabilité — et on
 * ne saurait plus lire un doublon en base.
 */
export const RECUL_MEME_COMPTE_JOURS = 30;

/**
 * Un passage n'est « mesuré » qu'après ce délai (vues stabilisées).
 *
 * Passé de 3 à 2 jours le 16/09/2026, sur la courbe réelle du projet : vues
 * médianes 676 à J+0, 1 073 à J+1, 1 491 à J+2, puis un plateau à ~1 400-1 620
 * de J+4 à J+6. À J+2 on tient déjà ~96 % du plateau — le troisième jour
 * n'achetait presque rien et coûtait un jour sur chaque cycle.
 *
 * Deux garde-fous tiennent toujours : la fenêtre de scrape reste strictement
 * au-dessus (`RATTRAPAGE_JOURS_DEFAUT`, 3 j depuis le 17/09), donc le post est
 * encore relevé quand on le mesure, et la deuxième passe de 13:00 Paris voit
 * chaque passage deux fois avant l'échéance.
 */
export const MESURE_JOURS = 2;
/**
 * Passé ce délai, un passage ne comptera jamais : le créateur n'a pas publié,
 * ou le relevé n'a jamais accroché le post. Doit rester AU-DESSUS de la fenêtre
 * de scrape (`RATTRAPAGE_JOURS_DEFAUT`) pour ne pas condamner un passage qu'on
 * est encore en train de relever.
 *
 * Passé de 5 à 4 jours le 17/09/2026, en même temps que la fenêtre de scrape
 * (4 -> 3) : un créneau raté gelait le cycle un jour de plus que nécessaire, et
 * c'est le dernier passage non réglé qui retient toute la requalification.
 *
 * Descendre plus bas exigerait de toucher aussi à MESURE_JOURS. Les trois
 * constantes sont liées : fenêtre > mesure (le relevé doit encore couvrir le
 * post quand on lit ses vues) et péremption > fenêtre. À 4/3/2 les deux
 * tiennent ; à 3/2/2 la première saute et l'on mesurerait à J+2 un chiffre figé
 * à J+1 — ~72 % du réel sur la courbe du projet, de quoi faire basculer en C
 * tout ce qui vit entre 1 000 et 1 491 vues.
 */
export const PASSAGE_PERIME_JOURS = 4;
/**
 * Profondeur par défaut du relevé de vues, en jours (aujourd'hui compris).
 *
 * Vit ici, et pas dans `rattrapage_elo.ts`, parce qu'elle n'est pas un réglage
 * du relevé : c'est le troisième terme d'un trio ordonné —
 * `MESURE_JOURS < RATTRAPAGE_JOURS_DEFAUT < PASSAGE_PERIME_JOURS`. Séparées,
 * ces constantes se sont désynchronisées sans que rien ne le signale.
 */
export const RATTRAPAGE_JOURS_DEFAUT = 3;
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

/**
 * Un passage périmé ne comptera plus jamais dans un cycle.
 *
 * Deux façons de mourir : jamais publié (le créateur a laissé passer son
 * créneau) ou publié sans relevé au-delà de la fenêtre de scrape. Sans cette
 * notion, un seul créateur qui ne poste pas gèle son slideshow pendant les
 * 14 jours du timeout — alors que les autres passages du cycle, eux, ont
 * livré leur verdict.
 */
export function passagePerime(
  p: {
    statut: string;
    publie_at: string | null;
    vues: number | null;
    date_publication_prevue?: string | null;
  },
  maintenant = Date.now(),
): boolean {
  if (passageMesure(p, maintenant)) return false;
  const limite = PASSAGE_PERIME_JOURS * 86_400_000;

  // Publié, mais le relevé ne l'a jamais accroché : la fenêtre est passée.
  if (p.statut === "publie" && p.publie_at) {
    const t = Date.parse(p.publie_at);
    return Number.isFinite(t) && maintenant - t >= limite;
  }

  // Jamais publié : on part du créneau qu'il aurait dû tenir. Fin de journée
  // UTC (donc un peu après la fin de journée Paris) — on préfère attendre deux
  // heures de trop que condamner un passage publié tard.
  if (!p.date_publication_prevue) return false;
  const prevu = Date.parse(`${p.date_publication_prevue}T23:59:59Z`);
  return Number.isFinite(prevu) && maintenant - prevu >= limite;
}

/**
 * Un passage est « réglé » quand il ne peut plus changer le verdict du cycle :
 * mesuré (il pèse dans la moyenne) ou périmé (il ne pèsera jamais). Un cycle se
 * clôt sur des passages réglés, pas sur des passages publiés.
 */
export function passageRegle(
  p: {
    statut: string;
    publie_at: string | null;
    vues: number | null;
    date_publication_prevue?: string | null;
  },
  maintenant = Date.now(),
): boolean {
  return passageMesure(p, maintenant) || passagePerime(p, maintenant);
}

/**
 * Bilan d'un cycle : ce qui pèse, ce qui est écrit en perte, et si on peut
 * trancher. Pur — pour que le moteur et l'écran comptent pareil.
 *
 * Le cycle se clôt quand il est rempli (`cible` passages) **et** que chacun
 * d'eux est réglé. `m` ne se calcule que sur les mesurés : un passage périmé
 * ne vaut pas zéro vue, il ne vaut rien du tout — le compter à zéro ferait
 * chuter un slideshow parce qu'un créateur n'a pas posté.
 */
export function bilanCycle(
  cycle: Array<{
    statut: string;
    publie_at: string | null;
    vues: number | null;
    date_publication_prevue?: string | null;
  }>,
  cible: number,
  maintenant = Date.now(),
): { mesures: number; perimes: number; clos: boolean; m: number | null } {
  const mesures = cycle.filter((p) => passageMesure(p, maintenant));
  const perimes = cycle.filter((p) => passagePerime(p, maintenant));
  // Un passage ne peut pas être les deux : « réglés » = mesurés + périmés.
  const clos = cycle.length >= cible && mesures.length + perimes.length === cycle.length;
  const m = mesures.length > 0
    ? mesures.reduce((s, p) => s + Number(p.vues ?? 0), 0) / mesures.length
    : null;
  return { mesures: mesures.length, perimes: perimes.length, clos, m };
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
 * Part des tirages réservée aux C quand il y en a de dus (25/09/2026).
 *
 * Avant, la priorité aux tiers hauts était un VERROU : un C ne sortait pas tant
 * qu'un seul B+ devait un passage. C'était une trappe sans fond, et c'est une
 * erreur de conception, pas un réglage trop serré — il faut être posté pour être
 * mesuré, et il faut être mesuré pour être requalifié. Un C ne pouvait donc
 * JAMAIS remonter. Le 25/09, 57 des 81 slideshows dus étaient en C : le moteur
 * tirait 59 posts par jour dans un vivier de 24, d'où « toujours les mêmes ».
 *
 * 0,3 n'est pas pris au jugé. Au 25/09 : 39 passages dus en B+, 59 posts par
 * jour. À 30 % réservés aux C, il reste 0,7 × 59 ≈ 41 créneaux pour les tiers
 * hauts — toujours au-dessus des 39 dus, donc **les B+ ne perdent rien** et
 * ~18 C sont mesurés chaque jour. La part est le seul chiffre à revoir si le
 * rapport entre les deux bascule.
 */
export const PART_TIRAGE_C = 0.3;

/**
 * Le tier ne pondère pas le tirage (il fixe le nombre de passages dus) ; cette
 * fonction restreint l'ensemble dans lequel `tirerAuHasard` va piocher, et le
 * tirage reste uniforme à l'intérieur du groupe retenu.
 *
 * Trois cas :
 *  - plus rien en B+ → tout le pool, C compris ;
 *  - plus aucun C dû → les B+ ;
 *  - les deux → `PART_TIRAGE_C` fois sur dix les C, sinon les B+.
 *
 * Un slideshow SANS tier n'est pas un C : il ne rejoint pas la part réservée et
 * ne sort que par le repli « plus rien en B+ », comme avant. Son cycle n'a pas
 * de sens jusqu'à sa première qualification.
 *
 * `alea` est injectable pour que le test puisse verrouiller les trois branches
 * sans dépendre du hasard.
 */
export function prioriserTiersHauts<T extends { tier: string | null }>(
  candidats: T[],
  alea: () => number = Math.random,
): T[] {
  const plancher = indexTier(TIER_TIRAGE_PRIORITAIRE);
  const hauts = candidats.filter((c) => estTier(c.tier) && indexTier(c.tier) >= plancher);
  if (hauts.length === 0) return candidats;
  const bas = candidats.filter((c) => estTier(c.tier) && indexTier(c.tier) < plancher);
  if (bas.length === 0) return hauts;
  return alea() < PART_TIRAGE_C ? bas : hauts;
}
