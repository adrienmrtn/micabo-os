/**
 * Assigne les vidéos papier prêtes aux comptes CM (même langue = même vidéo).
 * Idempotent : upsert sur (compte_id, date_publication_prevue).
 */

import {
  captionDepuisLangue,
  datesFenetreParis,
  estLanguePapierPrete,
  hashtagsDepuisLangue,
  pairesAssignationPapier,
} from "./papier_assignation_core.ts";
import { assurerLanguesMaster } from "./papier_locales.ts";
import { assurerMasterPretSiClips } from "./papier_master.ts";
import { aujourdhuiParis, serviceClient } from "./supabase.ts";

type Supabase = ReturnType<typeof serviceClient>;

type LangueRow = {
  id: string;
  master_id: string;
  langue: string;
  title: string | null;
  hook: string | null;
  cta: string | null;
  hashtags: string | null;
  statut: string;
  video_url: string | null;
  video_path: string | null;
};

type MasterRow = {
  id: string;
  date_publication: string;
};

export type PapierAssignOpts = {
  date?: string;
  masterId?: string;
  langueId?: string;
  fenetreJours?: number;
  compteId?: string;
  test?: boolean;
};

export type PapierAssignPost = {
  id: string;
  compte_id: string;
  langue: string;
  title: string | null;
  caption: string | null;
  hashtags: string | null;
  video_url: string;
  est_test: boolean;
  date_publication_prevue: string;
};

export type PapierAssignResultat = {
  ok: true;
  assigns: number;
  comptes: number;
  langues: number;
  dates: string[];
  detail: string;
  test?: boolean;
  posts?: PapierAssignPost[];
};

export async function assignerPapierComptes(
  supabase: Supabase,
  opts: PapierAssignOpts = {},
): Promise<PapierAssignResultat> {
  const masters = await resoudreMasters(supabase, opts);
  if (!masters.length) {
    return {
      ok: true,
      assigns: 0,
      comptes: 0,
      langues: 0,
      dates: [],
      detail: "aucun master dans la fenêtre",
      test: Boolean(opts.test),
    };
  }

  const masterIds = masters.map((m) => m.id);
  const dateParMaster = new Map(masters.map((m) => [m.id, m.date_publication]));

  let qLangues = supabase.from("papier_langues").select(
    "id, master_id, langue, title, hook, cta, hashtags, statut, video_url, video_path",
  ).in("master_id", masterIds);
  if (opts.langueId) qLangues = qLangues.eq("id", opts.langueId);
  const { data: languesBrutes, error: errL } = await qLangues;
  if (errL) throw errL;
  const langues = ((languesBrutes ?? []) as LangueRow[]).filter(estLanguePapierPrete);
  if (!langues.length) {
    return {
      ok: true,
      assigns: 0,
      comptes: 0,
      langues: 0,
      dates: masters.map((m) => m.date_publication),
      detail: opts.test
        ? "master prêt — vidéo de la langue pas encore assemblée (voix + karaoké)"
        : "aucune langue prête",
      test: Boolean(opts.test),
    };
  }

  let qComptes = supabase
    .from("comptes")
    .select("id, langue, type_compte, is_active")
    .eq("type_compte", "cm");
  if (opts.compteId) qComptes = qComptes.eq("id", opts.compteId);
  else if (!opts.test) qComptes = qComptes.eq("is_active", true);
  const { data: comptesBruts, error: errC } = await qComptes;
  if (errC) throw errC;
  const comptes = comptesBruts ?? [];

  const parMaster = new Map<string, LangueRow[]>();
  for (const langue of langues) {
    const list = parMaster.get(langue.master_id) ?? [];
    list.push(langue);
    parMaster.set(langue.master_id, list);
  }

  const langueParId = new Map(langues.map((l) => [l.id, l]));
  const rows: Array<Record<string, unknown>> = [];
  for (const [masterId, langs] of parMaster) {
    const jour = dateParMaster.get(masterId);
    if (!jour) continue;
    const paires = pairesAssignationPapier(comptes, langs, {
      inclureInactifs: Boolean(opts.test),
    });
    for (const paire of paires) {
      const langue = langueParId.get(paire.langueId);
      if (!langue?.video_url) continue;
      rows.push({
        compte_id: paire.compteId,
        date_publication_prevue: jour,
        master_id: masterId,
        langue_id: langue.id,
        langue: langue.langue,
        title: langue.title,
        caption: captionDepuisLangue(langue),
        hashtags: hashtagsDepuisLangue(langue.hashtags),
        video_url: langue.video_url,
        video_path: langue.video_path,
        statut: "assigne",
        est_test: Boolean(opts.test),
        updated_at: new Date().toISOString(),
      });
    }
  }

  let posts: PapierAssignPost[] = [];
  if (rows.length) {
    const { data: upserted, error: errU } = await supabase
      .from("papier_posts")
      .upsert(rows, { onConflict: "compte_id,date_publication_prevue,est_test" })
      .select(
        "id, compte_id, langue, title, caption, hashtags, video_url, est_test, date_publication_prevue",
      );
    if (errU) throw errU;
    posts = (upserted ?? []) as PapierAssignPost[];
  }

  const dates = [...new Set(masters.map((m) => m.date_publication))];
  return {
    ok: true,
    assigns: rows.length,
    comptes: new Set(rows.map((r) => r.compte_id as string)).size,
    langues: new Set(langues.map((l) => l.id)).size,
    dates,
    test: Boolean(opts.test),
    posts,
    detail: rows.length
      ? `${rows.length} assignation(s) CM${opts.test ? " (test)" : ""}`
      : opts.compteId
        ? "aucune langue prête pour ce compte CM"
        : "aucun compte CM à assigner",
  };
}

export async function supprimerPapierPostsTest(
  supabase: Supabase,
  opts: { compteId: string; date?: string },
): Promise<{ ok: true; supprimes: number }> {
  let q = supabase
    .from("papier_posts")
    .delete()
    .eq("est_test", true)
    .eq("compte_id", opts.compteId);
  if (opts.date) q = q.eq("date_publication_prevue", opts.date);
  const { data, error } = await q.select("id");
  if (error) throw error;
  return { ok: true, supprimes: (data ?? []).length };
}

/** Test : soigne un master coincé à clips, crée la ligne langue, dit s'il faut kick. */
export async function preparerAssignationPapierTest(
  supabase: Supabase,
  opts: PapierAssignOpts,
): Promise<{
  masterId?: string;
  langue?: string;
  langueId?: string;
  ready: boolean;
  soigne: boolean;
}> {
  const masters = await resoudreMasters(supabase, opts);
  let soigne = false;
  for (const master of masters) {
    if (await assurerMasterPretSiClips(supabase, master.id)) soigne = true;
  }
  const masterId = masters[0]?.id;
  if (!masterId || !opts.compteId) {
    return { masterId, ready: false, soigne };
  }
  const { data: compte, error } = await supabase
    .from("comptes")
    .select("langue")
    .eq("id", opts.compteId)
    .maybeSingle();
  if (error) throw error;
  const langue = String((compte as { langue?: string } | null)?.langue ?? "").trim();
  if (!langue || !soigne) return { masterId, langue, ready: false, soigne };

  const rows = await assurerLanguesMaster(supabase, masterId);
  const row = rows.find((l) => l.langue === langue);
  return {
    masterId,
    langue,
    langueId: row?.id,
    ready: Boolean(row && estLanguePapierPrete(row)),
    soigne,
  };
}

async function resoudreMasters(
  supabase: Supabase,
  opts: PapierAssignOpts,
): Promise<MasterRow[]> {
  if (opts.langueId) {
    const { data, error } = await supabase
      .from("papier_langues")
      .select("master_id")
      .eq("id", opts.langueId)
      .maybeSingle();
    if (error) throw error;
    if (!data?.master_id) return [];
    return chargerMasters(supabase, { ids: [data.master_id as string] });
  }
  if (opts.masterId) {
    return chargerMasters(supabase, { ids: [opts.masterId] });
  }
  const jour = opts.date ?? aujourdhuiParis();
  const fenetre = Math.max(1, opts.fenetreJours ?? (opts.date ? 1 : 2));
  return chargerMasters(supabase, { dates: datesFenetreParis(jour, fenetre) });
}

async function chargerMasters(
  supabase: Supabase,
  filtre: { ids?: string[]; dates?: string[] },
): Promise<MasterRow[]> {
  let q = supabase.from("papier_masters").select("id, date_publication");
  if (filtre.ids?.length) q = q.in("id", filtre.ids);
  if (filtre.dates?.length) q = q.in("date_publication", filtre.dates);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as MasterRow[];
}
