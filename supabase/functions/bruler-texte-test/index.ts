/**
 * Test admin — burn d'un slideshow d'origine dans une langue.
 *
 *   { contenuId, langue, sauvegarder?: boolean, stream?: true }
 *     → NDJSON :
 *         { etape:"deck",    statut, detail }
 *         { etape:"slide",   position, statut:"encours"|"saute"|"ok"|"echec", detail? }
 *         { etape:"analyse", position, zones:[…], texteTraduit, detail }
 *         { etape:"image",   position, image?|url?, rapport:[…] }
 *         { etape:"ready",   statut, detail, slides }
 *
 * Le texte est celui que la production utiliserait : `assurerDeckPourLangue`
 * traduit ET place le CTA micabo, puis persiste le deck — ce test cuit donc
 * le deck de cette langue s'il ne l'était pas.
 *
 * Le rendu passe par le même moteur déterministe que le drain (`api/burn.py`
 * sur Vercel) : ce que montre l'aperçu est, au pixel près, ce que le créateur
 * recevra. `sauvegarder` range l'image dans la bibliothèque et le cache ;
 * sans lui, rien n'est écrit.
 */

import {
  brulerSlide,
  preparerZonesBurn,
  rendreImageBurn,
  zonesPourSlide,
} from "../_shared/burn.ts";
import { assurerDeckPourLangue } from "../_shared/import_contenu.ts";
import { reponseNdjson, veutStream } from "../_shared/nettoyage_etapes.ts";
import {
  assertAuthorised,
  json,
  messageErreur,
  serviceClient,
} from "../_shared/supabase.ts";

type SlideStruct = {
  position: number;
  media_id: string | null;
  raw_url?: string | null;
  reference_url?: string | null;
  texte_original?: string | null;
};

Deno.serve(async (request) => {
  const denied = await assertAuthorised(request);
  if (denied) return denied;

  let corps: {
    contenuId?: string;
    langue?: string;
    stream?: boolean;
    sauvegarder?: boolean;
  } = {};
  try {
    corps = await request.json();
  } catch {
    // vide
  }
  const contenuId = String(corps.contenuId ?? "").trim();
  const langue = String(corps.langue ?? "").trim().toLowerCase();
  const sauvegarder = Boolean(corps.sauvegarder);
  if (!contenuId) return json({ error: "contenuId requis" }, 400);
  if (!langue) return json({ error: "langue requise" }, 400);

  const stream = veutStream(request, corps);

  const executer = async (emit: (e: Record<string, unknown>) => void) => {
    const supabase = serviceClient();
    const { data: contenu, error } = await supabase
      .from("contenus")
      .select("id, titre, langue_source, compte_reference_id, structure_slides, statut")
      .eq("id", contenuId)
      .maybeSingle();
    if (error) throw error;
    if (!contenu) throw new Error("Slideshow introuvable");

    const structure = ([...(contenu.structure_slides ?? [])] as SlideStruct[])
      .sort((a, b) => a.position - b.position);
    if (structure.length === 0) throw new Error("Aucune slide");

    const mediaIds = [
      ...new Set(
        structure.map((s) => s.media_id).filter((id): id is string => Boolean(id)),
      ),
    ];
    const propres = new Map<string, string>();
    if (mediaIds.length > 0) {
      const { data: medias } = await supabase
        .from("media_library")
        .select("id, url")
        .in("id", mediaIds);
      for (const m of medias ?? []) {
        if (m.url) propres.set(m.id as string, m.url as string);
      }
    }

    emit({
      etape: "deck",
      statut: "encours",
      detail: `deck ${langue} — traduction + placement micabo`,
    });
    const deck = await assurerDeckPourLangue(supabase, contenuId, langue);
    const textesParPos = new Map(
      deck.slides.map((s) => [s.position, (s.texte_overlay ?? "").trim()]),
    );
    emit({
      etape: "deck",
      statut: "ok",
      detail: `deck ${langue} prêt · ${deck.slides.length} slide(s)`,
    });

    let faits = 0;
    let sautes = 0;
    let echecs = 0;

    for (const slide of structure) {
      const pos = slide.position;
      const texteTraduit = (textesParPos.get(pos) ?? "").trim();
      const brutUrl = slide.raw_url || slide.reference_url || null;
      const propreUrl = slide.media_id ? propres.get(slide.media_id) ?? null : null;

      const manque = !texteTraduit
        ? "pas de texte — skip"
        : !brutUrl
        ? "pas d'URL brute pour mesurer le style"
        : !propreUrl
        ? "pas d'image propre (nettoyage non fait ?)"
        : null;
      if (manque) {
        if (texteTraduit) echecs += 1;
        else sautes += 1;
        emit({
          etape: "slide",
          position: pos,
          statut: texteTraduit ? "echec" : "saute",
          detail: manque,
        });
        continue;
      }

      emit({
        etape: "slide",
        position: pos,
        statut: "encours",
        detail: "analyse du style sur le brut…",
      });

      try {
        const { zones: brutes, cache } = await zonesPourSlide(supabase, {
          contenuId,
          position: pos,
          brutUrl: brutUrl!,
        });
        const zones = preparerZonesBurn(brutes, texteTraduit);
        emit({
          etape: "analyse",
          position: pos,
          detail: `${zones.length} zone(s)` +
            (cache ? " · analyse en cache" : "") +
            (brutes.length === 0 ? " · aucune zone détectée, bandeau central" : ""),
          texteTraduit,
          zones,
        });

        if (sauvegarder) {
          const rendu = await brulerSlide(supabase, {
            contenuId,
            position: pos,
            langue,
            brutUrl: brutUrl!,
            propreUrl: propreUrl!,
            texte: texteTraduit,
            compteReferenceId: contenu.compte_reference_id as string | null,
            force: true,
          });
          emit({ etape: "image", position: pos, url: rendu.url, rapport: rendu.rapport });
        } else {
          const { bytes, rapport } = await rendreImageBurn({
            brutUrl: brutUrl!,
            propreUrl: propreUrl!,
            zones,
          });
          emit({
            etape: "image",
            position: pos,
            image: `data:image/jpeg;base64,${base64Depuis(bytes)}`,
            rapport,
          });
        }

        faits += 1;
        emit({
          etape: "slide",
          position: pos,
          statut: "ok",
          detail: sauvegarder ? "brûlée et enregistrée" : "brûlée (aperçu)",
        });
      } catch (e) {
        echecs += 1;
        emit({
          etape: "slide",
          position: pos,
          statut: "echec",
          detail: messageErreur(e),
        });
      }
    }

    emit({
      etape: "ready",
      statut: echecs > 0 && faits === 0 ? "echec" : "ok",
      detail: `faits=${faits} · sautes=${sautes} · echecs=${echecs}` +
        (sauvegarder ? " (enregistré)" : " (aperçu, rien enregistré)"),
      slides: faits,
      sautes,
      echecs,
    });
  };

  if (stream) {
    return reponseNdjson(async (emit) => {
      try {
        await executer(emit);
      } catch (e) {
        emit({ etape: "ready", statut: "echec", detail: messageErreur(e) });
      }
    });
  }

  try {
    const events: Record<string, unknown>[] = [];
    await executer((e) => events.push(e));
    const last = events[events.length - 1] ?? { ok: true };
    return json({ ok: true, events, ...last });
  } catch (e) {
    return json({ ok: false, erreur: messageErreur(e) }, 500);
  }
});

function base64Depuis(bytes: Uint8Array): string {
  let bin = "";
  const pas = 0x8000;
  for (let i = 0; i < bytes.length; i += pas) {
    bin += String.fromCharCode(...bytes.subarray(i, i + pas));
  }
  return btoa(bin);
}
