import { falLlmTexte } from "../_shared/fal_llm.ts";
import { promptAmeliorerReview, REVIEW_AMELIORER_MAX } from "../_shared/ameliorer_review.ts";
import { assertRole, json, messageErreur } from "../_shared/supabase.ts";

const MODELES = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash"];

/**
 * Réécrit une review admin → anglais, forme / fautes / phrases.
 * Text-to-text uniquement. Ne persiste rien : le front envoie ensuite.
 *
 *   { texte } → { ok, texte }
 */
Deno.serve(async (request) => {
  const acces = await assertRole(request, ["admin"]);
  if (acces instanceof Response) return acces;

  try {
    const body = await request.json();
    const brut = String(body?.texte ?? "").trim();
    if (!brut) return json({ error: "Texte vide" }, 400);
    const texte = brut.slice(0, REVIEW_AMELIORER_MAX);

    let dernier = "";
    for (const model of MODELES) {
      try {
        const out = (await falLlmTexte({
          prompt: promptAmeliorerReview(texte),
          model,
          temperature: 0.2,
        })).trim();
        if (out) return json({ ok: true, texte: out });
        dernier = "réponse vide";
      } catch (err) {
        dernier = messageErreur(err);
      }
    }
    return json({ ok: false, error: dernier || "Amélioration indisponible" }, 502);
  } catch (error) {
    return json({ ok: false, error: messageErreur(error) }, 500);
  }
});
