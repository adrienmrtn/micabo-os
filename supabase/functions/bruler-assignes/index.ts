/**
 * Drain burn — incruste le texte traduit sur les slides des comptes « burned ».
 *
 * Traite un petit lot de slides du jour puis s'auto-enchaîne s'il en reste.
 * Volontairement hors du chemin de minuit : l'assignation ne l'attend pas, et
 * une slide pas encore brûlée reste livrable en classique (image propre +
 * `texte_overlay`).
 *
 *   {} | { date?, postId?, limite?, stream? }
 *
 * Déclenché par :
 *   - `minuit-vnext` après l'assignation (et donc par le filet des 15 minutes)
 *   - la fin du drain `upscale-assignes` (le burn vient après l'upscale)
 *   - l'auto-kick de cette fonction tant qu'il reste des slides
 */

import {
  brulerSlideAssignee,
  kickBrulerAssignes,
  listerSlidesABruler,
} from "../_shared/burn.ts";
import { reponseNdjson, veutStream } from "../_shared/nettoyage_etapes.ts";
import {
  assertAuthorised,
  aujourdhuiParis,
  json,
  messageErreur,
  serviceClient,
} from "../_shared/supabase.ts";

const LOT = 3;

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204 });

  const denied = await assertAuthorised(request);
  if (denied) return denied;

  const supabase = serviceClient();

  // deno-lint-ignore no-explicit-any
  let corps: any = {};
  try {
    corps = await request.json();
  } catch {
    // vide
  }

  const jour = String(corps?.date ?? aujourdhuiParis());
  const limite = Math.max(1, Math.min(20, Number(corps?.limite ?? LOT)));
  const postId = corps?.postId ? String(corps.postId) : null;
  const stream = veutStream(request, corps);

  const executer = async (emit?: (e: Record<string, unknown>) => void) => {
    const { slides, enAttente } = await listerSlidesABruler(supabase, jour);
    const file = postId ? slides.filter((s) => s.postId === postId) : slides;
    emit?.({
      etape: "queue",
      total: file.length,
      enAttente,
      detail: enAttente > 0 ? `${enAttente} slide(s) attendent l'upscale` : undefined,
    });

    const lot = file.slice(0, limite);
    let faits = 0;
    let caches = 0;
    let echecs = 0;

    for (const slide of lot) {
      const r = await brulerSlideAssignee(supabase, slide);
      if (r.ok) {
        faits += 1;
        if (r.cache) caches += 1;
      } else {
        echecs += 1;
      }
      emit?.({
        etape: "slide",
        postId: slide.postId,
        position: slide.position,
        statut: r.ok ? (r.cache ? "cache" : "ok") : "echec",
        detail: r.erreur,
      });
    }

    const restants = Math.max(0, file.length - lot.length);
    // La chaîne s'arrête d'elle-même : plus rien à brûler, plus de kick.
    if (restants > 0) kickBrulerAssignes(request, { date: jour, limite });

    return { jour, traites: lot.length, faits, caches, echecs, restants, enAttente };
  };

  if (stream) {
    return reponseNdjson(async (emit) => {
      try {
        const bilan = await executer(emit);
        emit({ etape: "ready", statut: "ok", ...bilan });
      } catch (e) {
        emit({ etape: "ready", statut: "echec", detail: messageErreur(e) });
      }
    });
  }

  try {
    return json({ ok: true, ...(await executer()) });
  } catch (e) {
    return json({ ok: false, erreur: messageErreur(e) }, 500);
  }
});
