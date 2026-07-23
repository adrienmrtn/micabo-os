import { assertAuthorised, json, messageErreur, serviceClient } from "../_shared/supabase.ts";

/**
 * Révoque un post inutilisable et en refabrique un autre pour le MÊME créateur et
 * la MÊME date. On rejette le SUJET (ce slideshow précis est incohérent pour
 * Sophia) — PAS le hook : un autre post peut commencer pareil et rester bon. Puis
 * on relance l'assignation forcée du jour pour ce compte, qui pioche un sujet
 * différent (le rejeté est écarté).
 *
 *   { postId }  → { ok, newPostId }
 */
Deno.serve(async (request) => {
  const denied = await assertAuthorised(request);
  if (denied) return denied;

  const supabase = serviceClient();

  try {
    const body = await request.json();
    const postId = body?.postId;
    if (!postId) return json({ error: "postId requis" }, 400);

    const { data: post } = await supabase
      .from("posts")
      .select("id, compte_id, date_publication_prevue, sujet_id")
      .eq("id", postId)
      .single();
    if (!post) return json({ error: "Post introuvable" }, 404);

    // 1 — On REJETTE le sujet (le slideshow entier), pas le hook : il ne sera plus
    // repioché par personne. On garde une trace de la raison.
    if (post.sujet_id) {
      await supabase
        .from("sujets")
        .update({
          statut: "rejete",
          pertinence_raison: "Révoqué à la main : incohérent / non intégrable pour Sophia",
        })
        .eq("id", post.sujet_id);
    }

    // 2 — On supprime le post révoqué (les slides tombent en cascade).
    await supabase.from("posts").delete().eq("id", post.id);

    // 3 — On refait un post pour le même compte + date (assignation forcée), qui
    // choisit un sujet DIFFÉRENT (le rejeté est écarté par choisirSujet).
    const secret = Deno.env.get("CRON_SECRET");
    const base = new URL(request.url);
    const urlAssign = `${base.origin}${base.pathname.replace(/revoquer-post\/?$/, "")}assignation`;
    await fetch(urlAssign, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-cron-secret": secret ?? "" },
      body: JSON.stringify({
        compteId: post.compte_id,
        date: post.date_publication_prevue,
        forcer: true,
      }),
    }).catch(() => null);

    // 4 — On récupère l'id du nouveau post (le plus récent du compte à cette date).
    const { data: neuf } = await supabase
      .from("posts")
      .select("id")
      .eq("compte_id", post.compte_id)
      .eq("date_publication_prevue", post.date_publication_prevue)
      .eq("est_test", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return json({ ok: true, newPostId: neuf?.id ?? null });
  } catch (error) {
    return json({ ok: false, error: messageErreur(error) }, 500);
  }
});
