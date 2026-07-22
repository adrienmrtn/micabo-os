import { scrapePost } from "../_shared/apify.ts";
import { assertAuthorised, json, messageErreur, serviceClient } from "../_shared/supabase.ts";

/**
 * Répare les liens musique périmés. Les anciens sujets stockaient le `playUrl`
 * CDN de TikTok (signé, il expire → boutons musique morts). On re-scrape leur
 * post source pour récupérer l'ID du son et reconstruire le lien STABLE vers la
 * page « son », puis on met à jour le sujet ET les posts qui en découlent (un
 * recopiage réutilise le sujet, donc corriger la source corrige aussi le futur).
 *
 * Opération ponctuelle, déclenchée à la main depuis le Pilotage. Facturée
 * (Apify), mais un seul re-scrape par sujet concerné.
 */
Deno.serve(async (request) => {
  const denied = await assertAuthorised(request);
  if (denied) return denied;

  const supabase = serviceClient();

  try {
    const { data: sujets } = await supabase
      .from("sujets")
      .select("id, source_url, musique_url")
      .not("source_url", "is", null)
      .like("musique_url", "%tiktokcdn%");

    let corriges = 0;
    const echecs: string[] = [];

    for (const sujet of sujets ?? []) {
      try {
        const [post] = await scrapePost(sujet.source_url!);
        // Pas d'ID récupérable (toujours un lien CDN) : rien à gagner.
        if (!post?.musicUrl || post.musicUrl.includes("tiktokcdn")) {
          echecs.push(sujet.id);
          continue;
        }

        await supabase
          .from("sujets")
          .update({ musique_url: post.musicUrl, musique_titre: post.musicTitle })
          .eq("id", sujet.id);
        await supabase
          .from("posts")
          .update({ musique_url: post.musicUrl, musique_titre: post.musicTitle })
          .eq("sujet_id", sujet.id);

        corriges += 1;
      } catch (error) {
        echecs.push(`${sujet.id}: ${messageErreur(error)}`);
      }
    }

    return json({ ok: true, examines: sujets?.length ?? 0, corriges, echecs: echecs.length });
  } catch (error) {
    return json({ ok: false, error: messageErreur(error) }, 500);
  }
});
