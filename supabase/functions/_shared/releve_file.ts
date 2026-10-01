/**
 * Quels passages relever, et à quelle profondeur scraper un profil TikTok.
 *
 * Module PUR (aucun réseau), réexporté par `src/features/moteur/releveFile.ts`
 * pour que Vitest le lise : `rattrapage_elo.ts` tire `supabase.ts` et son
 * specifier `jsr:`, que Vite ne résout pas.
 *
 * Avant le 01/10/2026, tout passage publié depuis 30 jours était re-scrapé dès
 * que son dernier relevé avait 6 h : deux fois par jour pendant un mois, soit
 * jusqu'à ~60 mesures par post, alors que le moteur n'en lit qu'une
 * (`MESURE_JOURS`, J+2) et que le plateau est atteint vers J+4–J+6. Le 28/09 :
 * 1 349 passages re-mesurés pour ~50 nouveaux posts, ~2 450 résultats Apify
 * lus. C'est ce qui a épuisé le crédit Apify le 28/09 au soir.
 */
const JOUR_MS = 86_400_000;

/**
 * Un post scrapé plus tôt que ça n'est pas encore indexé par TikTok : le
 * scrape rend « pas de match », ou des vues quasi nulles. Le 13/09/2026, deux
 * posts publiés à 22:03 et 22:07 ont été scrapés à 22:07 — jamais mesurés.
 */
export const DELAI_MIN_RELEVE_MS = 45 * 60_000;

/**
 * Un relevé n'est refait que s'il a vieilli de 20 h.
 *
 * Coincé entre les deux passes : au-dessus de 13 h, pour que la passe de 13:00
 * Paris ne re-mesure pas ce que celle de minuit vient de mesurer (elle ne
 * prend plus que les posts publiés dans la matinée) ; sous 24 h moins la durée
 * d'un drain, pour que la passe de minuit suivante reprenne tout ce qui est dû.
 * C'était 6 h : chaque passe re-scrapait la totalité de la passe précédente.
 */
export const RAFRAICHIR_APRES_MS = 20 * 3600_000;

/**
 * Au-delà, un passage mesuré n'est plus relevé : son chiffre est figé.
 *
 * Doit rester au-dessus de `PASSAGE_PERIME_JOURS` (un passage qu'on peut encore
 * déclarer périmé doit pouvoir encore être mesuré) et de `MESURE_JOURS` (le
 * chiffre lu par la requalification doit être frais). À 7 jours, un post est
 * mesuré une fois par jour de J+0 à J+7, plateau compris.
 */
export const RELEVE_FIGE_APRES_JOURS = 7;

/**
 * Au bout de ce nombre de relevés sans correspondance (post supprimé, lien
 * faux), on arrête de payer pour ce passage. Avant, un post introuvable
 * déclenchait un `scrapePost` Apify à chaque passe pendant 30 jours : 22 « pas
 * de match » le 28/09, retentés deux fois par jour.
 */
export const RELEVE_ECHECS_MAX = 3;

/** Profondeur de scrape d'un profil : plancher et plafond (timeout Edge 150 s). */
export const POSTS_RELEVES = 12;
export const POSTS_RELEVES_MAX = 40;

export interface PassageReleve {
  publie_at: string | null;
  date_publication_prevue: string | null;
  /** Dernier relevé réussi — null = jamais mesuré. */
  stats_maj_at?: string | null;
  /** Relevés consécutifs sans correspondance. */
  stats_echecs?: number | null;
  /** Dernière tentative, réussie ou non. */
  stats_tentative_at?: string | null;
}

function instant(iso: string | null | undefined): number {
  return iso ? Date.parse(iso) : NaN;
}

/** Âge du post : depuis `publie_at`, à défaut depuis midi UTC du créneau prévu. */
export function agePublicationMs(p: PassageReleve, maintenant = Date.now()): number {
  const publie = instant(p.publie_at);
  if (Number.isFinite(publie)) return maintenant - publie;
  const prevu = p.date_publication_prevue ? Date.parse(`${p.date_publication_prevue}T12:00:00Z`) : NaN;
  return Number.isFinite(prevu) ? maintenant - prevu : NaN;
}

/**
 * Le passage doit-il être relevé à cette passe ?
 *
 *   - publié depuis moins de 45 min → non (pas encore indexé) ;
 *   - `RELEVE_ECHECS_MAX` échecs → non (introuvable, on arrête de payer) ;
 *   - tenté depuis moins de 20 h → non ;
 *   - jamais mesuré → oui ;
 *   - mesuré, publié depuis plus de `RELEVE_FIGE_APRES_JOURS` → non (figé) ;
 *   - mesuré il y a 20 h ou plus → oui.
 */
export function passageARelever(p: PassageReleve, maintenant = Date.now()): boolean {
  const age = agePublicationMs(p, maintenant);
  if (Number.isFinite(age) && age < DELAI_MIN_RELEVE_MS) return false;
  if ((p.stats_echecs ?? 0) >= RELEVE_ECHECS_MAX) return false;
  const tentative = instant(p.stats_tentative_at);
  if (Number.isFinite(tentative) && maintenant - tentative < RAFRAICHIR_APRES_MS) return false;
  if (!p.stats_maj_at) return true;
  if (!Number.isFinite(age) || age > RELEVE_FIGE_APRES_JOURS * JOUR_MS) return false;
  const releve = instant(p.stats_maj_at);
  if (!Number.isFinite(releve)) return true;
  return maintenant - releve >= RAFRAICHIR_APRES_MS;
}

/**
 * Le `scrapePost` de repli (un lancement Apify par post) n'a de sens que pour
 * un post encore dans la fenêtre de relevé. Plus vieux, il ne se rattrape que
 * par le scrape du profil.
 */
export function repliAutorise(p: PassageReleve, maintenant = Date.now()): boolean {
  const age = agePublicationMs(p, maintenant);
  return Number.isFinite(age) && age <= RELEVE_FIGE_APRES_JOURS * JOUR_MS;
}

/**
 * Combien de posts lire sur le profil pour retrouver tous les passages dus.
 *
 * TikTok rend le profil du plus récent au plus ancien : ce qui compte est la
 * PROFONDEUR (combien de nos posts ont été publiés depuis le plus vieux passage
 * dû), pas le NOMBRE de passages dus. L'ancienne règle (2 × le nombre de dus)
 * lisait 40 posts dès que 20 passages étaient dus, même tous récents. Marge de
 * 25 % + 2 pour les posts personnels du créateur. 0 = rien à scraper.
 */
export function profondeurScrape(
  publiesCompte: PassageReleve[],
  dus: PassageReleve[],
  maintenant = Date.now(),
): number {
  if (dus.length === 0) return 0;
  const ages = dus.map((p) => agePublicationMs(p, maintenant)).filter(Number.isFinite);
  const plusVieux = ages.length > 0 ? Math.max(...ages) : Infinity;
  const aRemonter = publiesCompte.filter((p) => {
    const age = agePublicationMs(p, maintenant);
    return !Number.isFinite(age) || age <= plusVieux;
  }).length;
  const voulu = Math.ceil(Math.max(aRemonter, dus.length) * 1.25) + 2;
  return Math.min(POSTS_RELEVES_MAX, Math.max(POSTS_RELEVES, voulu));
}

/**
 * Le scrape « metrics seules » d'un compte sans passage dû (total du profil
 * pour `compte_metrics`) : au plus une fois toutes les 20 h. Il tournait à
 * chaque passe, pour un chiffre que rien ne lit au-delà du snapshot quotidien.
 */
export function metricsAScraper(dernierMetricsAt: string | null | undefined, maintenant = Date.now()): boolean {
  const dernier = instant(dernierMetricsAt);
  return !Number.isFinite(dernier) || maintenant - dernier >= RAFRAICHIR_APRES_MS;
}

/** Vrai si l'erreur vient d'Apify à court de crédit : inutile d'insister. */
export function estApifyEpuise(erreur: string): boolean {
  return /Apify 402/.test(erreur) || /not-enough-usage/.test(erreur);
}
