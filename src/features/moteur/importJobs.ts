/**
 * Imports v-next : enqueue serveur + suivi par polling.
 * Le scrape et le pipeline tournent côté Edge (workers cron + auto-chaîne) —
 * fermer l'onglet / changer de page n'arrête plus l'import.
 */

import {
  contenusEloDuBatch,
  enqueueImportCompte,
  enqueueImportUrls,
  fileImportEnCours,
  statsImportBatch,
} from "@/features/moteur/api";
import {
  attenteInitiale,
  avancerAttente,
  delaiSondage,
  type EtatAttente,
} from "@/features/moteur/majSequentielle";
import { handleTiktokDepuisSaisie } from "@/features/moteur/oubliSource";
import { supabase } from "@/lib/supabase/client";

export type ImportLogLevel = "info" | "ok" | "warn" | "error";

export interface ImportLogLine {
  at: number;
  level: ImportLogLevel;
  message: string;
  detail?: string;
}

export type ImportJobStatut = "encours" | "ok" | "echec";

export interface ImportJob {
  id: string;
  titre: string;
  statut: ImportJobStatut;
  logs: ImportLogLine[];
  startedAt: number;
  endedAt?: number;
  batchId?: string;
}

type Listener = () => void;

let jobs: ImportJob[] = [];
const listeners = new Set<Listener>();
const polls = new Map<string, ReturnType<typeof setTimeout>>();

function emit() {
  for (const l of listeners) l();
}

export function subscribeImportJobs(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getImportJobs(): ImportJob[] {
  return jobs;
}

function upsertJob(job: ImportJob) {
  const i = jobs.findIndex((j) => j.id === job.id);
  if (i >= 0) jobs = [...jobs.slice(0, i), job, ...jobs.slice(i + 1)];
  else jobs = [job, ...jobs].slice(0, 20);
  emit();
}

function log(jobId: string, level: ImportLogLevel, message: string, detail?: string) {
  const cur = jobs.find((j) => j.id === jobId);
  if (!cur) return;
  upsertJob({
    ...cur,
    logs: [...cur.logs, { at: Date.now(), level, message, detail }],
  });
}

function fin(jobId: string, statut: ImportJobStatut) {
  const cur = jobs.find((j) => j.id === jobId);
  if (!cur) return;
  upsertJob({ ...cur, statut, endedAt: Date.now() });
  const t = polls.get(jobId);
  if (t) {
    clearTimeout(t);
    polls.delete(jobId);
  }
}

/**
 * Le listing d'un profil retient une invocation Edge pendant tout l'appel Apify
 * (plusieurs dizaines de secondes). « Mettre à jour les sources » en lançait un
 * par compte d'un coup : au-delà de la concurrence Edge, les appels repartaient
 * en « Failed to send a request to the Edge Function », sur tous les comptes.
 * Le scrape derrière reste parallèle — il est drainé par les workers cron.
 */
const LISTINGS_SIMULTANES = 2;
let listingsEnCours = 0;
const fileListings: Array<() => void> = [];

async function prendreCreneauListing(): Promise<() => void> {
  if (listingsEnCours >= LISTINGS_SIMULTANES) {
    await new Promise<void>((resolve) => fileListings.push(resolve));
  }
  listingsEnCours += 1;
  let rendu = false;
  return () => {
    if (rendu) return;
    rendu = true;
    listingsEnCours -= 1;
    fileListings.shift()?.();
  };
}

export function listingsEnAttente(): number {
  return fileListings.length;
}

function newJob(titre: string, batchId?: string): string {
  const id = crypto.randomUUID();
  upsertJob({
    id,
    titre,
    statut: "encours",
    logs: [],
    startedAt: Date.now(),
    batchId,
  });
  return id;
}

/** Rythme du suivi : réactif au début, plus calme sur un gros batch. */
function delaiPoll(depuisMs: number): number {
  if (depuisMs < 60_000) return 4_000;
  if (depuisMs < 5 * 60_000) return 8_000;
  return 20_000;
}

const ECHECS_AVANT_ABANDON = 8;

function startPolling(jobId: string, batchId: string) {
  let lastKey = "";
  let echecs = 0;
  const debut = Date.now();
  const eloVus = new Set<string>();

  // Enchaînement par setTimeout et non setInterval : un tick lent empilait les
  // suivants, ce qui ajoutait de la charge au moment où tout ramait déjà.
  const planifier = () => {
    const attente = delaiPoll(Date.now() - debut) * (echecs > 0 ? Math.min(echecs, 4) : 1);
    polls.set(
      jobId,
      setTimeout(() => void tick(), attente),
    );
  };

  const tick = async () => {
    try {
      const s = await statsImportBatch(batchId);
      echecs = 0;
      const key = `${s.pending}-${s.running}-${s.done}-${s.failed}-${s.contenusPending}-${s.contenusDone}`;
      if (key !== lastKey) {
        lastKey = key;
        log(
          jobId,
          "info",
          `Serveur · file ${s.done + s.failed}/${s.total} scrapés` +
            ` · pipeline ${s.contenusDone} prêts / ${s.contenusPending} en cours` +
            (s.failed ? ` · ${s.failed} échecs scrape` : ""),
          `pending=${s.pending} running=${s.running} done=${s.done} failed=${s.failed}`,
        );
      }

      // Rapport ELO dès qu'il est persisté (rejeté ou accepté).
      const eloRows = await contenusEloDuBatch(batchId).catch(() => []);
      for (const row of eloRows) {
        if (!row.elo || eloVus.has(row.contenuId)) continue;
        eloVus.add(row.contenuId);
        const sousSeuil = row.importEtape === "elo_insuffisant";
        log(
          jobId,
          sousSeuil ? "warn" : "ok",
          sousSeuil
            ? `ELO sous seuil — ${row.postUrl}`
            : `calcul ELO — ${row.postUrl}`,
          row.elo.texte,
        );
      }

      const fileVide = s.pending === 0 && s.running === 0;
      const pipelineVide = s.contenusPending === 0;
      if (fileVide && pipelineVide && s.total > 0) {
        const { data: rows } = await supabase
          .from("import_file")
          .select("contenu_id, statut, erreur, post_url")
          .eq("batch_id", batchId);
        const ok = (rows ?? []).filter((r) => r.statut === "done").length;
        const fail = (rows ?? []).filter((r) => r.statut === "failed").length;
        for (const r of rows ?? []) {
          if (r.statut === "failed") {
            log(jobId, "warn", `scrape échoué`, `${r.post_url}\n${r.erreur ?? ""}`);
          }
        }
        const sousElo = eloRows.filter((r) => r.importEtape === "elo_insuffisant").length;
        log(
          jobId,
          fail > 0 && ok === 0 ? "error" : fail > 0 || sousElo > 0 ? "warn" : "ok",
          `Terminé (serveur) — ${ok} scrapés, ${fail} échecs scrape` +
            (sousElo ? `, ${sousElo} ELO sous seuil` : "") +
            `, ${s.contenusDone} contenus traités`,
        );
        fin(jobId, fail > 0 && ok === 0 ? "echec" : "ok");
        return;
      }
    } catch (e) {
      echecs += 1;
      if (echecs >= ECHECS_AVANT_ABANDON) {
        log(
          jobId,
          "warn",
          `Suivi interrompu après ${echecs} échecs de lecture — l'import continue côté serveur`,
          `Rouvre la page pour reprendre le suivi.\n${(e as Error).message}`,
        );
        fin(jobId, "ok");
        return;
      }
      // Une seule ligne, pas une par tentative : avant, l'échec se répétait
      // toutes les 4 s sur chaque compte et noyait les vrais messages.
      if (echecs === 1) {
        log(
          jobId,
          "warn",
          "Lecture de la progression indisponible — nouvelle tentative",
          (e as Error).message,
        );
      }
    }
    planifier();
  };
  void tick();
}

/** Lance l'import d'un lien TikTok — enqueue serveur, drain autonome. */
export function demarrerImportLien(opts: {
  url: string;
  compteReferenceId: string | null;
  labelIds: string[];
  /** Langue d'origine du TikTok (requis pour le boost ELO). */
  langue: string;
  titre?: string;
}): string {
  const jobId = newJob(opts.titre ?? opts.url);
  void (async () => {
    try {
      log(
        jobId,
        "info",
        `Enqueue serveur (langue=${opts.langue}) — tu peux quitter la page…`,
        opts.url,
      );
      const r = await enqueueImportUrls({
        urls: [opts.url],
        compteReferenceId: opts.compteReferenceId,
        labelIds: opts.labelIds,
        langue: opts.langue,
      });
      const cur = jobs.find((j) => j.id === jobId);
      if (cur) upsertJob({ ...cur, batchId: r.batchId });
      if (r.invalides?.length) {
        log(
          jobId,
          "error",
          "Lien refusé — ce n'est pas l'URL d'un slideshow",
          `Colle l'URL d'un post (…/photo/… ou …/video/…), pas celle d'un profil.\n${r.invalides.join("\n")}`,
        );
        fin(jobId, "echec");
        return;
      }
      log(
        jobId,
        "ok",
        `Enfilé — batch ${r.batchId.slice(0, 8)}…`,
        `enfilées=${r.enqueued} · déjà en file=${r.skipped} · langue=${opts.langue}`,
      );
      startPolling(jobId, r.batchId);
    } catch (e) {
      log(jobId, "error", "Échec enqueue", (e as Error).message);
      fin(jobId, "echec");
    }
  })();
  return jobId;
}

/**
 * Import d'un compte : listing + enqueue de toutes les URLs côté serveur.
 * Parallélisation = 12 workers cron/min + auto-chaîne Edge.
 */
export function demarrerImportCompte(opts: {
  compteReferenceId: string;
  handle: string;
  /** Langue d'origine des TikToks de ce compte. */
  langue: string;
  /** Ignoré — la largeur est côté serveur (workers). */
  largeur?: number;
  /** Uniquement les TikToks publiés depuis le dernier import (pas les anciens). */
  nouveauxSeulement?: boolean;
}): string {
  const handle = handleTiktokDepuisSaisie(opts.handle);
  const prefixe = opts.nouveauxSeulement ? "MAJ @" : "@";
  const jobId = newJob(`${prefixe}${handle}`);
  void (async () => {
    let rendreCreneau: (() => void) | null = null;
    try {
      log(
        jobId,
        "info",
        opts.nouveauxSeulement
          ? `Mise à jour — rattrapage des slideshows manquants (langue=${opts.langue})…`
          : `Listing + enqueue (langue=${opts.langue}) — fermeture OK…`,
        `@${handle}`,
      );
      if (listingsEnCours >= LISTINGS_SIMULTANES) {
        log(jobId, "info", `En attente d'un créneau de listing (${listingsEnAttente() + 1} en file)`);
      }
      rendreCreneau = await prendreCreneauListing();
      const r = await enqueueImportCompte(
        opts.compteReferenceId,
        undefined,
        opts.langue,
        { nouveauxSeulement: opts.nouveauxSeulement },
      );
      const cur = jobs.find((j) => j.id === jobId);
      if (cur) upsertJob({ ...cur, batchId: r.batchId });
      const detail = [
        `profil=${r.total} slideshow(s) · déjà en stock=${r.connus} · manquants=${r.manquants}`,
        `dont publiés depuis le dernier import=${r.nouveaux}`,
        `batch=${r.batchId} · source=${r.source} · langue=${opts.langue}`,
        ...(r.invalides ? [`écartées (pas des URLs de post)=${r.invalides}`] : []),
        ...(r.diagnostic ?? []),
      ].join("\n");

      if (r.total === 0) {
        // Le profil n'a rien rendu : handle invalide, page TikTok bloquée ou
        // Apify en échec. Le détail dit lequel — c'est ce qui manquait avant.
        log(jobId, "error", "Aucun slideshow trouvé sur le profil", detail);
        fin(jobId, "echec");
        return;
      }

      if (opts.nouveauxSeulement) {
        log(
          jobId,
          r.enqueued > 0 ? "ok" : "info",
          r.enqueued > 0
            ? `Mise à jour — ${r.enqueued} slideshow(s) manquant(s) enfilé(s)`
            : `Rien à rattraper — les ${r.total} slideshows du profil sont déjà en stock`,
          detail,
        );
      } else {
        log(
          jobId,
          "ok",
          `File créée — ${r.enqueued} URL(s) enfilée(s)` +
            (r.skipped ? ` (${r.skipped} déjà en file)` : "") +
            (r.connus ? ` · ${r.connus} déjà connus (re-pipeline)` : ""),
          detail,
        );
      }

      if (r.enqueued === 0) {
        fin(jobId, "ok");
        return;
      }
      startPolling(jobId, r.batchId);
    } catch (e) {
      log(jobId, "error", "Échec import compte", (e as Error).message);
      fin(jobId, "echec");
    } finally {
      rendreCreneau?.();
    }
  })();
  return jobId;
}

export function clearImportJobsTermines() {
  jobs = jobs.filter((j) => j.statut === "encours");
  emit();
}

/** Avancement de la séquence « Mettre à jour les sources ». */
export interface MajSourcesEtat {
  actif: boolean;
  total: number;
  /** Comptes déjà traités (l'index du compte en cours vaut `faits + 1`). */
  faits: number;
  handle: string | null;
  phase: "import" | "attente" | null;
  /** Éléments encore en file serveur pendant une phase d'attente. */
  restant: number;
}

const MAJ_ETAT_VIDE: MajSourcesEtat = {
  actif: false,
  total: 0,
  faits: 0,
  handle: null,
  phase: null,
  restant: 0,
};

let majEtat: MajSourcesEtat = MAJ_ETAT_VIDE;
const majListeners = new Set<Listener>();

export function subscribeMajSources(listener: Listener): () => void {
  majListeners.add(listener);
  return () => {
    majListeners.delete(listener);
  };
}

export function getMajSources(): MajSourcesEtat {
  return majEtat;
}

function setMaj(patch: Partial<MajSourcesEtat>) {
  majEtat = { ...majEtat, ...patch };
  for (const l of majListeners) l();
}

const pause = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Résout quand le job quitte l'état « en cours ». */
function attendreFinJob(jobId: string): Promise<ImportJobStatut> {
  const terminal = (): ImportJobStatut | null => {
    const j = jobs.find((x) => x.id === jobId);
    // Job évincé du store (plafond de 20) : rien de plus à attendre.
    if (!j) return "ok";
    return j.statut === "encours" ? null : j.statut;
  };
  const immediat = terminal();
  if (immediat) return Promise.resolve(immediat);
  return new Promise((resolve) => {
    const off = subscribeImportJobs(() => {
      const s = terminal();
      if (!s) return;
      off();
      resolve(s);
    });
  });
}

/**
 * Au-delà, une file qui ne descend plus est considérée figée : on arrête la
 * séquence au lieu d'empiler sur un drain mort.
 */
const STAGNATION_MS = 10 * 60_000;

type Jeton = { annule: boolean };
let jetonCourant: Jeton | null = null;

/** Demande l'arrêt de la séquence après le compte en cours. */
export function annulerMajSources(): void {
  if (jetonCourant) jetonCourant.annule = true;
}

async function attendreFileVide(
  jobId: string,
  jeton: Jeton,
): Promise<"vide" | "bloquee" | "annule"> {
  let etat: EtatAttente = attenteInitiale(Date.now());
  let dernierLog = 0;
  let echecs = 0;

  for (;;) {
    if (jeton.annule) return "annule";

    let mesure;
    try {
      mesure = await fileImportEnCours();
      echecs = 0;
    } catch (e) {
      echecs += 1;
      if (echecs >= ECHECS_AVANT_ABANDON) {
        log(
          jobId,
          "error",
          `File illisible après ${echecs} tentatives — séquence stoppée`,
          `Sans lecture de la file, enfiler la suite reviendrait à travailler à l'aveugle.\n${(e as Error).message}`,
        );
        return "bloquee";
      }
      await pause(delaiSondage(0) * echecs);
      continue;
    }

    const pas = avancerAttente(etat, mesure, Date.now(), STAGNATION_MS);
    etat = pas.etat;

    if (pas.verdict.type === "vide") {
      setMaj({ restant: 0 });
      return "vide";
    }
    if (pas.verdict.type === "bloquee") {
      log(
        jobId,
        "error",
        `File figée à ${pas.verdict.restant} élément(s) depuis ${Math.round(
          pas.verdict.depuisMs / 60_000,
        )} min — séquence stoppée`,
        "Rien de neuf n'est enfilé tant que la file ne redescend pas : vérifie les crons de drain.",
      );
      return "bloquee";
    }

    setMaj({ restant: pas.verdict.restant });
    if (Date.now() - dernierLog >= 60_000) {
      dernierLog = Date.now();
      log(
        jobId,
        "info",
        `Attente de la file — ${mesure.file} scrape(s), ${mesure.pipeline} pipeline(s)`,
      );
    }
    await pause(delaiSondage(pas.verdict.restant));
  }
}

/**
 * Met à jour les sources une par une, file vidée entre chaque.
 *
 * Le compte suivant ne part que quand plus rien n'est « En file » ni
 * « Pipeline… » : la charge serveur reste celle d'un seul compte, quel que
 * soit le nombre de sources.
 */
export function demarrerMajToutesSources(
  comptes: Array<{ compteReferenceId: string; handle: string; langue: string }>,
): string {
  const jobId = newJob(`Mise à jour séquentielle — ${comptes.length} source(s)`);
  const jeton: Jeton = { annule: false };
  jetonCourant = jeton;
  setMaj({
    actif: true,
    total: comptes.length,
    faits: 0,
    handle: null,
    phase: "attente",
    restant: 0,
  });

  void (async () => {
    try {
      log(
        jobId,
        "info",
        `Séquence — un compte à la fois, file vidée entre chaque`,
        comptes.map((c) => `@${handleTiktokDepuisSaisie(c.handle)}`).join(", "),
      );

      for (const [i, compte] of comptes.entries()) {
        const rang = `[${i + 1}/${comptes.length}]`;
        const handle = handleTiktokDepuisSaisie(compte.handle);

        if (jeton.annule) {
          log(jobId, "warn", `Arrêt demandé — ${i} compte(s) traité(s)`);
          fin(jobId, "ok");
          return;
        }

        setMaj({ faits: i, handle, phase: "attente" });
        const attente = await attendreFileVide(jobId, jeton);
        if (attente === "annule") {
          log(jobId, "warn", `Arrêt demandé — ${i} compte(s) traité(s)`);
          fin(jobId, "ok");
          return;
        }
        if (attente === "bloquee") {
          log(jobId, "error", `Séquence arrêtée avant ${rang} @${handle}`);
          fin(jobId, "echec");
          return;
        }

        setMaj({ faits: i, handle, phase: "import" });
        log(jobId, "info", `${rang} @${handle} — mise à jour`);
        const sousJob = demarrerImportCompte({
          compteReferenceId: compte.compteReferenceId,
          handle: compte.handle,
          langue: compte.langue,
          nouveauxSeulement: true,
        });
        const statut = await attendreFinJob(sousJob);
        log(
          jobId,
          statut === "echec" ? "warn" : "ok",
          `${rang} @${handle} — ${statut === "echec" ? "échec (on continue)" : "terminé"}`,
        );
        setMaj({ faits: i + 1 });
      }

      log(jobId, "ok", `Séquence terminée — ${comptes.length} compte(s)`);
      fin(jobId, "ok");
    } catch (e) {
      log(jobId, "error", "Séquence interrompue", (e as Error).message);
      fin(jobId, "echec");
    } finally {
      setMaj(MAJ_ETAT_VIDE);
      if (jetonCourant === jeton) jetonCourant = null;
    }
  })();

  return jobId;
}
