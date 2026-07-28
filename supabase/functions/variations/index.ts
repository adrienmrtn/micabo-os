import { avancerVariations } from "../_shared/variations.ts";
import { assertAuthorised, json, messageErreur, serviceClient } from "../_shared/supabase.ts";

/**
 * Variations v-next : un contenu qui dépasse le seuil de perf (score + passages
 * + âge) engendre un remix (texte reformulé + autres visuels du label).
 *
 * Cap lignée : profondeur < variation_profondeur_max (défaut 2).
 * Une seule variation directe par (parent, langue).
 *
 *   {}  → traite UN candidat (drain)
 */
Deno.serve(async (request) => {
  const denied = await assertAuthorised(request);
  if (denied) return denied;

  const supabase = serviceClient();

  try {
    const { data: flag } = await supabase
      .from("reglages")
      .select("valeur")
      .eq("cle", "moteur_vnext")
      .maybeSingle();
    const actif = Boolean((flag?.valeur as { actif?: boolean } | null)?.actif);

    // deno-lint-ignore no-explicit-any
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      // vide
    }

    if (!actif && !body?.forcer) {
      return json({ ok: true, saute: true, raison: "moteur_vnext inactif" });
    }

    const r = await avancerVariations(supabase);
    return json({ ok: true, ...r });
  } catch (error) {
    return json({ ok: false, error: messageErreur(error) }, 500);
  }
});
