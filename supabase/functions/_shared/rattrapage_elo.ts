/**
 * Rattrapage sur une fenêtre courte (défaut 4 jours Paris).
 *
 * 1) Relève les stats TikTok de chaque passage publié UNE fois, à J+2 : par son
 *    lien (un appel Apify par compte), par le profil seulement sans lien.
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
import { scrapeStats, type ScrapedPost } from "./apify.ts";
import { releverPostsParLien } from "./apify_releve.ts";
import {
  apparierParLien,
  estApifyEpuise,
  idPostTiktok,
  lienTiktok,
  passageARelever,
  profondeurScrape,
} from "./releve_file.ts";
import {
  abandonnerRepostsEnRetard,
  planifierRepostsBonus,
  requalifierContenus,
  type RequalificationDetail,
  type RequalificationResultat,
} from "./requalification.ts";
import { type Supabase } from "./scoring.ts";
import { aujourdhuiParis } from "./supabase.ts";
import { RATTRAPAGE_JOURS_DEFAUT } from "./tierlist.ts";
import { qualifierComptes, type QualificationResultat } from "./qualification_comptes.ts";

export { RATTRAPAGE_JOURS_DEFAUT } from "./tierlist.ts";

// Les règles du relevé — quels passages, quelle profondeur de scrape, quand
// abandonner — vivent dans `releve_file.ts`, module pur testé côté front.

/**
 * Profondeur maximale de la file « ce qui manque ». Au-delà, un passage n'a
 * plus d'intérêt statistique : le cycle qui l'attendait a été requalifié de
 * force depuis longtemps (CYCLE_TIMEOUT_JOURS = 14).
 */
const RATTRAPAGE_PROFONDEUR_JOURS = 30;

/**
 * Passages relevés par compte et par passe.
 *
 * La file « ce qui manque » peut être longue au premier passage après un
 * incident, et l'invocation Edge meurt à 150 s. On en prend une tranche, les
 * plus vieux d'abord ; le reste part à la passe suivante (13:00 ou minuit) —
 * il ne se perd plus, c'est tout l'intérêt de la file.
 */
const PASSAGES_PAR_PASSE = 25;
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
    /** Passages réellement mesurés par ce run (et pas seulement visés). */
    relevesIds?: string[];
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
  /** Dernier relevé réussi — null = jamais mesuré (prioritaire). */
  stats_maj_at?: string | null;
  /** Relevés consécutifs sans correspondance (0281). */
  stats_echecs?: number | null;
  /** Dernière tentative de relevé, réussie ou non (0281). */
  stats_tentative_at?: string | null;
};

/**
 * Les passages à relever : CE QUI MANQUE, pas une tranche de calendrier.
 *
 * Le critère est l'état du passage (`passageARelever`, `releve_file.ts`) : un
 * post publié depuis `MESURE_JOURS` qui n'a pas encore sa mesure de J+2. Une
 * fois mesuré à J+2, il ne l'est plus jamais. Un passage introuvable
 * `RELEVE_ECHECS_MAX` fois n'est plus payé.
 *
 * Les passages SANS lien sont inclus : ce sont les seuls qu'on cherche sur le
 * profil. Rend aussi tous les passages publiés de la fenêtre (`publies`) : la
 * profondeur de ce scrape de profil se calcule sur eux.
 *
 * Les plus vieux passent devant : ce sont eux qui bloquent une requalification
 * de cycle.
 */
async function chargerPassagesARelever(
  supabase: Supabase,
  compteId: string | null,
  opts: { profondeurJours?: number } = {},
): Promise<{ dus: PassageFenetre[]; publies: PassageFenetre[] }> {
  const profondeur = Math.max(1, opts.profondeurJours ?? RATTRAPAGE_PROFONDEUR_JOURS);
  const depuis = ajouterJoursParis(aujourdhuiParis(), -profondeur);

  let q = supabase
    .from("passages")
    .select(
      "id, contenu_id, compte_id, langue, publie_url, publie_at, date_publication_prevue, vues, likes, commentaires, partages, slides, stats_maj_at, stats_echecs, stats_tentative_at",
    )
    .eq("statut", "publie")
    .gte("date_publication_prevue", depuis);

  if (compteId) q = q.eq("compte_id", compteId);

  const { data, error } = await q;
  if (error) throw error;

  const publies = (data ?? []) as PassageFenetre[];
  const maintenant = Date.now();
  const dus = publies.filter((p) => passageARelever(p, maintenant));

  dus.sort((a, b) => (a.date_publication_prevue ?? "").localeCompare(b.date_publication_prevue ?? ""));
  return { dus, publies };
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
      stats_echecs: 0,
      stats_tentative_at: new Date().toISOString(),
    })
    .eq("id", passageId);
}

/**
 * Relevé sans correspondance : on le compte, pour cesser de payer au bout de
 * `RELEVE_ECHECS_MAX` (post supprimé, lien faux). Le 28/09, 22 passages
 * introuvables étaient retentés à chaque passe, chacun avec un `scrapePost`.
 */
async function noterEchecReleve(
  supabase: Supabase,
  passage: PassageFenetre,
  dryRun: boolean,
): Promise<void> {
  if (dryRun) return;
  await supabase
    .from("passages")
    .update({
      stats_echecs: (passage.stats_echecs ?? 0) + 1,
      stats_tentative_at: new Date().toISOString(),
    })
    .eq("id", passage.id);
}

/**
 * Relève les stats des passages dus, compte par compte.
 *
 *   - avec lien : tous les posts du compte dans UN appel Apify (`postURLs`),
 *     rapprochés par l'identifiant du post (`apparierParLien`) ;
 *   - sans lien : le profil est lu jusqu'au plus vieux d'entre eux, et le post
 *     retrouvé par cohérence (date ±36 h + texte des slides).
 *
 * Un passage non retrouvé compte un échec ; il est retenté après 20 h, et
 * abandonné au bout de `RELEVE_ECHECS_MAX`. Une erreur d'appel (Apify en 402,
 * réseau) n'est pas un échec du passage : elle remonte au drain.
 */
async function releverStatsFenetre(
  supabase: Supabase,
  passages: PassageFenetre[],
  publies: PassageFenetre[],
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
    relevesIds: [],
  };

  const parCompte = new Map<string, PassageFenetre[]>();
  for (const p of passages) {
    const list = parCompte.get(p.compte_id) ?? [];
    list.push(p);
    parCompte.set(p.compte_id, list);
  }

  const compteIds = [...parCompte.keys()];
  if (compteIds.length === 0) {
    journal.push("info", "Aucun passage à J+2 à relever");
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
    const avecLien = liste.filter((p) => lienTiktok(p.publie_url));
    const sansLien = liste.filter((p) => !lienTiktok(p.publie_url));
    const trouves = new Map<string, { stats: ScrapedPost["stats"]; via: "url" | "coherence" }>();
    let relevesCompte = 0;
    let sansMatchCompte = 0;
    try {
      if (avecLien.length > 0) {
        const demandes = await Promise.all(
          avecLien.map(async (passage) => {
            const brut = passage.publie_url!.trim();
            const complet = await resoudreLien(brut);
            const idPost = idPostTiktok(complet) ?? idPostTiktok(brut);
            // Le lien résolu sans ses paramètres de partage ; à défaut, le lien collé.
            const url = idPost ? complet.split("?")[0]! : brut;
            return { passage, idPost, url };
          }),
        );
        journal.push("info", `@${handle} — ${demandes.length} lien(s), un appel Apify`);
        const resultats = await releverPostsParLien(demandes.map((d) => d.url));
        for (const [passageId, r] of apparierParLien(demandes, resultats)) {
          trouves.set(passageId, { stats: r.stats, via: "url" });
        }
      }

      if (sansLien.length > 0) {
        const aScraper = profondeurScrape(
          publies.filter((p) => p.compte_id === compte.id),
          sansLien,
        );
        journal.push(
          "info",
          `@${handle} — ${sansLien.length} post(s) sans lien, scrape profil (${aScraper} posts lus)`,
        );
        const enLigne = await scrapeStats(handle, aScraper);
        for (const passage of sansLien) {
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
          if (best) trouves.set(passage.id, { stats: best.post.stats, via: "coherence" });
        }
      }

      for (const passage of liste) {
        const trouve = trouves.get(passage.id);
        if (!trouve) {
          sansMatchCompte += 1;
          out.sansMatch += 1;
          await noterEchecReleve(supabase, passage, dryRun);
          journal.push(
            "warn",
            `@${handle} — pas de match stats`,
            `${passage.date_publication_prevue ?? "?"} · ${passage.id.slice(0, 8)}` +
              (lienTiktok(passage.publie_url) ? "" : " · sans lien"),
          );
          continue;
        }

        await ecrireStats(supabase, passage.id, trouve.stats, dryRun);
        passage.vues = trouve.stats.vues;
        passage.likes = trouve.stats.likes;
        passage.commentaires = trouve.stats.commentaires;
        passage.partages = trouve.stats.partages;
        out.releves += 1;
        out.relevesIds?.push(passage.id);
        relevesCompte += 1;
        if (trouve.via === "coherence") out.fallbackCoherence += 1;
        journal.push(
          "ok",
          `@${handle} · ${passage.date_publication_prevue ?? "?"} → ${trouve.stats.vues} vues`,
          trouve.via === "url" ? "par lien" : "profil, cohérence",
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
        ` passage(s)${d.passagesPerimes > 0 ? ` · ${d.passagesPerimes} périmé(s)` : ""}` +
        `${d.timeout ? " · timeout 14 j" : ""} → ${d.nouveauCible} passage(s) à faire`,
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

type SnapshotVues = { jour: string; vues_totales: number; vues_delta: number | null; nb_comptes: number };

/**
 * Courbe des vues du Pilotage (`vues_globales_jour`), calculée en base par
 * `snapshot_vues_globales` (0285) depuis NOS passages : pour chaque jour Paris,
 * les vues relevées des posts publiés ce jour-là (`vues_delta`) et leur cumul
 * (`vues_totales`).
 *
 * Avant le 01/10, elle sommait le dernier scrape de profil de chaque compte
 * (`compte_metrics`) : un total qui dépendait du nombre de posts lus, et qui a
 * perdu la moitié de son échelle quand 0281 a réduit ce nombre (delta −4 M sans
 * qu'aucune audience ne bouge). Le relevé ne lit plus les profils : il ne reste
 * que nos posts, mesurés à J+2. Un post publié aujourd'hui n'entre donc dans
 * la courbe que deux jours plus tard : la fonction recalcule les quatre
 * derniers jours à chaque passe.
 */
export async function snapshotVuesGlobales(
  supabase: Supabase,
  journal?: Journal,
  jourForce?: string,
): Promise<SnapshotVues> {
  const jour = jourForce ?? aujourdhuiParis();
  const { data, error } = await supabase.rpc("snapshot_vues_globales", { p_jour: jour, p_jours: 4 });
  if (error) throw error;
  const lignes = (data ?? []) as SnapshotVues[];
  const ligne = lignes.find((l) => l.jour === jour) ?? { jour, vues_totales: 0, vues_delta: null, nb_comptes: 0 };
  journal?.push(
    "ok",
    `Snapshot vues ${jour}`,
    `total ${ligne.vues_totales} · Δ ${ligne.vues_delta ?? "n/a"} · ${ligne.nb_comptes} compte(s)` +
      ` · ${lignes.length} jour(s) recalculé(s)`,
  );
  return ligne;
}

/** Recalcule un jour Paris passé de la courbe (même calcul, un seul jour). */
export async function backfillSnapshotVuesJour(
  supabase: Supabase,
  jour: string,
  journal?: Journal,
): Promise<SnapshotVues> {
  const { data, error } = await supabase.rpc("snapshot_vues_globales", { p_jour: jour, p_jours: 1 });
  if (error) throw error;
  const ligne = ((data ?? []) as SnapshotVues[])[0] ?? { jour, vues_totales: 0, vues_delta: null, nb_comptes: 0 };
  journal?.push(
    "ok",
    `Backfill snapshot ${jour}`,
    `total ${ligne.vues_totales} · Δ ${ligne.vues_delta ?? "n/a"} · ${ligne.nb_comptes} compte(s)`,
  );
  return ligne;
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

  // `jours` ne borne plus la sélection (c'est l'état du passage qui décide) :
  // il ne sert qu'à dater le brief et la profondeur de la file.
  const jours = Math.max(1, Math.min(RATTRAPAGE_PROFONDEUR_JOURS, opts.jours ?? RATTRAPAGE_JOURS_DEFAUT));
  const dryRun = Boolean(opts.dryRun);
  const { debut, fin } = joursFenetreParis(jours);
  const handles = new Map<string, string | null>();

  journal.push(
    "info",
    `Démarrage rattrapage${dryRun ? " (dry-run)" : ""}`,
    `file « ce qui manque » sur ${RATTRAPAGE_PROFONDEUR_JOURS} j` +
      (opts.compteId ? ` · compte ${opts.compteId.slice(0, 8)}` : " · tous comptes"),
  );

  const { dus: enFile, publies } = await chargerPassagesARelever(supabase, opts.compteId ?? null);
  const passages = enFile.slice(0, PASSAGES_PAR_PASSE);
  const sansLien = passages.filter((p) => !lienTiktok(p.publie_url)).length;
  journal.push(
    "info",
    `${passages.length} passage(s) à J+2 à relever`,
    `${passages.length - sansLien} par lien · ${sansLien} sans lien` +
      (enFile.length > passages.length
        ? ` · ${enFile.length - passages.length} reporté(s) à la passe suivante`
        : ""),
  );

  // Compte isolé sans passage dû : rien à scraper. Le total du profil
  // (`compte_metrics`) n'est plus relevé : plus rien ne le lit depuis que la
  // courbe du Pilotage se calcule sur nos passages (0285).
  if (opts.compteId && passages.length === 0) {
    journal.push("info", "Rien à relever — aucun post n'a atteint J+2 sans mesure");
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

  const stats = await releverStatsFenetre(supabase, passages, publies, dryRun, handles, journal);

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

  // Requalification tierlist : sur un run « tous comptes », la passe complète ;
  // sur un run compte isolé, les slideshows que CE run vient de mesurer.
  //
  // Un run compte ne voit qu'une partie des passages d'un cycle — mais
  // `requalifierContenus` relit les passages par `contenu_id`, pas par compte.
  // Ciblée sur un slideshow, la passe voit donc son cycle en entier, quel que
  // soit le compte qui a déclenché le run. C'est ce qui permet de requalifier
  // dans la minute qui suit le relevé décisif au lieu d'attendre la fin du drain.
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
  } else {
    // Seulement les slideshows dont un passage vient VRAIMENT d'être mesuré.
    // Prendre tous les passages visés faisait juger des cycles sur des vues
    // figées dès que le scrape échouait : le 30/09, Apify en 402 sur les 27
    // comptes, 10 slideshows sont descendus de B en C sans une vue nouvelle.
    const mesures = new Set(stats.relevesIds ?? []);
    const touches = [...new Set(passages.filter((p) => mesures.has(p.id)).map((p) => p.contenu_id))];
    if (touches.length > 0) {
      requalif = await requalifierContenus(supabase, { dryRun, contenuIds: touches });
      journalRequalif(journal, requalif);
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
 * 1 seul : l'appel Apify du compte (et le scrape profil des posts sans lien)
 * doit tenir sous idle 150s.
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
  /** Apify a répondu 402 (crédit épuisé) : inutile de continuer la file. */
  apifyEpuise: boolean;
}> {
  const offset = Math.max(0, Math.floor(opts.offset ?? 0));
  const tous = await listerComptesRattrapageElo(supabase);
  const lot = tous.slice(offset, offset + DRAIN_BATCH_ELO);
  const erreurs: Array<{ compteId: string; handle: string; erreur: string }> = [];

  for (const c of lot) {
    try {
      const r = await rattrapageElo(supabase, {
        compteId: c.id,
        jours: opts.jours,
        dryRun: opts.dryRun,
      });
      // Les erreurs de scrape sont attrapées compte par compte et rangées dans
      // le résultat : sans cette remontée, le drain du 30/09 s'est déclaré
      // « terminé, erreurs : [] » alors que les 27 comptes rendaient Apify 402.
      for (const e of r.stats?.erreurs ?? []) {
        erreurs.push({ compteId: e.compteId, handle: e.handle ?? c.handle_tiktok, erreur: e.erreur });
      }
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
  const apifyEpuise = erreurs.some((e) => estApifyEpuise(e.erreur));
  // Fin de file sans vues nouvelles (Apify à court de crédit) : requalifier ou
  // qualifier maintenant jugerait cycles et créateurs sur des chiffres figés.
  if (restants === 0 && !opts.dryRun && !apifyEpuise) {
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
    apifyEpuise,
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

export { DRAIN_BATCH_ELO, DRAIN_BUSY_STALE_MS, DRAIN_MAX_CHAIN_ELO };
