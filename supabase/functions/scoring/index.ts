import { majScoresDepuisPassages } from "../_shared/scoring.ts";
import { assertAuthorised, json, messageErreur } from "../_shared/supabase.ts";

/**
 * Ancienne MAJ des scores `contenu_langues`.
 *
 * Retirée au passage en tierlist : les slideshows n'ont plus de score par
 * langue. La fonction répond toujours (cron / appels historiques) mais ne
 * touche plus rien — la requalification se fait dans `rattrapage-elo`.
 */
Deno.serve(async (request) => {
  const denied = await assertAuthorised(request);
  if (denied) return denied;

  // Corps ignoré : la fonction ne fait plus rien.
  try {
    await request.json();
  } catch {
    // vide
  }

  try {
    const r = majScoresDepuisPassages();
    return json({ ok: true, ...r });
  } catch (error) {
    return json({ ok: false, error: messageErreur(error) }, 500);
  }
});
