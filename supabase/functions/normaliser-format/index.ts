import { uniformiserFormatsContenu } from "../_shared/format_media.ts";
import { assertAuthorised, json, messageErreur, serviceClient } from "../_shared/supabase.ts";

/**
 * Ramène toutes les photos d'un slideshow au ratio dominant du diaporama.
 *
 * Le recadrage passe par le transformateur de Storage, pas par un décodage
 * Deno : aucune image n'est ouverte en mémoire ici (cf. `format_media.ts`).
 * Les posts déjà assignés suivent, les médias étant réécrits en place.
 *
 *   { contenuId, positions?: number[] }
 */
Deno.serve(async (request) => {
  const denied = await assertAuthorised(request);
  if (denied) return denied;

  const supabase = serviceClient();

  let corps: { contenuId?: string; positions?: number[] } = {};
  try {
    corps = await request.json();
  } catch {
    // corps vide
  }

  const contenuId = corps.contenuId ?? null;
  if (!contenuId) return json({ ok: false, error: "contenuId requis" }, 400);

  const positions = Array.isArray(corps.positions)
    ? corps.positions.map(Number).filter((p) => Number.isFinite(p))
    : undefined;

  try {
    const rapport = await uniformiserFormatsContenu(supabase, contenuId, {
      positions: positions?.length ? positions : undefined,
    });
    return json({ ok: true, ...rapport });
  } catch (error) {
    return json({ ok: false, contenuId, error: messageErreur(error) }, 500);
  }
});
