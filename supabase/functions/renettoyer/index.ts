import { cleanImage, verifyClean } from "../_shared/gemini.ts";
import { assertAuthorised, json, messageErreur, serviceClient } from "../_shared/supabase.ts";

const BUCKET = "medias";

/**
 * Re-nettoie la photo d'UNE slide, à la demande de l'admin.
 *
 * Jamais appelé par un cron : c'est une action manuelle, sur un seul visuel,
 * quand le nettoyage automatique a laissé du texte ou rien produit. On repart
 * toujours de l'original (`reference_url`), jamais d'une version déjà retouchée.
 *
 *   { postSlideId }
 */
Deno.serve(async (request) => {
  const denied = await assertAuthorised(request);
  if (denied) return denied;

  const supabase = serviceClient();

  let postSlideId: string | null = null;
  try {
    postSlideId = (await request.json())?.postSlideId ?? null;
  } catch {
    // corps vide
  }
  if (!postSlideId) return json({ error: "postSlideId requis" }, 400);

  try {
    const { data: slide } = await supabase
      .from("post_slides")
      .select("id, position, reference_url, post_id")
      .eq("id", postSlideId)
      .single();
    if (!slide) return json({ error: "slide introuvable" }, 404);
    if (!slide.reference_url) return json({ error: "pas d'original à nettoyer" }, 400);

    const { data: post } = await supabase
      .from("posts")
      .select("compte_id")
      .eq("id", slide.post_id)
      .single();

    const propreBase64 = await cleanImage(slide.reference_url);
    if (!propreBase64) return json({ ok: false, nettoyee: false, motif: "aucune image renvoyée" });

    const sansTexte = await verifyClean(propreBase64, "image/png");

    // Chemin stable par slide : re-nettoyer deux fois écrase, pas d'accumulation.
    const path = `propre/manuel/${slide.id}.png`;
    const bytes = Uint8Array.from(atob(propreBase64), (c) => c.charCodeAt(0));
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType: "image/png", upsert: true });
    if (upErr) throw upErr;

    const url = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

    const { data: media, error: insErr } = await supabase
      .from("media_library")
      .upsert(
        {
          compte_id: post?.compte_id ?? null,
          storage_path: path,
          url,
          source: "nettoye_reference",
          visage_identifiable: null,
        },
        { onConflict: "storage_path" },
      )
      .select("id")
      .single();
    if (insErr) throw insErr;

    await supabase
      .from("post_slides")
      .update({ media_id: media.id })
      .eq("id", slide.id);

    return json({ ok: true, nettoyee: true, verifie_sans_texte: sansTexte, url });
  } catch (error) {
    return json({ ok: false, nettoyee: false, erreur: messageErreur(error) }, 500);
  }
});
