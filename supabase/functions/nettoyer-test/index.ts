import { cleanImage } from "../_shared/gemini.ts";
import { assertAuthorised, json, messageErreur, serviceClient } from "../_shared/supabase.ts";

const BUCKET = "medias";

/**
 * Nettoyage de TEST, non destructif : nettoie une image et dépose le résultat
 * sous `test/`, sans toucher à la bibliothèque ni aux posts. Sert à l'écran
 * « Test nettoyage » pour comparer avant/après sans rien casser.
 *
 *   { url }  → { ok, url }  (url = image nettoyée)
 */
Deno.serve(async (request) => {
  const denied = await assertAuthorised(request);
  if (denied) return denied;

  let url: string | null = null;
  try {
    url = (await request.json())?.url ?? null;
  } catch {
    // corps vide
  }
  if (!url) return json({ error: "url requise" }, 400);

  try {
    const propre = await cleanImage(url);
    if (!propre) return json({ ok: false, motif: "aucune image renvoyée" });

    const supabase = serviceClient();
    const chemin = `test/${crypto.randomUUID()}.png`;
    const bytes = Uint8Array.from(atob(propre.base64), (c) => c.charCodeAt(0));
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(chemin, bytes, { contentType: "image/png", upsert: true });
    if (error) throw error;

    const publique = supabase.storage.from(BUCKET).getPublicUrl(chemin).data.publicUrl;
    return json({ ok: true, url: publique, moteur: propre.moteur });
  } catch (error) {
    return json({ ok: false, erreur: messageErreur(error) }, 500);
  }
});
