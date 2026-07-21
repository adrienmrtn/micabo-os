import { scrapeStats } from "../_shared/apify.ts";
import { assertAuthorised, json, messageErreur, serviceClient } from "../_shared/supabase.ts";

type Supabase = ReturnType<typeof serviceClient>;

const POSTS_RELEVES = 30;

/**
 * Relève les performances des comptes tenus par les posters, pour alimenter le
 * recyclage « sur les meilleures perfs ». Sans ces chiffres, le tirage recyclé
 * n'a rien sur quoi trancher et retombe sur une composition normale.
 *
 * On rapproche par `publie_url` : c'est le lien que le poster colle lui-même
 * après publication, donc la seule correspondance fiable entre un de nos posts
 * et un post réellement en ligne.
 *
 *   {}             → tous les comptes actifs ayant un pseudo TikTok
 *   { compteId }   → ce seul compte
 */
Deno.serve(async (request) => {
  const denied = await assertAuthorised(request);
  if (denied) return denied;

  const supabase = serviceClient();

  let compteId: string | null = null;
  try {
    const body = await request.json();
    compteId = body?.compteId ?? null;
  } catch {
    // Corps vide : tous les comptes.
  }

  try {
    let query = supabase
      .from("comptes")
      .select("id, handle_tiktok")
      .eq("is_active", true)
      .not("handle_tiktok", "is", null);
    if (compteId) query = query.eq("id", compteId);

    const { data: comptes, error } = await query;
    if (error) throw error;

    const resultats: Array<{ compteId: string; releves: number; erreur?: string }> = [];

    for (const compte of comptes ?? []) {
      try {
        const releves = await releverCompte(supabase, compte.id, compte.handle_tiktok!);
        resultats.push({ compteId: compte.id, releves });
      } catch (error) {
        resultats.push({
          compteId: compte.id,
          releves: 0,
          erreur: messageErreur(error),
        });
      }
    }

    return json({ ok: true, resultats });
  } catch (error) {
    return json({ ok: false, error: messageErreur(error) }, 500);
  }
});

async function releverCompte(
  supabase: Supabase,
  compteId: string,
  handle: string,
): Promise<number> {
  const { data: posts } = await supabase
    .from("posts")
    .select("id, publie_url")
    .eq("compte_id", compteId)
    .eq("statut", "publie")
    .not("publie_url", "is", null);

  if (!posts || posts.length === 0) return 0;

  const enLigne = await scrapeStats(handle, POSTS_RELEVES);

  // TikTok sert la même URL sous plusieurs formes (paramètres, redirections) :
  // on compare sur l'identifiant numérique du post, stable.
  const idDuLien = (url: string) => url.match(/\/(?:photo|video)\/(\d+)/)?.[1] ?? url;
  const parId = new Map(enLigne.map((p) => [idDuLien(p.webVideoUrl), p.stats]));

  let releves = 0;
  for (const post of posts) {
    const stats = parId.get(idDuLien(post.publie_url!));
    if (!stats) continue;

    await supabase.from("post_metrics").insert({
      post_id: post.id,
      vues: stats.vues,
      likes: stats.likes,
      commentaires: stats.commentaires,
      partages: stats.partages,
    });
    releves += 1;
  }

  return releves;
}
