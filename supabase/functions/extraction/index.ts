import { downloadImage, scrapePost, scrapeProfile } from "../_shared/apify.ts";
import { assertAuthorised, json, serviceClient } from "../_shared/supabase.ts";

type Supabase = ReturnType<typeof serviceClient>;

const BUCKET = "medias";
const POSTS_PAR_COMPTE = 5;
/**
 * Nombre de sujets créés par passage. Le scrape lui-même est léger, mais
 * rapatrier les visuels ne l'est pas : sept images par post, et le worker
 * s'épuise avant la fin. On en crée deux, et le passage suivant prend la suite
 * — la déduplication sur source_url garantit qu'on ne repasse pas dessus.
 */
const SUJETS_PAR_PASSAGE = 2;

/**
 * Extraction : récupère les posts passés d'un compte de référence (propriété de
 * l'entreprise) et en fait des `sujets` bruts, visuels stockés chez nous.
 *
 * Volontairement légère : elle ne fait que scraper et télécharger. L'OCR, la
 * notation et le nettoyage des images sont l'affaire de `preparation`, qui
 * travaille par petits lots — une Edge Function ne survit pas à trente appels
 * Gemini d'affilée.
 *
 *   {}                          → tous les comptes de référence actifs
 *   { compteReferenceId }       → ce seul compte (essai admin)
 *   { postUrl, compteReferenceId? } → un seul post (test ciblé)
 */
Deno.serve(async (request) => {
  const denied = await assertAuthorised(request);
  if (denied) return denied;

  const supabase = serviceClient();

  let compteReferenceId: string | null = null;
  let postUrl: string | null = null;
  try {
    const body = await request.json();
    compteReferenceId = body?.compteReferenceId ?? null;
    postUrl = body?.postUrl ?? null;
  } catch {
    // Corps vide : extraction complète.
  }

  try {
    if (postUrl) {
      const [post] = await scrapePost(postUrl);
      if (!post) return json({ ok: false, error: "Aucun post photo à cette URL" }, 400);

      const sujetId = await creerSujet(supabase, post, compteReferenceId);
      return json({ ok: true, sujetId, reused: sujetId === null });
    }

    // Une source par passage. Scraper les huit d'un coup faisait plusieurs
    // centaines de téléchargements dans la même invocation et épuisait le
    // worker ; le cron repasse chaque minute et prend la suivante.
    //
    // La moins récemment scrapée d'abord, `nulls first` pour que celles jamais
    // vues soient servies avant les autres.
    let query = supabase
      .from("comptes_reference")
      .select("id, handle_tiktok")
      .eq("is_active", true)
      .order("dernier_scrape_at", { ascending: true, nullsFirst: true })
      .limit(1);
    if (compteReferenceId) query = query.eq("id", compteReferenceId);

    const { data: comptes, error } = await query;
    if (error) throw error;

    let sujetsCrees = 0;

    for (const compte of comptes ?? []) {
      const { data: run } = await supabase
        .from("extractions")
        .insert({ compte_reference_id: compte.id })
        .select()
        .single();

      try {
        const posts = await scrapeProfile(compte.handle_tiktok, POSTS_PAR_COMPTE);
        let crees = 0;
        let restants = false;

        for (const post of posts) {
          if (crees >= SUJETS_PAR_PASSAGE) {
            restants = true;
            break;
          }
          if (await creerSujet(supabase, post, compte.id)) crees += 1;
        }
        sujetsCrees += crees;

        await supabase
          .from("extractions")
          .update({
            statut: "done",
            termine_at: new Date().toISOString(),
            posts_recuperes: posts.length,
            medias_stockes: crees,
          })
          .eq("id", run?.id);

        // On ne date le scrape qu'une fois la source épuisée : tant qu'il reste
        // des posts à rapatrier, elle doit rester en tête de file.
        if (!restants) {
          await supabase
            .from("comptes_reference")
            .update({ dernier_scrape_at: new Date().toISOString() })
            .eq("id", compte.id);
        }
      } catch (error) {
        await supabase
          .from("extractions")
          .update({
            statut: "failed",
            termine_at: new Date().toISOString(),
            erreur: error instanceof Error ? error.message : String(error),
          })
          .eq("id", run?.id);
      }
    }

    return json({ ok: true, comptes: comptes?.length ?? 0, sujetsCrees });
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : String(error) }, 500);
  }
});

interface PostScrape {
  postId: string;
  webVideoUrl: string;
  text: string;
  imageUrls: string[];
  musicUrl: string | null;
}

/**
 * Crée un sujet à partir d'un post scrapé. Renvoie son id, ou null si le post
 * était déjà connu — `source_url` sert de clé de déduplication entre passages.
 */
async function creerSujet(
  supabase: Supabase,
  post: PostScrape,
  compteReferenceId: string | null,
): Promise<string | null> {
  const { data: existant } = await supabase
    .from("sujets")
    .select("id")
    .eq("source_url", post.webVideoUrl)
    .maybeSingle();
  if (existant) return null;

  // Les visuels d'Apify expirent et exigent un token : on les rapatrie tout de
  // suite dans notre Storage, sinon la bibliothèque pointerait dans le vide.
  const slides = [];
  for (const [index, url] of post.imageUrls.entries()) {
    const position = index + 1;
    slides.push({
      position,
      raw_url: await stockerVisuel(supabase, post.postId, position, url),
      texte_original: null,
      media_id: null,
    });
  }

  const { data: sujet, error } = await supabase
    .from("sujets")
    .insert({
      titre: post.text.slice(0, 160) || "Sans titre",
      structure_slides: slides,
      compte_reference_id: compteReferenceId,
      source_url: post.webVideoUrl,
      musique_url: post.musicUrl,
    })
    .select()
    .single();

  if (error) throw error;
  return sujet.id;
}

/** Rapatrie un visuel ; en cas d'échec on garde l'URL d'origine plutôt que de
 *  perdre le sujet entier. */
async function stockerVisuel(
  supabase: Supabase,
  postId: string,
  position: number,
  sourceUrl: string,
): Promise<string> {
  try {
    const bytes = await downloadImage(sourceUrl);
    const path = `brut/${postId}/${position}.jpg`;

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType: "image/jpeg", upsert: true });
    if (error) throw error;

    return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  } catch {
    return sourceUrl;
  }
}
