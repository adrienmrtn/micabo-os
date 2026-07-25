import { avatarPourSource } from "../_shared/avatar.ts";
import { genererPersona } from "../_shared/gemini.ts";
import {
  bioDeSecours,
  filtrerPseudos,
  nomDepuisHandle,
  pseudosDeSecours,
  trouverHandleLibre,
} from "../_shared/persona.ts";
import { assertAuthorised, json, messageErreur, serviceClient } from "../_shared/supabase.ts";

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
      .select("*, comptes_reference(id, handle_tiktok, niche, bio)")
      .eq("id", compteId)
      .single();
    if (error || !compte) return json({ error: "Compte introuvable" }, 404);

    // deno-lint-ignore no-explicit-any
    const reference = (compte as any).comptes_reference;

    // Bio du compte de référence, SEULEMENT si déjà en cache : on ne scrape PLUS
    // via Apify ici (c'était ~15-30 s de blocage à la création, une des causes du
    // « identité en cours » qui traîne). Sans cache, la bio est générée à partir
    // de la niche — largement suffisant. Le cron peut cacher la bio de réf plus tard.
    const referenceBio: string = reference?.bio ?? "";

    // L'IA d'abord ; mais si elle est indisponible (429 Gemini fréquent en
    // journée), on NE bloque PAS : on bascule sur une identité de secours
    // déterministe. Une identité correcte tout de suite vaut mieux qu'un compte
    // vide qu'il faut re-générer à la main.
    const proposition = await genererPersona({
      niche: reference?.niche ?? "",
      langue: compte.langue,
      referenceHandle: reference?.handle_tiktok ?? undefined,
      referenceBio: referenceBio || undefined,
    }).catch(() => null);

    const pseudosIA = proposition?.pseudos?.length
      ? proposition.pseudos
      : pseudosDeSecours(compte.langue);
    const bio = proposition?.bio?.trim() || bioDeSecours(compte.langue);

    // Écarte les pseudos trahissant la source ou déjà pris ; si tout est écarté,
    // on repart du pool de secours (jamais vide).
    let pseudos = await filtrerPseudos(supabase, pseudosIA, reference?.handle_tiktok ?? "");
    if (pseudos.length === 0) {
      pseudos = await filtrerPseudos(supabase, pseudosDeSecours(compte.langue), reference?.handle_tiktok ?? "");
    }
    // Ultime garde-fou : jamais aucun candidat.
    if (pseudos.length === 0) pseudos = pseudosDeSecours(compte.langue);

    const avatar = await avatarPourSource(supabase, compte.compte_reference_id);

    // Le @ RÉELLEMENT posé : le pseudo choisi, garanti probablement libre.
    let handleApplique: string | null = null;

    if (appliquer && pseudos.length > 0) {
      handleApplique = trouverHandleLibre(pseudos[0]);

      await supabase
        .from("comptes")
        .update({
          // On ne REMPLIT que ce qui manque : un @ ou un nom déjà posés (souvent
          // édités à la main) ne sont jamais écrasés par une re-génération.
          handle_tiktok: compte.handle_tiktok ?? handleApplique,
          // Nom affiché = le @ simplifié (pas le @ brut).
          persona_nom: compte.persona_nom ?? nomDepuisHandle(handleApplique),
          persona_bio: compte.persona_bio ?? bio,
          avatar_url: avatar?.url ?? compte.avatar_url,
          avatar_source: avatar ? "bibliotheque" : compte.avatar_source,
        })
        .eq("id", compteId);

      if (avatar?.id) {
        await supabase
          .from("media_library")
          .update({ used_count: avatar.used_count + 1 })
          .eq("id", avatar.id);
      }
    }

    return json({
      ok: true,
      pseudos,
      bio,
      avatarUrl: avatar?.url ?? null,
      handle: handleApplique,
      applique: appliquer && pseudos.length > 0,
      secours: !proposition, // vrai si l'IA était indispo (identité de secours)
    });
  } catch (error) {
    return json({ ok: false, error: messageErreur(error) }, 500);
  }
});
