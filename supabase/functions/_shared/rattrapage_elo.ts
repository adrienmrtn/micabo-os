/**
 * Rattrapage sur une fenêtre courte (défaut 4 jours Paris).
 *
 * 1) Relève stats TikTok des passages publiés (publie_url) — vues/likes…
 * 2) Reposts bonus : tout passage > 50 000 vues est replanifié à J+7 sur le
 *    même compte.
 * 3) En fin de file : requalification tierlist des slideshows dont le cycle est
 *    terminé (`_shared/requalification.ts`), qualification des comptes
 *    (INACTIF → STAR, `_shared/qualification.ts`) et snapshot des vues
 *    globales. C'est le seul moment où toutes les vues du jour sont rentrées —
 *    juger les créateurs au cron de minuit les noterait sur la veille.
 *
 * Les slideshows n'ont plus d'ELO par langue : leur tier ne bouge qu'à la
 * requalification, sur la moyenne des vues d'un cycle complet.
 *
 * Renvoie aussi `logs` (trace) + `brief` (résumé UI).
 */
import { scrapePost, scrapeStats, type ScrapedPost } from "./apify.ts";
import {
  abandonnerRepostsEnRetard,
  planifierRepostsBonus,
  requalifierContenus,
  type RequalificationDetail,
  type RequalificationResultat,
} from "./requalification.ts";
import { type Supabase } from "./scoring.ts";
import { aujourdhuiParis } from "./supabase.ts";
import { qualifierComptes, type QualificationResultat } from "./qualification_comptes.ts";

export const RATTRAPAGE_JOURS_DEFAUT = 4;
/** Profil TikTok scrapé — garder bas pour rester sous le timeout Edge 150s / compte. */
const POSTS_RELEVES = 12;
/** Fenêtre (±h) pour matcher le « dernier post » profil vs date attendue. */
const COHERENCE_HEURES = 36;
/** Max d’entrées détaillées dans le brief (UI). */
const BRIEF_TOP = 12;

export type LogLevel = "info" | "ok" | "warn" | "error";

export interface RattrapageLog {
  at: string;
  level: LogLevel;
  message: string;
  detail?: string;
}

export interface RattrapageOpts {
  compteId?: string | null;
  /** Nombre de jours Paris inclus (aujourd'hui inclus). Défaut 4. */
  jours?: number;
  dryRun?: boolean;
}

export interface RattrapageBrief {
  resume: string;
  fenetre: string;
  passages: number;
  stats: {
    comptes: number;
    releves: number;
    sansMatch: number;
    fallbackUrl: number;
    fallbackCoherence: number;
    erreurs: number;
  };
  requalif: {
    examines: number;
    requalifies: number;
    montees: number;
    descentes: number;
    top: RequalificationDetail[];
  };
  repostsBonus: number;
}

export interface RattrapageResultat {
  fenetre: { debut: string; fin: string; jours: number };
  stats: {
    comptes: number;
    releves: number;
    fallbackUrl: number;
    fallbackCoherence: number;
    sansMatch: number;
    erreurs: Array<{ compteId: string; handle?: string | null; erreur: string }>;
  };
  requalif: RequalificationResultat;
  repostsBonus: { planifies: number; details: Array<{ passageId: string; jour: string; vues: number }> };
  brief: RattrapageBrief;
  logs: RattrapageLog[];
  dryRun: boolean;
}

class Journal {
  readonly lines: RattrapageLog[] = [];
  push(level: LogLevel, message: string, detail?: string) {
    const at = new Date().toISOString();
    this.lines.push({ at, level, message, detail });
    const prefix = level === "error" ? "ERR" : level === "warn" ? "WRN" : level === "ok" ? "OK" : "INF";
    console.log(`[rattrapage-elo] ${prefix} ${message}${detail ? ` — ${detail}` : ""}`);
  }
}

function ajouterJoursParis(yyyyMmDd: string, delta: number): string {
  // Midi UTC évite les bascules DST autour de minuit.
  const d = new Date(`${yyyyMmDd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(d);
}

function joursFenetreParis(jours: number): { debut: string; fin: string; dates: string[] } {
  const fin = aujourdhuiParis();
  const dates: string[] = [];
  for (let i = jours - 1; i >= 0; i--) {
    dates.push(ajouterJoursParis(fin, -i));
  }
  return { debut: dates[0]!, fin, dates };
}

/** Compte en process = warmup terminé (ends_at ≤ now). Hors process → pas jugé. */
function compteEnProcessus(c: {
  warmup_started_at?: string | null;
  warmup_ends_at?: string | null;
}): boolean {
  if (!c.warmup_started_at || !c.warmup_ends_at) return false;
  return new Date(c.warmup_ends_at).getTime() <= Date.now();
}


function idDuLien(url: string): string {
  return url.match(/\/(?:photo|video)\/(\d+)/)?.[1] ?? url;
}

async function resoudreLien(url: string): Promise<string> {
  if (!/\/\/(?:vm|vt)\.tiktok\.com/i.test(url)) return url;
  try {
    const res = await fetch(url, {
      redirect: "follow",
      headers: {
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36",
      },
    });
    return res.url || url;
  } catch {
    return url;
  }
}

function tokensTexte(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((t) => t.length >= 3),
  );
}

/** Similarité Jaccard simple sur tokens ≥3 car. */
function similariteTexte(a: string, b: string): number {
  const A = tokensTexte(a);
  const B = tokensTexte(b);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter += 1;
  return inter / (A.size + B.size - inter);
}

function texteAttenduSlides(slides: unknown): string {
  if (!Array.isArray(slides)) return "";
  return slides
    .map((s) => {
      if (!s || typeof s !== "object") return "";
      const o = s as Record<string, unknown>;
      return String(o.texte_overlay ?? o.texte ?? "");
    })
    .filter(Boolean)
    .join(" ");
}

type PassageFenetre = {
  id: string;
  contenu_id: string;
  compte_id: string;
  langue: string;
  publie_url: string | null;
  publie_at: string | null;
  date_publication_prevue: string | null;
  vues: number | null;
  likes: number | null;
  commentaires: number | null;
  partages: number | null;
  slides: unknown;
  /** Stats relues dans ce run → ELO langue doit suivre même si déjà maj. */
};

async function chargerPassagesFenetre(
  supabase: Supabase,
  dates: string[],
  compteId: string | null,
): Promise<PassageFenetre[]> {
  let q = supabase
    .from("passages")
    .select(
      "id, contenu_id, compte_id, langue, publie_url, publie_at, date_publication_prevue, vues, likes, commentaires, partages, slides",
    )
    .eq("statut", "publie")
    .in("date_publication_prevue", dates)
    .not("publie_url", "is", null);

  if (compteId) q = q.eq("compte_id", compteId);

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as PassageFenetre[];
}

async function ecrireStats(
  supabase: Supabase,
  passageId: string,
  stats: ScrapedPost["stats"],
  dryRun: boolean,
): Promise<void> {
  if (dryRun) return;
  await supabase
    .from("passages")
    .update({
      vues: stats.vues,
      likes: stats.likes,
      commentaires: stats.commentaires,
      partages: stats.partages,
      stats_maj_at: new Date().toISOString(),
    })
    .eq("id", passageId);
}

/**
 * Relève les stats pour les passages de la fenêtre.
 * Ordre : match URL dans scrape profil → scrapePost(url) → dernier post
 * profil cohérent (date ±36h + texte).
 */
async function releverStatsFenetre(
  supabase: Supabase,
  passages: PassageFenetre[],
  dryRun: boolean,
  handles: Map<string, string | null>,
  journal: Journal,
): Promise<RattrapageResultat["stats"]> {
  const out: RattrapageResultat["stats"] = {
    comptes: 0,
    releves: 0,
    fallbackUrl: 0,
    fallbackCoherence: 0,
    sansMatch: 0,
    erreurs: [],
  };

  const parCompte = new Map<string, PassageFenetre[]>();
  for (const p of passages) {
    const list = parCompte.get(p.compte_id) ?? [];
    list.push(p);
    parCompte.set(p.compte_id, list);
  }

  const compteIds = [...parCompte.keys()];
  if (compteIds.length === 0) {
    journal.push("warn", "Aucun passage publié avec publie_url dans la fenêtre");
    return out;
  }

  const { data: comptes, error } = await supabase
    .from("comptes")
    .select("id, handle_tiktok")
    .in("id", compteIds)
    .not("handle_tiktok", "is", null);
  if (error) throw error;

  for (const c of comptes ?? []) {
    handles.set(c.id as string, (c.handle_tiktok as string) ?? null);
  }

  out.comptes = (comptes ?? []).length;
  journal.push(
    "info",
    `Stats — ${out.comptes} compte(s), ${passages.length} passage(s)`,
  );

  for (const compte of comptes ?? []) {
    const handle = compte.handle_tiktok as string;
    const liste = parCompte.get(compte.id) ?? [];
    let relevesCompte = 0;
    let sansMatchCompte = 0;
    try {
      journal.push("info", `@${handle} — scrape profil (${liste.length} passage(s))`);
      const enLigne = await scrapeStats(handle, POSTS_RELEVES);
      const parId = new Map(enLigne.map((p) => [idDuLien(p.webVideoUrl), p]));
      journal.push("info", `@${handle} — ${enLigne.length} post(s) TikTok scrapés`);

      // Total profil → compte_metrics (alimente le snapshot Pilotage j0−j1).
      if (!dryRun && enLigne.length > 0) {
        const somme = (f: (s: ScrapedPost["stats"]) => number) =>
          enLigne.reduce((n, p) => n + (f(p.stats) || 0), 0);
        await supabase.from("compte_metrics").insert({
          compte_id: compte.id,
          vues: somme((s) => s.vues),
          likes: somme((s) => s.likes),
          commentaires: somme((s) => s.commentaires),
          partages: somme((s) => s.partages),
          nb_posts: enLigne.length,
        });
      }

      for (const passage of liste) {
        if (!passage.publie_url) continue;
        const complet = await resoudreLien(passage.publie_url);
        let match = parId.get(idDuLien(complet)) ?? null;
        let via: "url" | "fallbackUrl" | "coherence" | null = match ? "url" : null;

        if (!match) {
          try {
            const seuls = await scrapePost(passage.publie_url);
            if (seuls[0]?.stats) {
              match = seuls[0];
              via = "fallbackUrl";
            }
          } catch (e) {
            journal.push(
              "warn",
              `@${handle} — scrapePost échoué`,
              e instanceof Error ? e.message : String(e),
            );
          }
        }

        if (!match) {
          const ancreMs = passage.publie_at
            ? Date.parse(passage.publie_at)
            : passage.date_publication_prevue
              ? Date.parse(`${passage.date_publication_prevue}T12:00:00Z`)
              : NaN;
          const attendu = texteAttenduSlides(passage.slides);
          let best: { post: ScrapedPost; score: number } | null = null;
          for (const post of enLigne) {
            if (post.createTime == null || !Number.isFinite(ancreMs)) continue;
            const postMs = post.createTime * 1000;
            if (Math.abs(postMs - ancreMs) > COHERENCE_HEURES * 3600_000) continue;
            const sim = similariteTexte(attendu, post.text);
            const score = attendu.trim() ? sim : 0.5;
            if (attendu.trim() && sim < 0.15) continue;
            if (!best || score > best.score) best = { post, score };
          }
          if (best) {
            match = best.post;
            via = "coherence";
          }
        }

        if (!match) {
          sansMatchCompte += 1;
          out.sansMatch += 1;
          journal.push(
            "warn",
            `@${handle} — pas de match stats`,
            `${passage.date_publication_prevue ?? "?"} · ${passage.id.slice(0, 8)}`,
          );
          continue;
        }

        await ecrireStats(supabase, passage.id, match.stats, dryRun);
        passage.vues = match.stats.vues;
        passage.likes = match.stats.likes;
        passage.commentaires = match.stats.commentaires;
        passage.partages = match.stats.partages;
        out.releves += 1;
        relevesCompte += 1;
        if (via === "fallbackUrl") out.fallbackUrl += 1;
        if (via === "coherence") out.fallbackCoherence += 1;
        journal.push(
          "ok",
          `@${handle} · ${passage.date_publication_prevue ?? "?"} → ${match.stats.vues} vues`,
          via === "url" ? "match URL" : via === "fallbackUrl" ? "fallback scrapePost" : "fallback cohérence",
        );
      }

      journal.push(
        relevesCompte > 0 ? "ok" : "warn",
        `@${handle} — ${relevesCompte}/${liste.length} relevé(s)` +
          (sansMatchCompte ? `, ${sansMatchCompte} sans match` : ""),
      );
    } catch (e) {
      const erreur = e instanceof Error ? e.message : String(e);
      out.erreurs.push({ compteId: compte.id, handle, erreur });
      journal.push("error", `@${handle} — erreur scrape`, erreur);
    }
  }

  return out;
}

function construireBrief(
  fenetre: { debut: string; fin: string; jours: number },
  passages: number,
  stats: RattrapageResultat["stats"],
  requalif: RequalificationResultat,
  repostsBonus: number,
  dryRun: boolean,
): RattrapageBrief {
  const topRequalif = [...requalif.details]
    .sort((a, b) => (b.m ?? -1) - (a.m ?? -1))
    .slice(0, BRIEF_TOP);

  const resume =
    `${dryRun ? "[dry-run] " : ""}` +
    `${fenetre.debut}→${fenetre.fin} · ${stats.releves} stats · ` +
    `${requalif.requalifies} requalif (${requalif.montees}↑ ${requalif.descentes}↓)` +
    (repostsBonus ? ` · ${repostsBonus} repost(s) J+7` : "") +
    (stats.sansMatch ? ` · ${stats.sansMatch} sans match` : "") +
    (stats.erreurs.length ? ` · ${stats.erreurs.length} erreur(s)` : "");

  return {
    resume,
    fenetre: `${fenetre.debut} → ${fenetre.fin} (${fenetre.jours}j)`,
    passages,
    stats: {
      comptes: stats.comptes,
      releves: stats.releves,
      sansMatch: stats.sansMatch,
      fallbackUrl: stats.fallbackUrl,
      fallbackCoherence: stats.fallbackCoherence,
      erreurs: stats.erreurs.length,
    },
    requalif: {
      examines: requalif.examines,
      requalifies: requalif.requalifies,
      montees: requalif.montees,
      descentes: requalif.descentes,
      top: topRequalif,
    },
    repostsBonus,
  };
}

/** Trace lisible de la requalification dans le journal du run. */
function journalRequalif(journal: Journal, r: RequalificationResultat): void {
  journal.push(
    "info",
    `Requalification — ${r.examines} cycle(s) ouvert(s), ${r.requalifies} requalifié(s)`,
    `${r.montees}↑ ${r.descentes}↓ ${r.inchanges}=` +
      (r.cyclesVides ? ` · ${r.cyclesVides} cycle(s) sans mesure` : ""),
  );
  for (const d of r.details.slice(0, BRIEF_TOP)) {
    const fleche = d.avant === d.apres ? "=" : `${d.avant} → ${d.apres}`;
    journal.push(
      d.apres === d.avant ? "info" : "ok",
      `Tier ${fleche} · ${(d.titre ?? d.contenuId).slice(0, 40)}`,
      `m=${d.m == null ? "—" : Math.round(d.m)} vues sur ${d.passagesMesures}/${d.passagesCible}` +
        ` passage(s)${d.timeout ? " · timeout 14 j" : ""} → ${d.nouveauCible} passage(s) à faire`,
    );
  }
}

/** Résultat de requalification vide (runs qui ne la déclenchent pas). */
function requalifVide(): RequalificationResultat {
  return {
    examines: 0,
    requalifies: 0,
    montees: 0,
    descentes: 0,
    inchanges: 0,
    cyclesVides: 0,
    details: [],
  };
}

/**
 * Figé le total des vues (dernier compte_metrics par compte actif) pour le
 * jour Paris courant. vues_delta = total − total du dernier snapshot antérieur
 * (pas seulement la veille calendaire : un jour manqué ne casse plus la courbe).
 */
function veilleParisDe(jour: string): string {
  const d = new Date(`${jour}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(d);
}

export async function snapshotVuesGlobales(
  supabase: Supabase,
  journal?: Journal,
  jourForce?: string,
): Promise<{ jour: string; vues_totales: number; vues_delta: number | null; nb_comptes: number }> {
  const jour = jourForce ?? aujourdhuiParis();

  // Auto-répare la veille si absente (sinon Δ reste null et Pilotage paraît vide).
  if (!jourForce) {
    const veille = veilleParisDe(jour);
    const { data: veilleRow } = await supabase
      .from("vues_globales_jour")
      .select("jour")
      .eq("jour", veille)
      .maybeSingle();
    if (!veilleRow) {
      try {
        journal?.push("info", `Veille ${veille} absente — backfill depuis compte_metrics`);
        await backfillSnapshotVuesJour(supabase, veille, journal);
      } catch (e) {
        journal?.push(
          "warn",
          `Backfill veille ${veille} échoué`,
          e instanceof Error ? e.message : String(e),
        );
      }
    }
  }

  const { data: comptes, error } = await supabase
    .from("comptes")
    .select("id")
    .eq("is_active", true);
  if (error) throw error;

  let vuesTotales = 0;
  let nb = 0;
  for (const c of comptes ?? []) {
    const { data: m } = await supabase
      .from("compte_metrics")
      .select("vues")
      .eq("compte_id", c.id)
      .order("collecte_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (m?.vues != null) {
      vuesTotales += Number(m.vues);
      nb += 1;
    }
  }

  // Dernier snapshot strictement avant ce jour (tolère un trou calendaire).
  const { data: prev } = await supabase
    .from("vues_globales_jour")
    .select("vues_totales, jour")
    .lt("jour", jour)
    .order("jour", { ascending: false })
    .limit(1)
    .maybeSingle();

  const vuesDelta = prev?.vues_totales != null
    ? vuesTotales - Number(prev.vues_totales)
    : null;

  const { error: errUp } = await supabase.from("vues_globales_jour").upsert(
    {
      jour,
      vues_totales: vuesTotales,
      vues_delta: vuesDelta,
      nb_comptes: nb,
    },
    { onConflict: "jour" },
  );
  if (errUp) throw errUp;

  journal?.push(
    "ok",
    `Snapshot vues ${jour}`,
    `total ${vuesTotales} · Δ ${vuesDelta ?? "n/a"}` +
      (prev?.jour ? ` (vs ${prev.jour})` : " (premier)") +
      ` · ${nb} compte(s)`,
  );

  return { jour, vues_totales: vuesTotales, vues_delta: vuesDelta, nb_comptes: nb };
}

/**
 * Reconstruit un snapshot pour un jour Paris passé à partir des
 * `compte_metrics` connus à la fin de ce jour (Europe/Paris).
 * Sert de patch quand un run minuit / ELO a sauté un jour.
 */
export async function backfillSnapshotVuesJour(
  supabase: Supabase,
  jour: string,
  journal?: Journal,
): Promise<{ jour: string; vues_totales: number; vues_delta: number | null; nb_comptes: number }> {
  const borne = parisDebutJourSuivantIso(jour);

  const { data: comptes, error } = await supabase
    .from("comptes")
    .select("id")
    .eq("is_active", true);
  if (error) throw error;

  let vuesTotales = 0;
  let nb = 0;
  for (const c of comptes ?? []) {
    const { data: m } = await supabase
      .from("compte_metrics")
      .select("vues")
      .eq("compte_id", c.id)
      .lt("collecte_at", borne)
      .order("collecte_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (m?.vues != null) {
      vuesTotales += Number(m.vues);
      nb += 1;
    }
  }

  const { data: prev } = await supabase
    .from("vues_globales_jour")
    .select("vues_totales, jour")
    .lt("jour", jour)
    .order("jour", { ascending: false })
    .limit(1)
    .maybeSingle();

  const vuesDelta = prev?.vues_totales != null
    ? vuesTotales - Number(prev.vues_totales)
    : null;

  const { error: errUp } = await supabase.from("vues_globales_jour").upsert(
    {
      jour,
      vues_totales: vuesTotales,
      vues_delta: vuesDelta,
      nb_comptes: nb,
    },
    { onConflict: "jour" },
  );
  if (errUp) throw errUp;

  journal?.push(
    "ok",
    `Backfill snapshot ${jour}`,
    `total ${vuesTotales} · Δ ${vuesDelta ?? "n/a"} · ${nb} compte(s)`,
  );

  // Recalcule le Δ du snapshot suivant s'il existe (ex. après patch d'hier).
  const { data: suivant } = await supabase
    .from("vues_globales_jour")
    .select("jour, vues_totales")
    .gt("jour", jour)
    .order("jour", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (suivant) {
    const deltaSuiv = Number(suivant.vues_totales) - vuesTotales;
    await supabase
      .from("vues_globales_jour")
      .update({ vues_delta: deltaSuiv })
      .eq("jour", suivant.jour);
    journal?.push("ok", `Δ recalculé ${suivant.jour}`, String(deltaSuiv));
  }

  return { jour, vues_totales: vuesTotales, vues_delta: vuesDelta, nb_comptes: nb };
}

/** Instant UTC exclusif = début du jour calendaire Paris suivant. */
function parisDebutJourSuivantIso(jourParis: string): string {
  const d = new Date(`${jourParis}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  const next = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(d);
  const probe = new Date(`${next}T12:00:00Z`);
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Paris",
    timeZoneName: "shortOffset",
    hour12: false,
  });
  const parts = fmt.formatToParts(probe);
  const tz = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT+2";
  const m = /GMT([+-]\d{1,2})(?::?(\d{2}))?/.exec(tz);
  const oh = m ? Number(m[1]) : 2;
  const om = m?.[2] ? Number(m[2]) : 0;
  const sign = oh >= 0 ? "+" : "-";
  const offset = `${sign}${String(Math.abs(oh)).padStart(2, "0")}:${String(om).padStart(2, "0")}`;
  return new Date(`${next}T00:00:00${offset}`).toISOString();
}

export async function rattrapageElo(
  supabase: Supabase,
  opts: RattrapageOpts & { snapshot?: boolean } = {},
): Promise<RattrapageResultat & { snapshot?: Awaited<ReturnType<typeof snapshotVuesGlobales>> }> {
  const journal = new Journal();

  // Mode snapshot seul (fin de run live / cron).
  if (opts.snapshot && !opts.compteId) {
    const snap = await snapshotVuesGlobales(supabase, journal);
    const { debut, fin, dates } = joursFenetreParis(RATTRAPAGE_JOURS_DEFAUT);
    return {
      fenetre: { debut, fin, jours: dates.length },
      stats: {
        comptes: 0,
        releves: 0,
        fallbackUrl: 0,
        fallbackCoherence: 0,
        sansMatch: 0,
        erreurs: [],
      },
      requalif: requalifVide(),
      repostsBonus: { planifies: 0, details: [] },
      brief: construireBrief(
        { debut, fin, jours: dates.length },
        0,
        {
          comptes: 0,
          releves: 0,
          fallbackUrl: 0,
          fallbackCoherence: 0,
          sansMatch: 0,
          erreurs: [],
        },
        requalifVide(),
        0,
        { maj: 0, details: [] },
        false,
      ),
      logs: journal.lines,
      dryRun: false,
      snapshot: snap,
    };
  }

  const jours = Math.max(1, Math.min(14, opts.jours ?? RATTRAPAGE_JOURS_DEFAUT));
  const dryRun = Boolean(opts.dryRun);
  const { debut, fin, dates } = joursFenetreParis(jours);
  const handles = new Map<string, string | null>();

  journal.push(
    "info",
    `Démarrage rattrapage${dryRun ? " (dry-run)" : ""}`,
    `fenêtre ${debut} → ${fin} (${jours}j)` +
      (opts.compteId ? ` · compte ${opts.compteId.slice(0, 8)}` : " · tous comptes"),
  );

  const passages = await chargerPassagesFenetre(supabase, dates, opts.compteId ?? null);
  journal.push("info", `${passages.length} passage(s) publiés avec lien dans la fenêtre`);

  // Compte isolé sans passage dans la fenêtre : scraper quand même pour les metrics.
  if (opts.compteId && passages.length === 0) {
    const { data: c } = await supabase
      .from("comptes")
      .select("id, handle_tiktok")
      .eq("id", opts.compteId)
      .maybeSingle();
    if (c?.handle_tiktok && !dryRun) {
      try {
        const enLigne = await scrapeStats(c.handle_tiktok as string, POSTS_RELEVES);
        const somme = (f: (s: ScrapedPost["stats"]) => number) =>
          enLigne.reduce((n, p) => n + (f(p.stats) || 0), 0);
        await supabase.from("compte_metrics").insert({
          compte_id: c.id,
          vues: somme((s) => s.vues),
          likes: somme((s) => s.likes),
          commentaires: somme((s) => s.commentaires),
          partages: somme((s) => s.partages),
          nb_posts: enLigne.length,
        });
        journal.push("ok", `@${c.handle_tiktok} — metrics profil (${enLigne.length} posts)`);
      } catch (e) {
        journal.push(
          "error",
          `@${c.handle_tiktok} — scrape metrics`,
          e instanceof Error ? e.message : String(e),
        );
      }
    }
  }

  // Warmup : rien à relever pour ce compte isolé.
  if (opts.compteId) {
    const { data: cWarm } = await supabase
      .from("comptes")
      .select("id, handle_tiktok, warmup_started_at, warmup_ends_at")
      .eq("id", opts.compteId)
      .maybeSingle();
    if (
      cWarm &&
      !compteEnProcessus({
        warmup_started_at: cWarm.warmup_started_at as string | null,
        warmup_ends_at: cWarm.warmup_ends_at as string | null,
      })
    ) {
      const h = (cWarm.handle_tiktok as string | null) ?? opts.compteId.slice(0, 8);
      journal.push("info", `Skip warmup — ELO inchangé`, h.startsWith("@") ? h : `@${h}`);
      const vide = {
        comptes: 0,
        releves: 0,
        fallbackUrl: 0,
        fallbackCoherence: 0,
        sansMatch: 0,
        erreurs: [] as RattrapageResultat["stats"]["erreurs"],
      };
      const brief = construireBrief(
        { debut, fin, jours },
        0,
        vide,
        requalifVide(),
        0,
        dryRun,
      );
      journal.push("ok", "Terminé (warmup)", brief.resume);
      return {
        fenetre: { debut, fin, jours },
        stats: vide,
        requalif: requalifVide(),
        repostsBonus: { planifies: 0, details: [] },
        brief,
        logs: journal.lines,
        dryRun,
      };
    }
  }

  const stats = await releverStatsFenetre(supabase, passages, dryRun, handles, journal);

  // Carton (> 50 000 vues) → le même post repart sur le même compte à J+7.
  const repostsBonus = await planifierRepostsBonus(
    supabase,
    passages.map((p) => ({
      id: p.id,
      contenu_id: p.contenu_id,
      compte_id: p.compte_id,
      langue: p.langue,
      publie_at: p.publie_at,
      vues: p.vues,
    })),
    { dryRun },
  );
  for (const r of repostsBonus.details) {
    journal.push("ok", `Repost bonus planifié le ${r.jour}`, `${r.vues} vues`);
  }

  // Requalification tierlist + snapshot : uniquement sur un run « tous comptes »
  // (un run compte isolé ne voit qu'une partie des passages d'un cycle).
  let requalif = requalifVide();
  let snapshot: Awaited<ReturnType<typeof snapshotVuesGlobales>> | undefined;
  if (!opts.compteId) {
    requalif = await requalifierContenus(supabase, { dryRun });
    journalRequalif(journal, requalif);
    if (!dryRun) {
      const abandons = await abandonnerRepostsEnRetard(supabase);
      if (abandons > 0) {
        journal.push("warn", `${abandons} repost(s) bonus abandonné(s) (J+7 dépassé)`);
      }
      snapshot = await snapshotVuesGlobales(supabase, journal);
    }
  }

  const brief = construireBrief(
    { debut, fin, jours },
    passages.length,
    stats,
    requalif,
    repostsBonus.planifies,
    dryRun,
  );
  journal.push("ok", "Terminé", brief.resume);


  return {
    fenetre: { debut, fin, jours },
    stats,
    requalif,
    repostsBonus,
    logs: journal.lines,
    dryRun,
    snapshot,
  };
}

/**
 * Comptes / lot Edge.
 * 1 seul : scrape Apify + éventuels scrapePost doivent tenir sous idle 150s.
 * Le cron `rattrapage-elo-drain` (* * * * *) reprend si la chaîne meurt.
 */
const DRAIN_BATCH_ELO = 1;
/** Auto-kick waitUntil (filet = cron minute, pas cette limite). */
const DRAIN_MAX_CHAIN_ELO = 200;
/** Si busy=true et heartbeat plus vieux → considérer le worker mort, reprendre. */
const DRAIN_BUSY_STALE_MS = 4 * 60_000;
/** Évite deux workers sur le même offset (cron + kick) — juste sous idle Edge 150s. */
const DRAIN_BUSY_LOCK_MS = 140_000;

export type EloDernierRun = {
  at?: string;
  busy?: boolean;
  drain?: boolean;
  drainGen?: number;
  offset?: number;
  total?: number;
  traitesCumules?: number;
  restants?: number;
  done?: boolean;
  kick?: boolean;
  source?: string;
  jours?: number;
  comptesLot?: string[];
  erreurs?: Array<{ compteId: string; handle: string; erreur: string }>;
  snapshot?: unknown;
  idle?: boolean;
  detail?: string;
};

export async function lireEloDernierRunReglage(
  supabase: Supabase,
): Promise<EloDernierRun | null> {
  const { data } = await supabase
    .from("reglages")
    .select("valeur")
    .eq("cle", "elo_dernier_run")
    .maybeSingle();
  return (data?.valeur as EloDernierRun | null) ?? null;
}

export async function ecrireEloDernierRun(
  supabase: Supabase,
  valeur: EloDernierRun,
): Promise<void> {
  await supabase.from("reglages").upsert(
    {
      cle: "elo_dernier_run",
      valeur: { ...valeur, at: valeur.at ?? new Date().toISOString() },
      updated_at: new Date().toISOString(),
    },
    { onConflict: "cle" },
  );
}

/** true si un autre worker semble encore vivant sur ce drain. */
export function eloDrainEstVerrouille(run: EloDernierRun | null): boolean {
  if (!run?.busy || !run.at) return false;
  const age = Date.now() - new Date(run.at).getTime();
  return Number.isFinite(age) && age >= 0 && age < DRAIN_BUSY_LOCK_MS;
}

/** true si busy coincé (timeout Edge sans clear) → on peut reprendre. */
export function eloDrainBusyStale(run: EloDernierRun | null): boolean {
  if (!run?.busy || !run.at) return false;
  const age = Date.now() - new Date(run.at).getTime();
  return Number.isFinite(age) && age >= DRAIN_BUSY_STALE_MS;
}

/** Comptes actifs en process (warmup OK) avec @ TikTok, triés pour un curseur stable. */
export async function listerComptesRattrapageElo(
  supabase: Supabase,
): Promise<Array<{ id: string; handle_tiktok: string }>> {
  const { data, error } = await supabase
    .from("comptes")
    .select("id, handle_tiktok, warmup_started_at, warmup_ends_at")
    .eq("is_active", true)
    .not("handle_tiktok", "is", null)
    .order("id", { ascending: true });
  if (error) throw error;
  return (data ?? [])
    .filter((c) =>
      compteEnProcessus({
        warmup_started_at: c.warmup_started_at as string | null,
        warmup_ends_at: c.warmup_ends_at as string | null,
      }),
    )
    .map((c) => ({
      id: c.id as string,
      handle_tiktok: c.handle_tiktok as string,
    }));
}

/**
 * Un lot de comptes (stats + ELO langue/compte). En fin de file → snapshot vues.
 * Auto-chaîné via `kickRattrapageElo` + cron minute `rattrapage-elo-drain`.
 */
export async function rattrapageEloDrainLot(
  supabase: Supabase,
  opts: {
    offset?: number;
    jours?: number;
    dryRun?: boolean;
  } = {},
): Promise<{
  traites: number;
  restants: number;
  nextOffset: number;
  total: number;
  comptes: string[];
  erreurs: Array<{ compteId: string; handle: string; erreur: string }>;
  snapshot?: Awaited<ReturnType<typeof snapshotVuesGlobales>>;
  requalif?: RequalificationResultat;
  qualif?: QualificationResultat;
}> {
  const offset = Math.max(0, Math.floor(opts.offset ?? 0));
  const tous = await listerComptesRattrapageElo(supabase);
  const lot = tous.slice(offset, offset + DRAIN_BATCH_ELO);
  const erreurs: Array<{ compteId: string; handle: string; erreur: string }> = [];

  for (const c of lot) {
    try {
      await rattrapageElo(supabase, {
        compteId: c.id,
        jours: opts.jours,
        dryRun: opts.dryRun,
      });
    } catch (e) {
      erreurs.push({
        compteId: c.id,
        handle: c.handle_tiktok,
        erreur: e instanceof Error ? e.message : String(e),
      });
    }
  }

  const nextOffset = offset + lot.length;
  const restants = Math.max(0, tous.length - nextOffset);
  let snapshot: Awaited<ReturnType<typeof snapshotVuesGlobales>> | undefined;
  // Snapshot Pilotage : fin de file, ou tous les 10 comptes (pas attendre la fin).
  const doitSnapshot =
    !opts.dryRun && (restants === 0 || (nextOffset > 0 && nextOffset % 10 === 0));
  if (doitSnapshot) {
    try {
      snapshot = await snapshotVuesGlobales(supabase);
    } catch (e) {
      console.error("[rattrapage-elo] snapshotVuesGlobales", e);
    }
  }

  // Fin de file : tous les comptes ont livré leurs vues du jour, on peut
  // requalifier les cycles terminés (et solder les reposts bonus en retard).
  let requalif: RequalificationResultat | undefined;
  let qualif: QualificationResultat | undefined;
  if (restants === 0 && !opts.dryRun) {
    try {
      requalif = await requalifierContenus(supabase);
      console.log(
        `[rattrapage-elo] requalification ${requalif.requalifies}/${requalif.examines}` +
          ` (${requalif.montees}↑ ${requalif.descentes}↓)`,
      );
      await abandonnerRepostsEnRetard(supabase);
    } catch (e) {
      console.error("[rattrapage-elo] requalifierContenus", e);
    }

    // Les comptes se requalifient ICI, et pas au cron de minuit : c'est le seul
    // moment où toutes les vues du jour sont rentrées. À minuit, on noterait
    // chaque créateur sur les vues de la veille.
    try {
      qualif = await qualifierComptes(supabase);
      console.log(
        `[rattrapage-elo] qualification ${qualif.changes}/${qualif.examines}` +
          (qualif.verrouilles ? ` (${qualif.verrouilles} manuelle(s))` : ""),
      );
    } catch (e) {
      console.error("[rattrapage-elo] qualifierComptes", e);
    }
  }

  return {
    traites: lot.length,
    restants,
    nextOffset,
    total: tous.length,
    comptes: lot.map((c) => c.handle_tiktok),
    erreurs,
    snapshot,
    requalif,
    qualif,
  };
}

/**
 * Kick fire-and-forget du drain rattrapage ELO (1 compte + auto-chaîne).
 * Filet de secours : cron pg `rattrapage-elo-drain` chaque minute.
 */
export function kickRattrapageElo(
  request: Request,
  body: Record<string, unknown> = {},
): void {
  const url = Deno.env.get("SUPABASE_URL");
  if (!url) {
    console.error("[rattrapage-elo] kick: SUPABASE_URL manquant");
    return;
  }
  const secret = Deno.env.get("CRON_SECRET");
  const auth = request.headers.get("Authorization");
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (secret) headers["x-cron-secret"] = secret;
  else if (auth) headers.Authorization = auth;
  else {
    console.error("[rattrapage-elo] kick: ni CRON_SECRET ni Authorization");
    return;
  }

  const target = `${url}/functions/v1/rattrapage-elo`;
  const edge = (globalThis as {
    EdgeRuntime?: { waitUntil: (p: Promise<unknown>) => void };
  }).EdgeRuntime;

  const payload = {
    jours: RATTRAPAGE_JOURS_DEFAUT,
    drainGen: 0,
    offset: 0,
    ...body,
    drain: true, // toujours en drain (lots) — le full sync timeout à 150s
  };

  console.log(
    `[rattrapage-elo] kick drain gen=${Number(payload.drainGen) || 0} offset=${Number(payload.offset) || 0}`,
  );

  const p = fetch(target, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  })
    .then(async (res) => {
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        console.error(`[rattrapage-elo] kick HTTP ${res.status}`, t.slice(0, 200));
      }
    })
    .catch((e) => {
      console.error("[rattrapage-elo] kick failed", e);
      return null;
    });
  if (edge?.waitUntil) edge.waitUntil(p);
  else {
    // Sans waitUntil le fetch peut être coupé à la fin de la réponse parente.
    console.warn("[rattrapage-elo] EdgeRuntime.waitUntil absent — kick best-effort");
  }
}

export { DRAIN_BATCH_ELO, DRAIN_MAX_CHAIN_ELO };
