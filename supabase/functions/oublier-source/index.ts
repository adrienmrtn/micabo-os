import {
  LOT_CONTENUS_DEFAUT,
  apercuOubli,
  oublierSourceLot,
} from "../_shared/oubli_source.ts";
import { assertAuthorised, json, messageErreur, serviceClient } from "../_shared/supabase.ts";

/**
 * « Oublier » un compte source : efface tout ce qu'il a produit (slideshows,
 * images, posts, sujets legacy, file d'import, fichiers du bucket) puis la
 * ligne `comptes_reference`, pour repartir sur un import vierge.
 *
 *   { compteReferenceId, apercu: true } → ce qui sera détruit, sans rien toucher
 *   { compteReferenceId, lot? }         → un passage ; rappeler tant que !termine
 *
 * Admin uniquement (`assertAuthorised`). Le travail est découpé en passages :
 * un compte à 100 slideshows ne tiendrait pas dans les ~150 s de l'Edge.
 */
Deno.serve(async (request) => {
  const denied = await assertAuthorised(request);
  if (denied) return denied;

  const supabase = serviceClient();

  let corps: { compteReferenceId?: string; apercu?: boolean; lot?: number } = {};
  try {
    corps = await request.json();
  } catch {
    // corps vide
  }

  const compteReferenceId = corps.compteReferenceId ?? null;
  if (!compteReferenceId) return json({ error: "compteReferenceId requis" }, 400);

  try {
    if (corps.apercu) {
      const apercu = await apercuOubli(supabase, compteReferenceId);
      if (!apercu) return json({ error: "Compte source introuvable" }, 404);
      return json({ ok: true, apercu });
    }

    const brut = Number(corps.lot ?? LOT_CONTENUS_DEFAUT);
    const lot = Number.isFinite(brut) ? Math.min(60, Math.max(1, Math.floor(brut))) : LOT_CONTENUS_DEFAUT;
    const r = await oublierSourceLot(supabase, compteReferenceId, lot);
    return json({ ok: true, ...r });
  } catch (error) {
    return json({ ok: false, error: messageErreur(error) }, 500);
  }
});
