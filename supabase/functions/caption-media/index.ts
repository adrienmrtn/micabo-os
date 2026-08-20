/**
 * Captions visuelles d'une photo déjà en bibliothèque (offline — URL stockée).
 *
 *   { action: "caption_media", mediaId, forcer? }
 *   { action: "lister" }     → photos à rattraper
 *   { action: "demarrer" }   → file serveur (survit à la fermeture)
 *   { action: "drain" }      → un lot (cron / kick)
 *   { action: "statut" }     → run + logs
 *   { mediaId }              → alias caption_media
 */

import {
  captionnerMedia,
  demarrerRattrapageCaption,
  drainRattrapageCaption,
  lireRattrapageCaption,
  listerMediasARattraper,
} from "../_shared/media_caption.ts";
import {
  assertAuthorised,
  corsHeaders,
  json,
  messageErreur,
  serviceClient,
} from "../_shared/supabase.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const denied = await assertAuthorised(request);
  if (denied) return denied;

  const supabase = serviceClient();

  // deno-lint-ignore no-explicit-any
  let body: any = {};
  try {
    body = await request.json();
  } catch {
    // corps vide
  }

  const action = String(body.action ?? (body.mediaId || body.media_id ? "caption_media" : ""));

  try {
    if (action === "lister") {
      const medias = await listerMediasARattraper(supabase, {
        limit: Number(body.limit) || 400,
      });
      return json({
        ok: true,
        total: medias.length,
        captions: medias.filter((m) => m.motif === "caption").length,
        hooks: medias.filter((m) => m.motif === "hook").length,
        medias,
      });
    }

    if (action === "statut") {
      const run = await lireRattrapageCaption(supabase);
      return json({ ok: true, run });
    }

    if (action === "demarrer") {
      const run = await demarrerRattrapageCaption(supabase);
      if (run.statut === "running" && run.total > 0) {
        const drain = await drainRattrapageCaption(supabase);
        return json({ ok: true, run: drain.run ?? run, kick: drain.traites });
      }
      return json({ ok: true, run });
    }

    if (action === "drain") {
      const drain = await drainRattrapageCaption(supabase);
      return json({ ok: true, traites: drain.traites, run: drain.run });
    }

    if (action === "caption_media") {
      const mediaId = String(body.mediaId ?? body.media_id ?? "");
      if (!mediaId) return json({ ok: false, error: "mediaId requis" }, 400);
      const r = await captionnerMedia(supabase, mediaId, {
        forcer: Boolean(body.forcer),
        imageUrl: typeof body.imageUrl === "string" ? body.imageUrl : null,
      });
      return json({
        ok: true,
        mediaId: r.mediaId,
        caption: r.caption,
        caption_statut: r.statut,
        caption_modele: r.modele,
        est_hook: r.estHook,
        lignes: r.lignes,
      });
    }

    return json({ ok: false, error: `action inconnue: ${action || "(vide)"}` }, 400);
  } catch (e) {
    return json({ ok: false, error: messageErreur(e) }, 500);
  }
});
