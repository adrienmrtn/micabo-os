import { downloadImage, scrapeProfile } from "../_shared/apify.ts";
import { assertAuthorised, json, serviceClient } from "../_shared/supabase.ts";

const POSTS_PER_ACCOUNT = 5;

/**
 * Scanne les comptes de référence actifs et crée les slideshows manquants.
 *
 * Les comptes assignés à un poster qui n'a rien pour aujourd'hui passent en
 * premier : produire pour quelqu'un qui va poster vaut mieux que remplir le
 * stock de quelqu'un qui est déjà servi.
 */
Deno.serve(async (request) => {
  const denied = await assertAuthorised(request);
  if (denied) return denied;

  const supabase = serviceClient();

  // Un accountId dans le corps restreint le scan à ce seul compte : c'est le
  // mode « essai » de l'admin, qui évite de payer un scan complet pour tester.
  let onlyAccountId: string | null = null;
  try {
    const body = await request.json();
    onlyAccountId = body?.accountId ?? null;
  } catch {
    // Corps vide ou non-JSON : scan complet.
  }

  const { data: run } = await supabase
    .from("discovery_runs")
    .insert({ status: "running" })
    .select()
    .single();

  let scanned = 0;
  let created = 0;

  try {
    let query = supabase
      .from("tiktok_accounts")
      .select("id, handle")
      .eq("is_reference", true);

    // Un essai ciblé ignore `is_active` : on teste le compte demandé, point.
    if (onlyAccountId) query = query.eq("id", onlyAccountId);
    else query = query.eq("is_active", true);

    const { data: accounts, error } = await query;
    if (error) throw error;

    const prioritised = onlyAccountId
      ? (accounts ?? [])
      : await prioritise(supabase, accounts ?? []);

    for (const account of prioritised) {
      scanned += 1;
      const posts = await scrapeProfile(account.handle, POSTS_PER_ACCOUNT);

      for (const post of posts) {
        // source_url identifie le post de façon stable : c'est ce qui évite de
        // recréer le même slideshow à chaque passage du cron.
        const { data: existing } = await supabase
          .from("slideshows")
          .select("id")
          .eq("source_url", post.webVideoUrl)
          .maybeSingle();

        if (existing) continue;

        const { data: slideshow, error: insertError } = await supabase
          .from("slideshows")
          .insert({
            tiktok_account_id: account.id,
            source_url: post.webVideoUrl,
            title: post.text.slice(0, 120) || null,
            audio_url: post.musicUrl,
            is_auto_generated: true,
            auto_pipeline_status: "pending",
          })
          .select()
          .single();

        if (insertError || !slideshow) continue;

        const frames = [];
        for (const [index, url] of post.imageUrls.entries()) {
          frames.push({
            slideshow_id: slideshow.id,
            position: index + 1,
            original_url: await storeImage(supabase, slideshow.id, index + 1, url),
            clean_status: "pending",
          });
        }

        await supabase.from("slideshow_frames").insert(frames);
        created += 1;
      }
    }

    await supabase
      .from("discovery_runs")
      .update({
        status: "done",
        finished_at: new Date().toISOString(),
        accounts_scanned: scanned,
        slideshows_created: created,
      })
      .eq("id", run?.id);

    return json({ ok: true, scanned, created });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    await supabase
      .from("discovery_runs")
      .update({
        status: "failed",
        finished_at: new Date().toISOString(),
        accounts_scanned: scanned,
        slideshows_created: created,
        error: message,
      })
      .eq("id", run?.id);

    return json({ ok: false, error: message }, 500);
  }
});

/**
 * Rapatrie un visuel dans notre Storage et renvoie son URL publique. En cas
 * d'échec on retombe sur l'URL d'origine : mieux vaut un slideshow avec une
 * image fragile qu'un slideshow perdu.
 */
async function storeImage(
  supabase: ReturnType<typeof serviceClient>,
  slideshowId: string,
  position: number,
  sourceUrl: string,
): Promise<string> {
  try {
    const bytes = await downloadImage(sourceUrl);
    const path = `${slideshowId}/original-${position}.jpg`;

    const { error } = await supabase.storage
      .from("slideshow-media")
      .upload(path, bytes, { contentType: "image/jpeg", upsert: true });

    if (error) throw error;

    return supabase.storage.from("slideshow-media").getPublicUrl(path).data.publicUrl;
  } catch {
    return sourceUrl;
  }
}

/** Comptes dont le poster n'a rien à publier aujourd'hui, en tête de liste. */
async function prioritise(
  supabase: ReturnType<typeof serviceClient>,
  accounts: Array<{ id: string; handle: string }>,
) {
  const today = new Date().toISOString().slice(0, 10);

  const { data: assignments } = await supabase
    .from("assignments")
    .select("poster_id, tiktok_account_id");

  const { data: todaySlideshows } = await supabase
    .from("slideshows")
    .select("poster_id")
    .eq("assigned_date", today);

  const servedPosters = new Set((todaySlideshows ?? []).map((s) => s.poster_id));

  const urgentAccountIds = new Set(
    (assignments ?? [])
      .filter((assignment) => !servedPosters.has(assignment.poster_id))
      .map((assignment) => assignment.tiktok_account_id),
  );

  return [...accounts].sort((a, b) => {
    const aUrgent = urgentAccountIds.has(a.id) ? 0 : 1;
    const bUrgent = urgentAccountIds.has(b.id) ? 0 : 1;
    return aUrgent - bUrgent;
  });
}
