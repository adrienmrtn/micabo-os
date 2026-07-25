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
    // Le poster colle souvent un lien COURT (bouton « Partager » : vm./vt.tiktok.com)
    // qui ne contient pas l'ID numérique. On le résout d'abord en URL complète,
    // sinon rien ne matche (cause du « analytics à 0 » partout sauf 1 compte).
    const complet = await resoudreLien(post.publie_url!);
    const stats = parId.get(idDuLien(complet));
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

/**
 * Résout un lien COURT TikTok (vm./vt.tiktok.com/XXX — ce que donne le bouton
 * « Partager ») en URL complète `/@compte/photo/ID`, en suivant la redirection.
 * Les liens déjà complets sont renvoyés tels quels. En cas d'échec, on renvoie
 * l'URL d'origine (le relevé de ce post est simplement sauté ce tour-ci).
 */
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
