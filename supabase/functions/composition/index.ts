import { avancerPost } from "../_shared/composer.ts";
import { assertAuthorised, json, serviceClient } from "../_shared/supabase.ts";

/**
 * Fait avancer un post en cours de fabrication d'une étape, puis rend la main.
 * L'assignation ne fait que créer les coquilles ; c'est ce drain, appelé chaque
 * minute par le cron, qui les remplit.
 *
 *   {}           → le post le plus ancien restant à fabriquer
 *   { postId }   → ce post précis (essai admin)
 */
Deno.serve(async (request) => {
  const denied = await assertAuthorised(request);
  if (denied) return denied;

  const supabase = serviceClient();

  let postId: string | null = null;
  try {
    const body = await request.json();
    postId = body?.postId ?? null;
  } catch {
    // Corps vide : on prend la file.
  }

  try {
    let query = supabase
      .from("posts")
      .select("*")
      .in("pipeline_statut", ["running", "pending"]);

    if (postId) query = query.eq("id", postId);
    else query = query.order("pipeline_statut", { ascending: false }).order("created_at");

    const { data: posts } = await query.limit(1);
    const post = posts?.[0];
    if (!post) return json({ ok: true, idle: true });

    const etape = await avancerPost(supabase, post);
    return json({ ok: true, postId: post.id, etape });
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
