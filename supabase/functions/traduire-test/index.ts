import { translateSlideshow } from "../_shared/gemini.ts";
import { assertAuthorised, chargerPrompt, json, messageErreur, serviceClient } from "../_shared/supabase.ts";

/**
 * Test de traduction : traduit un texte donné vers une langue, avec le MÊME
 * prompt que le moteur (traduction_<langue>, ou le prompt « traduction » pour le
 * français, sinon règles neutres). Sert à régler les prompts de traduction sans
 * fabriquer un post entier. Ne crée rien.
 *
 *   { texte, langue }  → { ok, traduction }
 */
Deno.serve(async (request) => {
  const denied = await assertAuthorised(request);
  if (denied) return denied;

  const supabase = serviceClient();

  try {
    const body = await request.json();
    const texte = (body?.texte ?? "").toString();
    const langue = (body?.langue ?? "fr").toString().toLowerCase();
    if (!texte.trim()) return json({ error: "Texte vide" }, 400);

    const dedie = await chargerPrompt(supabase, `traduction_${langue}`);
    const base = dedie ?? (langue === "fr" ? await chargerPrompt(supabase, "traduction") : undefined);

    const out = await translateSlideshow({
      slides: [{ position: 1, original: texte }],
      sourceTitle: "",
      rules: base ?? undefined,
      langue,
    });

    return json({ ok: true, traduction: out[0]?.translated ?? "" });
  } catch (error) {
    return json({ ok: false, error: messageErreur(error) }, 500);
  }
});
