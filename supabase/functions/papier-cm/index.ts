/**
 * Master papier quotidien (FR) — topic → script → Nano Banana → Seedance.
 * Auth : JWT admin ou x-cron-secret (minuit / auto-chaîne).
 *
 *   {} | { action: "tick", date? }
 *   { action: "assurer", date?, topic? }
 *   { action: "relancer", id }
 *   { action: "regenerer", id, topic? }
 */

import {
  avancerMaster,
  assurerMasterJour,
  kickPapierCm,
  regenererMaster,
  relancerMaster,
  tickPapierJour,
} from "../_shared/papier_master.ts";
import { assertAuthorised, json, messageErreur, serviceClient } from "../_shared/supabase.ts";

Deno.serve(async (request) => {
  const denied = await assertAuthorised(request);
  if (denied) return denied;

  const supabase = serviceClient();
  // deno-lint-ignore no-explicit-any
  let body: any = {};
  try {
    body = await request.json();
  } catch {
    // vide
  }

  const action = String(body?.action ?? "tick");

  try {
    if (action === "assurer") {
      const master = await assurerMasterJour(supabase, {
        date: typeof body?.date === "string" ? body.date : undefined,
        topic: typeof body?.topic === "string" ? body.topic : undefined,
      });
      const tick = await avancerMaster(supabase, master.id);
      return json({ ok: true, masterId: master.id, ...enchainer(request, tick, master.id) });
    }

    if (action === "relancer") {
      const id = String(body?.id ?? "");
      if (!id) return json({ ok: false, error: "id requis" }, 400);
      const master = await relancerMaster(supabase, id);
      if (master.statut === "ready") {
        return json({ ok: true, done: true, masterId: id, statut: "ready" });
      }
      const tick = await avancerMaster(supabase, id);
      return json({ ok: true, ...enchainer(request, tick, id) });
    }

    if (action === "regenerer") {
      const id = String(body?.id ?? "");
      if (!id) return json({ ok: false, error: "id requis" }, 400);
      const master = await regenererMaster(
        supabase,
        id,
        typeof body?.topic === "string" ? body.topic : undefined,
      );
      const tick = await avancerMaster(supabase, master.id);
      return json({ ok: true, ...enchainer(request, tick, master.id) });
    }

    const tick = await tickPapierJour(supabase, {
      date: typeof body?.date === "string" ? body.date : undefined,
      topic: typeof body?.topic === "string" ? body.topic : undefined,
      masterId: typeof body?.masterId === "string" ? body.masterId : undefined,
    });
    return json(enchainer(request, tick, tick.masterId));
  } catch (error) {
    return json({ ok: false, error: messageErreur(error) }, 500);
  }
});

function enchainer(
  request: Request,
  tick: { done?: boolean; idle?: boolean; statut?: string; kick?: boolean; masterId?: string },
  masterId?: string,
) {
  const id = masterId ?? tick.masterId;
  const peut =
    Boolean(id) &&
    !tick.done &&
    !tick.idle &&
    tick.statut !== "failed" &&
    tick.kick !== false;
  if (peut) {
    kickPapierCm(request, { masterId: id });
    return { ...tick, kick: true };
  }
  return tick;
}
