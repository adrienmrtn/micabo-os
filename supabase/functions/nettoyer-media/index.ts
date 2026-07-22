import { cleanImage, verifyClean } from "../_shared/gemini.ts";
import { assertAuthorised, json, messageErreur, serviceClient } from "../_shared/supabase.ts";

const BUCKET = "medias";

/**
 * Nettoie une photo de la bibliothèque à la demande de l'admin, en place.
 *
 * On part de l'URL actuelle du média (pour un `brut/…`, c'est l'original avec
 * son texte) et on écrit le résultat vérifié dans `propre/…`. La MÊME ligne
 * bascule alors de brut à propre : toutes les slides qui la pointaient reçoivent
 * la version nettoyée sans autre manipulation.
 *
 *   { mediaId }
 */
Deno.serve(async (request) => {
  const denied = await assertAuthorised(request);
  if (denied) return denied;

  const supabase = serviceClient();

  let mediaId: string | null = null;
  try {
    mediaId = (await request.json())?.mediaId ?? null;
  } catch {
    // corps vide
  }
  if (!mediaId) return json({ error: "mediaId requis" }, 400);

  try {
    const { data: media } = await supabase
      .from("media_library")
      .select("id, url, storage_path")
      .eq("id", mediaId)
      .single();
    if (!media) return json({ error: "média introuvable" }, 404);

    if (media.storage_path.startsWith("propre/")) {
      return json({ ok: true, nettoyee: true, note: "déjà nettoyée" });
    }

    const propreBase64 = await cleanImage(media.url);
    if (!propreBase64) return json({ ok: false, nettoyee: false, motif: "aucune image renvoyée" });
    // Le proxy renvoie parfois l'image non nettoyée en disant « réussi » : on
    // vérifie qu'il n'y a plus de texte avant de la marquer propre.
    if (!(await verifyClean(propreBase64, "image/png"))) {
      return json({ ok: false, nettoyee: false, motif: "texte encore présent après nettoyage" });
    }

    const path = `propre/manuel/${media.id}.png`;
    const bytes = Uint8Array.from(atob(propreBase64), (c) => c.charCodeAt(0));
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType: "image/png", upsert: true });
    if (upErr) throw upErr;

    const url = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

    const { error: majErr } = await supabase
      .from("media_library")
      .update({ storage_path: path, url })
      .eq("id", media.id);
    if (majErr) throw majErr;

    return json({ ok: true, nettoyee: true, url });
  } catch (error) {
    return json({ ok: false, nettoyee: false, erreur: messageErreur(error) }, 500);
  }
});
