/**
 * Master papier FR + fan-out 14 langues (TTS / mix / karaoke Fal).
 * Auth : JWT admin ou x-cron-secret.
 *
 *   tick | assurer | relancer | regenerer
 *   tick_locales | relancer_langue
 */

import {
  avancerLangue,
  relancerLangue,
  tickLocalesMaster,
} from "../_shared/papier_locales.ts";
import {
  avancerMaster,
  assurerMasterJour,
  kickPapierCm,
  regenererMaster,
  relancerMaster,
  tickPapierJour,
} from "../_shared/papier_master.ts";
import { assertAuthorised, json, messageErreur, serviceClient } from "../_shared/supabase.ts";

type Tick = {
  done?: boolean;
  idle?: boolean;
  statut?: string;
  kick?: boolean;
  masterId?: string;
  langueId?: string;
};

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
    if (action === "tick_locales") {
      if (typeof body?.langueId === "string" && body.langueId) {
        const tick = await avancerLangue(supabase, body.langueId);
        return json(enchainer(request, tick, tick.masterId));
      }
      const masterId = String(body?.masterId ?? "");
      if (!masterId) return json({ ok: false, error: "masterId requis" }, 400);
      const tick = await tickLocalesMaster(supabase, masterId);
      return json(enchainer(request, tick, masterId));
    }

    if (action === "relancer_langue") {
      const id = String(body?.id ?? "");
      if (!id) return json({ ok: false, error: "id requis" }, 400);
      const row = await relancerLangue(supabase, id);
      if (row.statut === "ready") {
        return json({ ok: true, done: true, langueId: id, statut: "ready" });
      }
      const tick = await avancerLangue(supabase, id);
      return json(enchainer(request, tick, row.master_id));
    }

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
        return json(enchainer(request, { done: true, statut: "ready", masterId: id }, id));
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

function enchainer(request: Request, tick: Tick, masterId?: string) {
  const id = masterId ?? tick.masterId;
  if (!id || tick.idle || tick.kick === false) return tick;

  if (tick.langueId) {
    if (!tick.done && tick.statut !== "failed") {
      kickPapierCm(request, { action: "tick_locales", masterId: id, langueId: tick.langueId });
      return { ...tick, kick: true };
    }
    if (tick.done && tick.statut === "ready") {
      kickPapierCm(request, { action: "tick_locales", masterId: id });
      return { ...tick, kick: true };
    }
    return tick;
  }

  if (!tick.done && tick.statut !== "failed") {
    kickPapierCm(request, { masterId: id });
    return { ...tick, kick: true };
  }
  if (tick.done && tick.statut === "ready") {
    kickPapierCm(request, { action: "tick_locales", masterId: id });
    return { ...tick, kick: true };
  }
  return tick;
}
