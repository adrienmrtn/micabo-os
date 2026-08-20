/**
 * Création semi-manuelle de slideshows.
 *
 *   { action: "generer", labelId, hook, nbSlides, promptExtra? }
 *   { action: "preview", labelId, slides }
 *   { action: "valider", labelId, hook, hookContenuId?, elo?, langueSource?, slides }
 */

import {
  apercuTirages,
  genererSlidesManuelles,
  SLIDES_MANUEL_MAX,
  SLIDES_MANUEL_MIN,
  validerSlideshowManuel,
  type SlideBrouillon,
} from "../_shared/creation_manuelle.ts";
import {
  assertAuthorised,
  corsHeaders,
  json,
  messageErreur,
  serviceClient,
} from "../_shared/supabase.ts";

function slidesDepuisBody(raw: unknown): SlideBrouillon[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item, i) => {
    const o = (item ?? {}) as Record<string, unknown>;
    return {
      position: Number(o.position ?? i + 1),
      texte: String(o.texte ?? o.text ?? ""),
      critere: String(o.critere ?? ""),
      pinned: Boolean(o.pinned),
      media_id: o.media_id ? String(o.media_id) : null,
      preview_media_id: o.preview_media_id ? String(o.preview_media_id) : null,
      preview_url: o.preview_url ? String(o.preview_url) : null,
    };
  });
}

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
    return json({ ok: false, error: "corps JSON attendu" }, 400);
  }

  const action = String(body.action ?? "");
  try {
    if (action === "generer") {
      const labelId = String(body.labelId ?? "");
      const hook = String(body.hook ?? "").trim();
      const nbSlides = Number(body.nbSlides ?? 6);
      if (!labelId) return json({ ok: false, error: "labelId requis" }, 400);
      if (!hook) return json({ ok: false, error: "hook requis" }, 400);
      if (nbSlides < SLIDES_MANUEL_MIN || nbSlides > SLIDES_MANUEL_MAX) {
        return json(
          { ok: false, error: `nbSlides entre ${SLIDES_MANUEL_MIN} et ${SLIDES_MANUEL_MAX}` },
          400,
        );
      }
      const generees = await genererSlidesManuelles(supabase, {
        labelId,
        hook,
        nbSlides,
        promptExtra: typeof body.promptExtra === "string" ? body.promptExtra : null,
      });
      const hookMediaId = body.hookMediaId ? String(body.hookMediaId) : null;
      const brouillon: SlideBrouillon[] = generees.map((s) => ({
        position: s.position,
        texte: s.texte,
        critere: s.critere,
        pinned: s.position === 1,
        media_id: s.position === 1 ? hookMediaId : null,
      }));
      const avecApercu = await apercuTirages(supabase, labelId, brouillon);
      return json({ ok: true, slides: avecApercu });
    }

    if (action === "preview") {
      const labelId = String(body.labelId ?? "");
      if (!labelId) return json({ ok: false, error: "labelId requis" }, 400);
      const slides = await apercuTirages(supabase, labelId, slidesDepuisBody(body.slides));
      return json({ ok: true, slides });
    }

    if (action === "valider") {
      const labelId = String(body.labelId ?? "");
      const hook = String(body.hook ?? "").trim();
      if (!labelId) return json({ ok: false, error: "labelId requis" }, 400);
      if (!hook) return json({ ok: false, error: "hook requis" }, 400);
      const r = await validerSlideshowManuel(supabase, {
        labelId,
        hook,
        hookContenuId: body.hookContenuId ? String(body.hookContenuId) : null,
        elo: body.elo,
        langueSource: typeof body.langueSource === "string" ? body.langueSource : null,
        slides: slidesDepuisBody(body.slides),
      });
      return json({ ok: true, contenuId: r.id });
    }

    return json({ ok: false, error: `action inconnue: ${action || "(vide)"}` }, 400);
  } catch (e) {
    const msg = messageErreur(e);
    console.error(`[creation-manuelle] ${action}: ${msg}`);
    return json({ ok: false, error: msg }, 500);
  }
});
