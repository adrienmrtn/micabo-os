import { genererPersona } from "../_shared/gemini.ts";
import { assertAuthorised, json, messageErreur, serviceClient } from "../_shared/supabase.ts";

type Supabase = ReturnType<typeof serviceClient>;

/**
 * Propose une identité pour un compte de publication : pseudos, bio, avatar.
 *
 *   { compteId }              → propositions seulement
 *   { compteId, appliquer }   → applique la première proposition retenue
 */
Deno.serve(async (request) => {
  const denied = await assertAuthorised(request);
  if (denied) return denied;

  const supabase = serviceClient();

  let compteId: string | null = null;
  let appliquer = false;
  try {
    const body = await request.json();
    compteId = body?.compteId ?? null;
    appliquer = Boolean(body?.appliquer);
  } catch {
    return json({ error: "corps JSON attendu" }, 400);
  }

  if (!compteId) return json({ error: "compteId requis" }, 400);

  try {
    const { data: compte, error } = await supabase
      .from("comptes")
      .select("*, comptes_reference(handle_tiktok, niche)")
      .eq("id", compteId)
      .single();
    if (error || !compte) return json({ error: "Compte introuvable" }, 404);

    // deno-lint-ignore no-explicit-any
    const reference = (compte as any).comptes_reference;

    const proposition = await genererPersona({
      niche: reference?.niche ?? "",
      langue: compte.langue,
    });
    if (!proposition) return json({ error: "Génération impossible" }, 502);

    const pseudos = await filtrerPseudos(
      supabase,
      proposition.pseudos,
      reference?.handle_tiktok ?? "",
    );

    const avatar = await choisirAvatar(supabase, compte.compte_reference_id);

    if (appliquer && pseudos.length > 0) {
      await supabase
        .from("comptes")
        .update({
          handle_tiktok: pseudos[0],
          persona_nom: compte.persona_nom ?? pseudos[0],
          persona_bio: proposition.bio,
          avatar_url: avatar?.url ?? compte.avatar_url,
          avatar_source: avatar ? "bibliotheque" : compte.avatar_source,
        })
        .eq("id", compteId);

      if (avatar) {
        await supabase
          .from("media_library")
          .update({ used_count: avatar.used_count + 1 })
          .eq("id", avatar.id);
      }
    }

    return json({
      ok: true,
      pseudos,
      bio: proposition.bio,
      avatarUrl: avatar?.url ?? null,
      applique: appliquer && pseudos.length > 0,
    });
  } catch (error) {
    return json({ ok: false, error: messageErreur(error) }, 500);
  }
});

/** Découpe un handle en mots significatifs, pour comparer des racines. */
function racines(handle: string): string[] {
  return handle
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((mot) => mot.length >= 4);
}

/**
 * Écarte les pseudos qui trahiraient la source ou qui existent déjà.
 *
 * Un pseudo partageant une racine avec le compte de référence rendrait le lien
 * devinable pour qui compare les deux comptes : c'est exactement ce que la
 * séparation stricte cherche à éviter.
 */
async function filtrerPseudos(
  supabase: Supabase,
  candidats: string[],
  handleReference: string,
): Promise<string[]> {
  const interdites = racines(handleReference);

  const sansEcho = candidats.filter((pseudo) => {
    const mots = racines(pseudo);
    return !mots.some((mot) =>
      interdites.some((racine) => mot.includes(racine) || racine.includes(mot)),
    );
  });

  if (sansEcho.length === 0) return [];

  const { data: pris } = await supabase
    .from("comptes")
    .select("handle_tiktok")
    .in("handle_tiktok", sansEcho);

  const dejaPris = new Set((pris ?? []).map((c) => c.handle_tiktok));
  return sansEcho.filter((pseudo) => !dejaPris.has(pseudo));
}

/** Le moins utilisé parmi les visuels sans visage identifiable. */
async function choisirAvatar(supabase: Supabase, compteReferenceId: string | null) {
  let query = supabase
    .from("media_library")
    .select("id, url, used_count")
    // `is false` et non `not is true` : une valeur indécise (null) reste exclue,
    // le doute vaut refus pour une photo de profil.
    .eq("visage_identifiable", false)
    .order("used_count")
    .limit(1);

  if (compteReferenceId) query = query.eq("compte_reference_id", compteReferenceId);

  const { data } = await query;
  return data?.[0] ?? null;
}
