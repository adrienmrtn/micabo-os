import { composerPost } from "../_shared/composer.ts";
import { assertAuthorised, json, serviceClient } from "../_shared/supabase.ts";

/**
 * Composition manuelle d'un post, pour l'admin qui veut fabriquer ou refaire un
 * post précis sans attendre le cron.
 *
 *   { compteId, sujetId, type?, date? }
 */
Deno.serve(async (request) => {
  const denied = await assertAuthorised(request);
  if (denied) return denied;

  let body: Record<string, string>;
  try {
    body = await request.json();
  } catch {
    return json({ error: "corps JSON attendu" }, 400);
  }

  if (!body.compteId || !body.sujetId) {
    return json({ error: "compteId et sujetId requis" }, 400);
  }

  try {
    const postId = await composerPost(serviceClient(), {
      compteId: body.compteId,
      sujetId: body.sujetId,
      type: (body.type as "recycle" | "remanie" | "nouveau") ?? "nouveau",
      date: body.date ?? null,
    });

    return json({ ok: true, postId });
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
