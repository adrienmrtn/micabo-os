/**
 * Quels passages relever, et comment les retrouver sur TikTok.
 *
 * Module PUR (aucun réseau), réexporté par `src/features/moteur/releveFile.ts`
 * pour que Vitest le lise : `rattrapage_elo.ts` tire `supabase.ts` et son
 * specifier `jsr:`, que Vite ne résout pas.
 *
 * UNE mesure par post, à J+2, et c'est tout (décision d'Adrien, 01/10/2026).
 *
 * Avant le 01/10, tout passage publié depuis 30 jours était re-scrapé dès que
 * son dernier relevé avait 6 h, par le profil du créateur : jusqu'à ~60
 * mesures par post, ~2 450 résultats Apify par jour, crédit épuisé le 28/09.
 * 0281 a ramené ça à un relevé par jour pendant 7 jours, toujours par le
 * profil : ~20 posts lus par compte et par passe, ~2,5 $/jour, encore au-dessus
 * du budget. Or le moteur ne lit qu'UN chiffre : celui de J+2
 * (`MESURE_JOURS`), sur lequel se juge le cycle. Le reste ne servait à rien.
 *
 * Désormais :
 *   - un post est mesuré une fois, quand il a `MESURE_JOURS` jours ;
 *   - par son lien, tous les posts dus d'un compte dans UN appel Apify
 *     (`postURLs`) : on paie le post, pas les vingt qui l'entourent ;
 *   - sans lien valide, et seulement là, on lit le profil pour le retrouver.
 */
import { MESURE_JOURS } from "./tierlist.ts";

const JOUR_MS = 86_400_000;

/** Âge auquel un post est mesuré : celui que lit la requalification. */
export const MESURE_A_MS = MESURE_JOURS * JOUR_MS;

/**
 * Un relevé raté (post introuvable, lien mort) n'est retenté qu'après ce
 * délai. Au-dessus de 13 h, l'écart entre la passe de minuit et celle de
 * 13:00 Paris : une passe ne retente pas ce que la précédente vient de rater.
 */
export const RETENTER_APRES_MS = 20 * 3600_000;

/**
 * Au bout de ce nombre de relevés sans correspondance (post supprimé, lien
 * faux), on arrête de payer pour ce passage.
 */
export const RELEVE_ECHECS_MAX = 3;

/**
 * Un post sans lien n'est cherché sur le profil que s'il est récent : plus
 * vieux, il est enfoui sous des dizaines de posts, et chaque post lu se paie.
 */
export const SANS_LIEN_MAX_JOURS = 7;

/** Profondeur de scrape d'un profil (posts sans lien) : plancher et plafond. */
export const POSTS_RELEVES = 12;
export const POSTS_RELEVES_MAX = 40;

export interface PassageReleve {
  publie_at: string | null;
  date_publication_prevue: string | null;
  publie_url?: string | null;
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

/** Instant de publication : `publie_at`, à défaut midi UTC du créneau prévu. */
function publication(p: PassageReleve): number {
  const publie = instant(p.publie_at);
  if (Number.isFinite(publie)) return publie;
  return p.date_publication_prevue ? Date.parse(`${p.date_publication_prevue}T12:00:00Z`) : NaN;
}

/** Âge du post : depuis `publie_at`, à défaut depuis midi UTC du créneau prévu. */
export function agePublicationMs(p: PassageReleve, maintenant = Date.now()): number {
  const t = publication(p);
  return Number.isFinite(t) ? maintenant - t : NaN;
}

/**
 * Le post a-t-il déjà sa mesure de J+2 ? Un relevé pris plus tôt (avant le
 * 01/10, le moteur mesurait dès J+0) ne compte pas : le post sera mesuré une
 * fois de plus, à J+2, puis plus jamais.
 */
export function mesureFaite(p: PassageReleve): boolean {
  const releve = instant(p.stats_maj_at);
  const t = publication(p);
  if (!Number.isFinite(releve) || !Number.isFinite(t)) return false;
  return releve - t >= MESURE_A_MS;
}

/** Un lien TikTok exploitable. Le 01/10, 4 passages portaient des hashtags collés à sa place. */
export function lienTiktok(url: string | null | undefined): boolean {
  if (!url) return false;
  return /^https?:\/\/([a-z0-9-]+\.)*tiktok\.com\/\S+$/i.test(url.trim());
}

/**
 * La dernière tentative a-t-elle échoué il y a moins de `RETENTER_APRES_MS` ?
 * Un relevé réussi écrit `stats_maj_at` et `stats_tentative_at` au même
 * instant ; une tentative ratée n'écrit que `stats_tentative_at`.
 */
function echecRecent(p: PassageReleve, maintenant: number): boolean {
  const tentative = instant(p.stats_tentative_at);
  if (!Number.isFinite(tentative) || maintenant - tentative >= RETENTER_APRES_MS) return false;
  const releve = instant(p.stats_maj_at);
  return !Number.isFinite(releve) || tentative - releve > 60_000;
}

/**
 * Le passage doit-il être relevé à cette passe ?
 *
 *   - publié depuis moins de `MESURE_JOURS` → non, il n'a pas l'âge ;
 *   - déjà mesuré à J+2 ou plus → non, jamais plus ;
 *   - `RELEVE_ECHECS_MAX` échecs → non (introuvable, on arrête de payer) ;
 *   - dernière tentative ratée il y a moins de 20 h → non (un relevé RÉUSSI
 *     mais pris trop tôt, avant J+2, n'attend pas : il est refait dès J+2) ;
 *   - sans lien valide et plus vieux que `SANS_LIEN_MAX_JOURS` → non ;
 *   - sinon → oui.
 */
export function passageARelever(p: PassageReleve, maintenant = Date.now()): boolean {
  const age = agePublicationMs(p, maintenant);
  if (!Number.isFinite(age) || age < MESURE_A_MS) return false;
  if (mesureFaite(p)) return false;
  if ((p.stats_echecs ?? 0) >= RELEVE_ECHECS_MAX) return false;
  if (echecRecent(p, maintenant)) return false;
  if (!lienTiktok(p.publie_url) && age > SANS_LIEN_MAX_JOURS * JOUR_MS) return false;
  return true;
}

/** Identifiant TikTok d'un post (`/photo/<id>` ou `/video/<id>`), null si le lien n'en porte pas. */
export function idPostTiktok(url: string | null | undefined): string | null {
  return url?.match(/\/(?:photo|video)\/(\d+)/)?.[1] ?? null;
}

/** Un lien comparable : sans schéma, sans paramètres, sans « / » final, en minuscules. */
function lienNormalise(url: string | null | undefined): string | null {
  if (!url) return null;
  return url.trim().replace(/^https?:\/\//i, "").split("?")[0]!.replace(/\/+$/, "").toLowerCase();
}

/**
 * Rapproche les posts renvoyés par Apify des passages demandés.
 *
 *   1. par l'identifiant du post : celui du lien résolu (`vm.tiktok.com`
 *      redirige vers `/photo/<id>`) contre celui du résultat ;
 *   2. à défaut, par le lien demandé, quand l'actor le renvoie
 *      (`submittedVideoUrl`) — un lien court que notre résolution a raté ;
 *   3. si un seul lien a été demandé et qu'un seul post revient, c'est lui.
 */
export function apparierParLien<
  P extends { id: string },
  R extends { postId: string; webVideoUrl: string; lienDemande?: string | null },
>(
  demandes: Array<{ passage: P; idPost: string | null; url?: string }>,
  resultats: R[],
): Map<string, R> {
  const parId = new Map<string, R>();
  const parLien = new Map<string, R>();
  for (const r of resultats) {
    const id = r.postId || idPostTiktok(r.webVideoUrl);
    if (id) parId.set(id, r);
    const lien = lienNormalise(r.lienDemande);
    if (lien) parLien.set(lien, r);
  }
  const out = new Map<string, R>();
  for (const d of demandes) {
    const lien = lienNormalise(d.url);
    const r = (d.idPost ? parId.get(d.idPost) : undefined) ?? (lien ? parLien.get(lien) : undefined);
    if (r) out.set(d.passage.id, r);
  }
  if (out.size === 0 && demandes.length === 1 && resultats.length === 1) {
    out.set(demandes[0]!.passage.id, resultats[0]!);
  }
  return out;
}

/**
 * Combien de posts lire sur le profil pour retrouver les passages SANS lien.
 *
 * TikTok rend le profil du plus récent au plus ancien : ce qui compte est la
 * PROFONDEUR (combien de nos posts ont été publiés depuis le plus vieux passage
 * cherché). Marge de 25 % + 2 pour les posts personnels du créateur. 0 = rien
 * à scraper.
 */
export function profondeurScrape(
  publiesCompte: PassageReleve[],
  cherches: PassageReleve[],
  maintenant = Date.now(),
): number {
  if (cherches.length === 0) return 0;
  const ages = cherches.map((p) => agePublicationMs(p, maintenant)).filter(Number.isFinite);
  const plusVieux = ages.length > 0 ? Math.max(...ages) : Infinity;
  const aRemonter = publiesCompte.filter((p) => {
    const age = agePublicationMs(p, maintenant);
    return !Number.isFinite(age) || age <= plusVieux;
  }).length;
  const voulu = Math.ceil(Math.max(aRemonter, cherches.length) * 1.25) + 2;
  return Math.min(POSTS_RELEVES_MAX, Math.max(POSTS_RELEVES, voulu));
}

/** Vrai si l'erreur vient d'Apify à court de crédit : inutile d'insister. */
export function estApifyEpuise(erreur: string): boolean {
  return /Apify 402/.test(erreur) || /not-enough-usage/.test(erreur);
}
