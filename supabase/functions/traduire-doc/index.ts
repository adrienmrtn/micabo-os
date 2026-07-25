import { translateDocumentToEnglish } from "../_shared/gemini.ts";
import { assertRole, json, messageErreur } from "../_shared/supabase.ts";

/**
 * Traduit un document (guide/FAQ) du français vers l'anglais en préservant le
 * HTML. Alimente le bouton « Traduire en anglais » de l'éditeur : l'admin
 * n'écrit qu'en français, la version anglaise est générée. Ne persiste rien —
 * le front enregistre le résultat via majDocument.
 *
 *   { titre, contenu }  → { ok, titre_en, contenu_en }
 */
Deno.serve(async (request) => {
  const acces = await assertRole(request, ["admin"]);
  if (acces instanceof Response) return acces;

  try {
    const body = await request.json();
    const titre = (body?.titre ?? "").toString();
    const contenu = (body?.contenu ?? "").toString();
    if (!titre.trim() && !contenu.trim()) return json({ error: "Document vide" }, 400);

    const out = await translateDocumentToEnglish({ titre, contenuHtml: contenu });
    return json({ ok: true, ...out });
  } catch (error) {
    return json({ ok: false, error: messageErreur(error) }, 500);
  }
});
