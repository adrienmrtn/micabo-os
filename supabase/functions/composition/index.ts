import { avancerPost, creerPost } from "../_shared/composer.ts";
import { assertAuthorised, json, serviceClient } from "../_shared/supabase.ts";

/**
 * Fait avancer un post en cours de fabrication d'une étape, puis rend la main.
 * L'assignation ne fait que créer les coquilles ; c'est ce drain, appelé chaque
 * minute par le cron, qui les remplit.
 *
 *   {}                       → le post le plus ancien restant à fabriquer
 *   { postId }               → ce post précis (essai admin)
 *   { compteId, sujetId }    → crée la coquille à la main, hors assignation
 */
Deno.serve(async (request) => {
  const denied = await assertAuthorised(request);
  if (denied) return denied;

  const supabase = serviceClient();

  // deno-lint-ignore no-explicit-any
  let body: any = null;
  try {
    body = await request.json();
  } catch {
    // Corps vide : on prend la file.
  }
  const postId: string | null = body?.postId ?? null;

  try {
    // Création manuelle : l'admin choisit lui-même compte, sujet et date. La
    // coquille rejoint la file, le drain la remplit comme les autres.
    if (!postId && body?.compteId && body?.sujetId) {
      const cree = await creerPost(supabase, {
        compteId: body.compteId,
        sujetId: body.sujetId,
        type: body.type ?? "nouveau",
        date: body.date ?? new Date().toISOString().slice(0, 10),
      });
      return json({ ok: true, postId: cree, cree: true });
    }

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
