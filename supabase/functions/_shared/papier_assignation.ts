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
};

export type PapierAssignResultat = {
  ok: true;
  assigns: number;
  comptes: number;
  langues: number;
  dates: string[];
  detail: string;
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
      detail: "aucune langue prête",
    };
  }

  const { data: comptesBruts, error: errC } = await supabase
    .from("comptes")
    .select("id, langue, type_compte, is_active")
    .eq("type_compte", "cm")
    .eq("is_active", true);
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
    const paires = pairesAssignationPapier(comptes, langs);
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
        updated_at: new Date().toISOString(),
      });
    }
  }

  if (rows.length) {
    const { error: errU } = await supabase.from("papier_posts").upsert(rows, {
      onConflict: "compte_id,date_publication_prevue",
    });
    if (errU) throw errU;
  }

  const dates = [...new Set(masters.map((m) => m.date_publication))];
  return {
    ok: true,
    assigns: rows.length,
    comptes: new Set(rows.map((r) => r.compte_id as string)).size,
    langues: new Set(langues.map((l) => l.id)).size,
    dates,
    detail: rows.length
      ? `${rows.length} assignation(s) CM`
      : "aucun compte CM à assigner",
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
