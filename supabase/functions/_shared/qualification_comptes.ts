/**
 * Requalification des comptes créateurs — lecture des passages, écriture de la
 * case. Les règles elles-mêmes sont dans `qualification.ts`, qui est pur et
 * testé côté front.
 *
 * Quand : à la FIN du drain `rattrapage-elo`, pas au cron de minuit. Le relevé
 * des vues est asynchrone et se termine bien après minuit ; requalifier à
 * minuit noterait chaque compte sur les vues de la veille.
 */

import { aujourdhuiParis } from "./supabase.ts";
import {
  donneesDepuisPassages,
  type DonneesQualification,
  type Qualification,
  qualifierCompte,
} from "./qualification.ts";
import type { serviceClient } from "./supabase.ts";

type Supabase = ReturnType<typeof serviceClient>;

export interface QualificationDetail {
  compteId: string;
  handle: string | null;
  avant: Qualification;
  apres: Qualification;
  prevus: number;
  publies: number;
  moyenneVues: number | null;
}

export interface QualificationResultat {
  examines: number;
  changes: number;
  /** Comptes dont la case a été posée à la main : jamais réécrite. */
  verrouilles: number;
  details: QualificationDetail[];
}

type PostLie = { est_test?: boolean | null } | Array<{ est_test?: boolean | null }> | null;

function estDeTest(posts: PostLie | undefined): boolean {
  if (!posts) return false;
  const p = Array.isArray(posts) ? posts[0] : posts;
  return Boolean(p?.est_test);
}

/**
 * Les passages d'un compte, ramenés aux deux fenêtres de jugement.
 *
 * La requête ramène large (les 60 derniers passages) et c'est
 * `donneesDepuisPassages` — le module pur, partagé avec l'écran de
 * surveillance — qui découpe. Découper en SQL ferait deux comptages capables
 * de diverger, et l'admin lirait « 7 sur 10 » en face d'une case posée sur
 * autre chose.
 */
export async function donneesCompte(
  supabase: Supabase,
  compteId: string,
): Promise<DonneesQualification> {
  const { data, error } = await supabase
    .from("passages")
    .select("statut, publie_at, publie_url, date_publication_prevue, vues, posts(est_test)")
    .eq("compte_id", compteId)
    .order("date_publication_prevue", { ascending: false, nullsFirst: false })
    .limit(60);
  if (error) throw error;

  return donneesDepuisPassages(
    (data ?? []).map((p) => ({
      statut: p.statut as string | null,
      publie_at: p.publie_at as string | null,
      publie_url: p.publie_url as string | null,
      date_publication_prevue: p.date_publication_prevue as string | null,
      vues: p.vues as number | null,
      est_test: estDeTest(p.posts as PostLie),
    })),
    aujourdhuiParis(),
  );
}

/**
 * Requalifie tous les comptes actifs sortis de warmup.
 *
 * Un compte dont la case a été posée à la main (`qualification_manuelle`) est
 * laissé tel quel : si l'admin a tranché, la machine ne revient pas dessus la
 * nuit suivante. C'est à lui de déverrouiller.
 */
export async function qualifierComptes(supabase: Supabase): Promise<QualificationResultat> {
  const { data, error } = await supabase
    .from("comptes")
    .select(
      "id, handle_tiktok, qualification, qualification_manuelle, warmup_started_at, warmup_ends_at",
    )
    .eq("is_active", true)
    .order("id", { ascending: true });
  if (error) throw error;

  const details: QualificationDetail[] = [];
  let verrouilles = 0;
  let examines = 0;
  const maintenant = new Date().toISOString();

  for (const c of data ?? []) {
    // Pas encore en process (warmup en cours ou jamais démarré) : rien à juger.
    const debut = c.warmup_started_at as string | null;
    const fin = c.warmup_ends_at as string | null;
    if (!debut || !fin || new Date(fin).getTime() > Date.now()) continue;

    if (c.qualification_manuelle) {
      verrouilles += 1;
      continue;
    }

    examines += 1;
    const compteId = c.id as string;
    const avant = (c.qualification as Qualification | null) ?? "PASSABLE";
    const d = await donneesCompte(supabase, compteId);
    const apres = qualifierCompte(d);

    // La date est posée même quand la case ne bouge pas : « requalifié cette
    // nuit et toujours MAUVAISES_VUES » et « plus jugé depuis dix jours » ne
    // disent pas la même chose, et c'est la deuxième qu'il faut voir.
    const { error: errU } = await supabase
      .from("comptes")
      .update({ qualification: apres, qualification_maj_at: maintenant })
      .eq("id", compteId);
    if (errU) throw errU;

    if (apres === avant) continue;

    details.push({
      compteId,
      handle: (c.handle_tiktok as string | null) ?? null,
      avant,
      apres,
      prevus: d.prevus,
      publies: d.publies,
      moyenneVues: d.moyenneVues,
    });
  }

  return { examines, changes: details.length, verrouilles, details };
}
