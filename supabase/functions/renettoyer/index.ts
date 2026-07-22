import { cleanImage, verifyClean } from "../_shared/gemini.ts";
import { assertAuthorised, json, messageErreur, serviceClient } from "../_shared/supabase.ts";

type Supabase = ReturnType<typeof serviceClient>;
const BUCKET = "medias";

/**
 * Re-nettoie la photo d'UNE slide, à la demande de l'admin.
 *
 * On repart toujours de l'original (`reference_url`). Si le nettoyage échoue
 * vraiment (refus, texte résiduel, aucune image), on NE laisse pas la slide en
 * plan : on la remplace par un autre visuel DÉJÀ propre de la bibliothèque du
 * compte de référence. Le poster a toujours une photo utilisable.
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

    const { data: post } = await supabase
      .from("posts")
      .select("compte_id, comptes(compte_reference_id)")
      .eq("id", slide.post_id)
      .single();
    // deno-lint-ignore no-explicit-any
    const refId = (post as any)?.comptes?.compte_reference_id ?? null;

    // 1 — Tentative de nettoyage (proxy Lovable en priorité, cf. cleanImage).
    if (slide.reference_url) {
      try {
        // On re-vérifie la sortie : le proxy renvoie parfois l'image SANS l'avoir
        // nettoyée. Si du texte reste, on ne la garde pas → on passe au
        // remplacement par une photo propre de la bibliothèque.
        const propreBase64 = await cleanImage(slide.reference_url);
        if (propreBase64 && (await verifyClean(propreBase64, "image/png"))) {
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
              { compte_id: post?.compte_id ?? null, storage_path: path, url, source: "nettoye_reference", visage_identifiable: null },
              { onConflict: "storage_path" },
            )
            .select("id")
            .single();
          if (insErr) throw insErr;

          await supabase.from("post_slides").update({ media_id: media.id }).eq("id", slide.id);
          return json({ ok: true, nettoyee: true });
        }
      } catch (error) {
        console.warn(`[renettoyer] nettoyage échoué, on remplace : ${messageErreur(error)}`);
      }
    }

    // 2 — Le nettoyage n'a rien donné : on remplace par un visuel déjà propre
    // de la bibliothèque du compte.
    const alt = await visuelPropreDeSecours(supabase, refId, slide.post_id);
    if (alt) {
      await supabase.from("post_slides").update({ media_id: alt }).eq("id", slide.id);
      return json({ ok: true, nettoyee: false, remplacee: true });
    }

    return json({
      ok: false,
      nettoyee: false,
      motif: "nettoyage impossible et aucune photo propre de rechange dans la bibliothèque du compte",
    });
  } catch (error) {
    return json({ ok: false, nettoyee: false, erreur: messageErreur(error) }, 500);
  }
});

/**
 * Un visuel DÉJÀ nettoyé de la bibliothèque du compte de référence, de
 * préférence pas déjà utilisé sur ce post (pour éviter un doublon visuel) et le
 * moins utilisé possible.
 */
async function visuelPropreDeSecours(
  supabase: Supabase,
  refId: string | null,
  postId: string,
): Promise<string | null> {
  const { data: slides } = await supabase
    .from("post_slides")
    .select("media_id")
    .eq("post_id", postId);
  const dejaUtilises = new Set((slides ?? []).map((s) => s.media_id).filter(Boolean));

  let query = supabase
    .from("media_library")
    .select("id")
    .like("storage_path", "propre/%")
    .order("used_count", { ascending: true })
    .limit(30);
  if (refId) query = query.eq("compte_reference_id", refId);

  const { data } = await query;
  const liste = (data ?? []).map((m) => m.id);
  return liste.find((id) => !dejaUtilises.has(id)) ?? liste[0] ?? null;
}
