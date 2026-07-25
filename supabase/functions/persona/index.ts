import { avatarPourSource } from "../_shared/avatar.ts";
import {
  appliquerIdentiteInstantanee,
  genererIdentite,
  type Genre,
} from "../_shared/persona.ts";
import { assertAuthorised, json, messageErreur, serviceClient } from "../_shared/supabase.ts";

/**
 * Identité d'un compte de publication : @ « prenom.mot-culture+chiffres » selon
 * le GENRE du compte de référence (toggle homme/femme sur la page source) + nom
 * « Prénom Nom » + bio + avatar. 100 % déterministe et instantané (aucun Gemini).
 *
 *   { compteId }              → proposition (aperçu, sans appliquer)
 *   { compteId, appliquer }   → applique l'identité sur le compte
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
    // Appliquer : on passe par le chemin instantané partagé (lit le genre de la
    // référence, ne remplit que ce qui manque), puis on relit l'état pour le front.
    if (appliquer) {
      const { handle } = await appliquerIdentiteInstantanee(supabase, compteId);
      const { data: c } = await supabase
        .from("comptes")
        .select("handle_tiktok, persona_nom, persona_bio, avatar_url")
        .eq("id", compteId)
        .single();
      return json({
        ok: true,
        pseudos: c?.handle_tiktok ? [c.handle_tiktok] : [],
        nom: c?.persona_nom ?? null,
        bio: c?.persona_bio ?? "",
        avatarUrl: c?.avatar_url ?? null,
        handle: handle ?? c?.handle_tiktok ?? null,
        applique: true,
      });
    }

    // Proposition : on génère une identité candidate SANS l'appliquer.
    const { data: compte, error } = await supabase
      .from("comptes")
      .select("langue, compte_reference_id, comptes_reference(genre)")
      .eq("id", compteId)
      .single();
    if (error || !compte) return json({ error: "Compte introuvable" }, 404);

    // deno-lint-ignore no-explicit-any
    const genre: Genre = (compte as any).comptes_reference?.genre === "homme" ? "homme" : "femme";
    const identite = await genererIdentite(supabase, compte.langue, genre);
    const avatar = await avatarPourSource(supabase, compte.compte_reference_id);

    return json({
      ok: true,
      pseudos: [identite.handle],
      nom: identite.nom,
      bio: identite.bio,
      avatarUrl: avatar?.url ?? null,
      handle: null,
      applique: false,
    });
  } catch (error) {
    return json({ ok: false, error: messageErreur(error) }, 500);
  }
});
