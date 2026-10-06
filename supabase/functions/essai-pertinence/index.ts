/**
 * Essai à blanc de la note de pertinence (02/10/2026) : le prompt de la clé
 * `cle` sur des slideshows déjà importés, SANS RIEN ÉCRIRE.
 *
 *   { contenuIds: string[], cle?: string } → { ok, resultats: [{ id, avant, apres, raison }] }
 *
 * Le hook et la légende sont ceux que l'import a notés (`structure_slides[0]
 * .texte_original` et `titre`), donc la seule variable est le prompt. Sert à
 * comparer une nouvelle consigne à l'ancienne note avant de basculer
 * `pertinence_micabo`.
 */

import { scoreRelevance } from "../_shared/gemini.ts";
import { assertAuthorised, chargerPrompt, json, messageErreur, serviceClient } from "../_shared/supabase.ts";

const PARALLELE = 4;

Deno.serve(async (request) => {
  const denied = await assertAuthorised(request);
  if (denied) return denied;

  const supabase = serviceClient();
  try {
    const corps = await request.json().catch(() => ({}));
    const ids = (Array.isArray(corps?.contenuIds) ? corps.contenuIds : []).map(String).slice(0, 40);
    const cle = String(corps?.cle ?? "pertinence_micabo_v2");
    if (ids.length === 0) return json({ ok: false, error: "contenuIds manquant" }, 400);
    const consigne = await chargerPrompt(supabase, cle);
    if (!consigne) return json({ ok: false, error: `prompt ${cle} introuvable` }, 404);

    const { data, error } = await supabase
      .from("contenus")
      .select("id, titre, structure_slides, pertinence_score")
      .in("id", ids);
    if (error) throw error;
    const contenus = (data ?? []) as Array<{
      id: string;
      titre: string | null;
      structure_slides: Array<{ position: number; texte_original?: string | null }> | null;
      pertinence_score: number | null;
    }>;

    const resultats: Array<Record<string, unknown>> = [];
    let i = 0;
    async function suivant(): Promise<void> {
      while (i < contenus.length) {
        const c = contenus[i++];
        const hook = [...(c.structure_slides ?? [])].sort((a, b) => a.position - b.position)[0]?.texte_original ?? "";
        try {
          const { score, reason } = await scoreRelevance({
            caption: c.titre ?? "",
            hookText: hook,
            instructions: consigne,
          });
          resultats.push({ id: c.id, avant: c.pertinence_score, apres: score, raison: reason });
        } catch (e) {
          resultats.push({ id: c.id, avant: c.pertinence_score, erreur: messageErreur(e).slice(0, 300) });
        }
      }
    }
    await Promise.all(Array.from({ length: Math.min(PARALLELE, contenus.length) }, () => suivant()));
    return json({ ok: true, cle, resultats });
  } catch (e) {
    return json({ ok: false, error: messageErreur(e) }, 500);
  }
});
