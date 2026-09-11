/**
 * Requalification tierlist — tourne au cron de minuit, à la place de l'ancien
 * ELO langue.
 *
 * Un slideshow a un cycle ouvert : `passages_cible` passages à effectuer depuis
 * `tier_maj_at`. Quand tous ces passages sont publiés ET mesurés (≥ 3 jours
 * après publication, les vues sont stabilisées), on calcule `m` = moyenne des
 * vues du cycle, on requalifie le tier (`_shared/tierlist.ts`) et on ouvre un
 * nouveau cycle au format du nouveau tier.
 *
 * Un cycle qui traîne (passages jamais publiés) est requalifié de force au bout
 * de 14 jours sur les passages réellement mesurés — sinon un slideshow reste
 * bloqué à vie sur un créateur qui ne poste pas.
 *
 * Ce module gère aussi les reposts bonus : un passage qui dépasse 50 000 vues
 * replanifie le MÊME post sur le MÊME compte à J+7.
 */
import { lireParLots } from "./lots.ts";
import { aujourdhuiParis } from "./supabase.ts";
import {
  CYCLE_TIMEOUT_JOURS,
  estTier,
  jourRepostBonus,
  passageMesure,
  passagesPourTier,
  requalifier,
  VUES_REPOST_BONUS,
  type Tier,
} from "./tierlist.ts";
import type { Supabase } from "./scoring.ts";

export interface RequalificationDetail {
  contenuId: string;
  titre: string | null;
  avant: Tier;
  apres: Tier;
  /** Moyenne des vues mesurées du cycle (null = cycle vide requalifié au timeout). */
  m: number | null;
  passagesMesures: number;
  passagesCible: number;
  nouveauCible: number;
  /** Cycle clos par le timeout 14 j plutôt que par les passages effectués. */
  timeout: boolean;
}

export interface RequalificationResultat {
  examines: number;
  requalifies: number;
  montees: number;
  descentes: number;
  inchanges: number;
  /** Cycles rouverts sans aucun passage mesuré (timeout sec). */
  cyclesVides: number;
  details: RequalificationDetail[];
}

type PostLie = { est_test?: boolean | null } | Array<{ est_test?: boolean | null }> | null;

function estPassageDeTest(posts: PostLie | undefined): boolean {
  if (!posts) return false;
  const p = Array.isArray(posts) ? posts[0] : posts;
  return Boolean(p?.est_test);
}

interface PassageCycle {
  id: string;
  contenu_id: string;
  compte_id: string;
  created_at: string;
  statut: string;
  publie_at: string | null;
  vues: number | null;
  bonus_repost: boolean | null;
  posts?: PostLie;
}

/**
 * Requalifie les slideshows dont le cycle est terminé (ou expiré).
 * Idempotent : un cycle requalifié repart de `tier_maj_at = now()`.
 */
export async function requalifierContenus(
  supabase: Supabase,
  opts: { dryRun?: boolean; contenuId?: string | null } = {},
): Promise<RequalificationResultat> {
  const out: RequalificationResultat = {
    examines: 0,
    requalifies: 0,
    montees: 0,
    descentes: 0,
    inchanges: 0,
    cyclesVides: 0,
    details: [],
  };

  let q = supabase
    .from("contenus")
    .select("id, titre, tier, passages_cible, tier_maj_at")
    .not("tier", "is", null)
    .gt("passages_cible", 0);
  if (opts.contenuId) q = q.eq("id", opts.contenuId);

  const { data: contenus, error } = await q;
  if (error) throw error;
  const actifs = (contenus ?? []).filter((c) => estTier(c.tier) && c.tier_maj_at);
  out.examines = actifs.length;
  if (actifs.length === 0) return out;

  // Une seule lecture des passages, bornée au plus ancien cycle ouvert.
  const debut = actifs
    .map((c) => c.tier_maj_at as string)
    .reduce((a, b) => (a < b ? a : b));
  const passages = await lireParLots<PassageCycle>(
    actifs.map((c) => c.id as string),
    "Requalification — passages du cycle",
    (lot) =>
      supabase
        .from("passages")
        .select(
          "id, contenu_id, compte_id, created_at, statut, publie_at, vues, bonus_repost, posts(est_test)",
        )
        .in("contenu_id", lot)
        .gte("created_at", debut),
  );

  const parContenu = new Map<string, PassageCycle[]>();
  for (const p of passages) {
    // Les reposts bonus « comptent pour du beurre » : hors cycle.
    if (p.bonus_repost) continue;
    if (estPassageDeTest(p.posts)) continue;
    const liste = parContenu.get(p.contenu_id) ?? [];
    liste.push(p);
    parContenu.set(p.contenu_id, liste);
  }

  const maintenant = Date.now();
  for (const c of actifs) {
    const tier = c.tier as Tier;
    const cible = Number(c.passages_cible ?? 0);
    const debutCycle = Date.parse(c.tier_maj_at as string);
    const cycle = (parContenu.get(c.id as string) ?? []).filter(
      (p) => Date.parse(p.created_at) >= debutCycle,
    );
    const mesures = cycle.filter((p) => passageMesure(p, maintenant));

    const cycleFait = cycle.length >= cible && mesures.length === cycle.length;
    const expire = maintenant - debutCycle >= CYCLE_TIMEOUT_JOURS * 86_400_000;
    if (!cycleFait && !expire) continue;

    const m = mesures.length > 0
      ? mesures.reduce((s, p) => s + Number(p.vues ?? 0), 0) / mesures.length
      : null;

    // Timeout sans aucune mesure : on rouvre le cycle, tier inchangé.
    const apres = m == null ? tier : requalifier(tier, m);
    const nouveauCible = passagesPourTier(apres);

    if (!opts.dryRun) {
      const { error: errMaj } = await supabase
        .from("contenus")
        .update({
          tier: apres,
          passages_cible: nouveauCible,
          tier_maj_at: new Date().toISOString(),
        })
        .eq("id", c.id);
      if (errMaj) throw errMaj;
    }

    if (m == null) out.cyclesVides += 1;
    if (apres === tier) out.inchanges += 1;
    else if (passagesPourTier(apres) > passagesPourTier(tier)) out.montees += 1;
    else out.descentes += 1;
    out.requalifies += 1;
    out.details.push({
      contenuId: c.id as string,
      titre: (c.titre as string | null) ?? null,
      avant: tier,
      apres,
      m,
      passagesMesures: mesures.length,
      passagesCible: cible,
      nouveauCible,
      timeout: !cycleFait,
    });
  }

  out.details.sort((a, b) => (b.m ?? -1) - (a.m ?? -1));
  return out;
}

/**
 * Planifie un repost J+7 pour chaque passage qui vient de dépasser 50 000 vues.
 * Un carton sur un repost bonus réenchaîne (une ligne par passage source).
 */
export async function planifierRepostsBonus(
  supabase: Supabase,
  passages: Array<{
    id: string;
    contenu_id: string;
    compte_id: string;
    langue: string;
    publie_at: string | null;
    vues: number | null;
  }>,
  opts: { dryRun?: boolean } = {},
): Promise<{ planifies: number; details: Array<{ passageId: string; jour: string; vues: number }> }> {
  const cartons = passages.filter((p) => (p.vues ?? 0) >= VUES_REPOST_BONUS);
  const details: Array<{ passageId: string; jour: string; vues: number }> = [];
  if (cartons.length === 0) return { planifies: 0, details };

  const { data: dejaLa } = await supabase
    .from("reposts_bonus")
    .select("passage_source_id")
    .in("passage_source_id", cartons.map((p) => p.id));
  const connus = new Set((dejaLa ?? []).map((r) => r.passage_source_id as string));

  const auj = aujourdhuiParis();
  const lignes = cartons
    .filter((p) => !connus.has(p.id))
    .map((p) => {
      const jour = jourRepostBonus(p.publie_at, auj);
      details.push({ passageId: p.id, jour, vues: p.vues ?? 0 });
      return {
        passage_source_id: p.id,
        contenu_id: p.contenu_id,
        compte_id: p.compte_id,
        langue: p.langue,
        vues_declencheur: p.vues,
        jour_prevu: jour,
        statut: "prevu",
      };
    });
  if (lignes.length === 0) return { planifies: 0, details };

  if (!opts.dryRun) {
    const { error } = await supabase
      .from("reposts_bonus")
      .upsert(lignes, { onConflict: "passage_source_id", ignoreDuplicates: true });
    if (error) throw error;
  }
  return { planifies: lignes.length, details };
}

/**
 * Reposts bonus dont le jour est passé sans assignation : abandonnés.
 * (Compte devenu inactif, en warmup, ou quota déjà plein ce jour-là.)
 */
export async function abandonnerRepostsEnRetard(
  supabase: Supabase,
  jour = aujourdhuiParis(),
): Promise<number> {
  const { data, error } = await supabase
    .from("reposts_bonus")
    .update({ statut: "abandonne", raison: "Jour J+7 passé sans créneau sur le compte" })
    .eq("statut", "prevu")
    .lt("jour_prevu", jour)
    .select("id");
  if (error) throw error;
  return (data ?? []).length;
}
