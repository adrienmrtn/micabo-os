import { supabase } from "@/lib/supabase/client";
import { quotaPostsParJour } from "@/features/moteur/assignationQuota";
import {
  agregerEssaiCompte,
  compteEnEssai,
  ESSAI_DUREE_MS,
  essaiEndsAt,
  essaiRestantMs,
  type CompteEssai,
  type LignePublicationEssai,
} from "@/features/moteur/essai";

function un<T>(x: T | T[] | null | undefined): T | null {
  if (Array.isArray(x)) return x[0] ?? null;
  return x ?? null;
}

/**
 * Comptes actifs (hors UGC AI VIDEO) encore dans la fenêtre d'essai 5 j.
 * Stats = passages / posts publiés depuis la création, dédupliqués.
 */
export async function listerComptesEssai(now: Date = new Date()): Promise<CompteEssai[]> {
  const depuis = new Date(now.getTime() - ESSAI_DUREE_MS).toISOString();
  const { data, error } = await supabase
    .from("comptes")
    .select(
      "id, created_at, poster_id, handle_tiktok, persona_nom, avatar_url, langue, posts_par_jour, ugc_ai_video, profiles(prenom, nom, email)",
    )
    .eq("is_active", true)
    .eq("ugc_ai_video", false)
    .gte("created_at", depuis)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const comptes = (data ?? []).filter((c) => compteEnEssai(c.created_at as string, now));
  if (comptes.length === 0) return [];

  const ids = comptes.map((c) => c.id as string);
  const [{ data: passages, error: e1 }, { data: posts, error: e2 }] = await Promise.all([
    supabase
      .from("passages")
      .select(
        "id, compte_id, post_id, statut, publie_at, publie_url, vues, likes, commentaires, partages, created_at, contenus(titre, source_url), posts(est_test)",
      )
      .in("compte_id", ids),
    supabase
      .from("posts")
      .select(
        "id, compte_id, statut, publie_at, publie_url, created_at, est_test, sujets(titre, source_url)",
      )
      .in("compte_id", ids)
      .eq("est_test", false),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;

  const parCompte = new Map<string, LignePublicationEssai[]>();
  for (const id of ids) parCompte.set(id, []);

  for (const raw of passages ?? []) {
    const r = raw as {
      id: string;
      compte_id: string;
      post_id: string | null;
      statut: string | null;
      publie_at: string | null;
      publie_url: string | null;
      vues: number | null;
      likes: number | null;
      commentaires: number | null;
      partages: number | null;
      created_at: string | null;
      contenus:
        | { titre: string | null; source_url: string | null }
        | Array<{ titre: string | null; source_url: string | null }>
        | null;
      posts: { est_test: boolean | null } | Array<{ est_test: boolean | null }> | null;
    };
    if (un(r.posts)?.est_test) continue;
    const contenu = un(r.contenus);
    parCompte.get(r.compte_id)?.push({
      compteId: r.compte_id,
      postId: r.post_id,
      passageId: r.id,
      statut: r.statut,
      publieUrl: r.publie_url,
      publieAt: r.publie_at,
      createdAt: r.created_at,
      vues: r.vues,
      likes: r.likes,
      commentaires: r.commentaires,
      partages: r.partages,
      sourceUrl: contenu?.source_url ?? null,
      titre: contenu?.titre ?? null,
    });
  }

  const postsDeja = new Set<string>();
  for (const lignes of parCompte.values()) {
    for (const l of lignes) {
      if (l.postId) postsDeja.add(l.postId);
    }
  }

  for (const raw of posts ?? []) {
    const r = raw as {
      id: string;
      compte_id: string;
      statut: string | null;
      publie_at: string | null;
      publie_url: string | null;
      created_at: string | null;
      sujets:
        | { titre: string | null; source_url: string | null }
        | Array<{ titre: string | null; source_url: string | null }>
        | null;
    };
    if (postsDeja.has(r.id)) continue;
    const sujet = un(r.sujets);
    parCompte.get(r.compte_id)?.push({
      compteId: r.compte_id,
      postId: r.id,
      passageId: null,
      statut: r.statut,
      publieUrl: r.publie_url,
      publieAt: r.publie_at,
      createdAt: r.created_at,
      vues: null,
      likes: null,
      commentaires: null,
      partages: null,
      sourceUrl: sujet?.source_url ?? null,
      titre: sujet?.titre ?? null,
    });
  }

  return comptes.map((c) => {
    const created = c.created_at as string;
    const profil = un(
      c.profiles as
        | { prenom: string | null; nom: string | null; email: string | null }
        | Array<{ prenom: string | null; nom: string | null; email: string | null }>
        | null,
    );
    const agregat = agregerEssaiCompte(
      created,
      Number(c.posts_par_jour ?? 1),
      parCompte.get(c.id as string) ?? [],
      now,
    );
    const ends = essaiEndsAt(created);
    return {
      id: c.id as string,
      created_at: created,
      essai_ends_at: ends.toISOString(),
      restant_ms: essaiRestantMs(created, now),
      poster_id: c.poster_id as string,
      poster_prenom: profil?.prenom ?? null,
      poster_nom: profil?.nom ?? null,
      poster_email: profil?.email ?? null,
      persona_nom: (c.persona_nom as string | null) ?? null,
      handle_tiktok: (c.handle_tiktok as string | null) ?? null,
      avatar_url: (c.avatar_url as string | null) ?? null,
      langue: (c.langue as string) ?? "fr",
      posts_par_jour: quotaPostsParJour(c.posts_par_jour),
      ...agregat,
    };
  });
}
