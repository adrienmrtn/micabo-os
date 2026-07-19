import { downloadImage } from "../_shared/apify.ts";
import { cleanImage } from "../_shared/gemini.ts";
import { assertAuthorised, json, serviceClient } from "../_shared/supabase.ts";

/**
 * Utilitaire d'administration et de diagnostic.
 *   ?list=1    → modèles Gemini accessibles avec la clé configurée
 *   ?helper=1  → teste cleanImage() sur une vraie slide
 *   ?repair=1  → rapatrie dans le Storage les visuels encore hébergés chez
 *                Apify (qui répond 403 sans token et purge ses données)
 */
Deno.serve(async (request) => {
  const denied = await assertAuthorised(request);
  if (denied) return denied;

  const url = new URL(request.url);
  const key = Deno.env.get("GEMINI_API_KEY");

  if (url.searchParams.get("repair")) {
    const supabase = serviceClient();

    const { data: frames } = await supabase
      .from("slideshow_frames")
      .select("id, slideshow_id, position, original_url, cleaned_url")
      .like("original_url", "https://api.apify.com/%");

    let repaired = 0;
    const failures: string[] = [];

    for (const frame of frames ?? []) {
      try {
        const bytes = await downloadImage(frame.original_url);
        const path = `${frame.slideshow_id}/original-${frame.position}.jpg`;

        const { error } = await supabase.storage
          .from("slideshow-media")
          .upload(path, bytes, { contentType: "image/jpeg", upsert: true });
        if (error) throw error;

        const publicUrl = supabase.storage
          .from("slideshow-media")
          .getPublicUrl(path).data.publicUrl;

        // Le cleaned_url qui pointait encore vers Apify suivait le même repli :
        // on le réaligne, sauf s'il désigne déjà une image nettoyée chez nous.
        const patch: Record<string, string> = { original_url: publicUrl };
        if (!frame.cleaned_url || frame.cleaned_url.startsWith("https://api.apify.com/")) {
          patch.cleaned_url = publicUrl;
        }

        await supabase.from("slideshow_frames").update(patch).eq("id", frame.id);
        repaired += 1;
      } catch (error) {
        failures.push(error instanceof Error ? error.message : String(error));
      }
    }

    return json({ repaired, total: frames?.length ?? 0, failures: failures.slice(0, 5) });
  }

  // Mesure le taux de réussite réel du nettoyage sur un échantillon de slides,
  // pour pouvoir annoncer un chiffre plutôt qu'une impression.
  if (url.searchParams.get("bench")) {
    const supabase = serviceClient();
    const size = Number(url.searchParams.get("bench")) || 5;

    const { data: frames } = await supabase
      .from("slideshow_frames")
      .select("id, original_url")
      .not("original_url", "is", null)
      .limit(size);

    let ok = 0;
    let refused = 0;
    for (const frame of frames ?? []) {
      try {
        (await cleanImage(frame.original_url)) ? ok++ : refused++;
      } catch {
        refused++;
      }
    }

    return json({ tested: frames?.length ?? 0, cleaned: ok, refused });
  }

  if (!key) return json({ error: "GEMINI_API_KEY manquant" }, 500);

  if (url.searchParams.get("list")) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${key}&pageSize=200`,
    );
    const data = await response.json();
    // deno-lint-ignore no-explicit-any
    const models = (data.models ?? []).map((m: any) => ({
      name: m.name?.replace("models/", ""),
      methods: m.supportedGenerationMethods,
    }));
    return json({ count: models.length, models });
  }

  const supabase = serviceClient();
  const { data: frame } = await supabase
    .from("slideshow_frames")
    .select("original_url")
    .not("original_url", "is", null)
    .limit(1)
    .single();

  if (!frame?.original_url) return json({ error: "aucune slide en base" }, 404);

  try {
    const result = await cleanImage(frame.original_url);
    return json({ helper: "cleanImage", returnedImage: result !== null });
  } catch (error) {
    return json({
      helper: "cleanImage",
      threw: error instanceof Error ? error.message : String(error),
    });
  }
});
