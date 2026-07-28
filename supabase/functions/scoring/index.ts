import { majScoresDepuisPassages } from "../_shared/scoring.ts";
import { assertAuthorised, json, messageErreur, serviceClient } from "../_shared/supabase.ts";

/**
 * MAJ des scores v-next à partir des passages récemment relevés.
 *
 *   {}             → tous les passages des ~36 dernières heures
 *   { compteId }   → restreint à ce compte
 *   { depuisHeures }
 */
Deno.serve(async (request) => {
  const denied = await assertAuthorised(request);
  if (denied) return denied;

  const supabase = serviceClient();
  // deno-lint-ignore no-explicit-any
  let body: any = {};
  try {
    body = await request.json();
  } catch {
    // vide
  }

  try {
    const r = await majScoresDepuisPassages(supabase, {
      compteId: body?.compteId ?? null,
      depuisHeures: body?.depuisHeures ?? 36,
    });
    return json({ ok: true, ...r });
  } catch (error) {
    return json({ ok: false, error: messageErreur(error) }, 500);
  }
});
