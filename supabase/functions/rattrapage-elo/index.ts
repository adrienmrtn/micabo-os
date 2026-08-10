import {
  backfillSnapshotVuesJour,
  DRAIN_MAX_CHAIN_ELO,
  kickRattrapageElo,
  rattrapageElo,
  rattrapageEloDrainLot,
} from "../_shared/rattrapage_elo.ts";
import { assertAuthorised, json, messageErreur, serviceClient } from "../_shared/supabase.ts";

/**
 * Rattrapage ELO (admin / cron minuit) — fenêtre Paris (défaut 4 jours) :
 *   1) stats TikTok des passages publiés (publie_url)
 *   2) ELO langue en deltas ↑/↓ (vues seules), idempotent
 *   3) ELO compte = moyenne pondérée ≤10 posts mesurés
 *   4) snapshot vues_globales_jour (fin de drain)
 *
 * Contourne PAUSE_ELO_RUNTIME.
 *
 *   {} | { drain: true }     → drain par lots de 3 comptes + auto-chaîne
 *   { compteId, jours, forcer, dryRun }
 *   { snapshot: true }       → fige seulement vues_globales_jour
 *   { backfillJour: "YYYY-MM-DD" }
 */
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

  try {
    if (typeof body?.backfillJour === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.backfillJour)) {
      const snapshot = await backfillSnapshotVuesJour(supabase, body.backfillJour);
      return json({ ok: true, snapshot, backfill: true });
    }

    const jours = typeof body?.jours === "number" ? body.jours : undefined;
    const forcer = Boolean(body?.forcer);
    const dryRun = Boolean(body?.dryRun);
    const compteId = body?.compteId ? String(body.compteId) : null;
    const drain = body?.drain === true || body?.drain === "true";
    const drainGen = Math.max(0, Math.floor(Number(body?.drainGen) || 0));
    const offset = Math.max(0, Math.floor(Number(body?.offset) || 0));

    // Drain cron / kick minuit : petits lots + auto-chaîne (évite timeout 150s).
    if (drain && !compteId) {
      const lot = await rattrapageEloDrainLot(supabase, {
        offset,
        jours,
        forcer,
        dryRun,
      });

      const done = lot.restants === 0;
      await supabase.from("reglages").upsert(
        {
          cle: "elo_dernier_run",
          valeur: {
            at: new Date().toISOString(),
            drain: true,
            drainGen,
            offset: lot.nextOffset,
            total: lot.total,
            traitesCumules: lot.nextOffset,
            restants: lot.restants,
            done,
            comptesLot: lot.comptes,
            erreurs: lot.erreurs,
            snapshot: lot.snapshot ?? null,
            jours: jours ?? 4,
          },
        },
        { onConflict: "cle" },
      );

      if (lot.restants > 0 && drainGen < DRAIN_MAX_CHAIN_ELO) {
        kickRattrapageElo(request, {
          drain: true,
          drainGen: drainGen + 1,
          offset: lot.nextOffset,
          jours,
          forcer,
          dryRun,
        });
      }

      return json({
        ok: true,
        drain: true,
        drainGen,
        traites: lot.traites,
        restants: lot.restants,
        nextOffset: lot.nextOffset,
        total: lot.total,
        comptes: lot.comptes,
        erreurs: lot.erreurs,
        snapshot: lot.snapshot,
        kick: lot.restants > 0 && drainGen < DRAIN_MAX_CHAIN_ELO,
        done,
      });
    }

    const r = await rattrapageElo(supabase, {
      compteId,
      jours,
      forcer,
      dryRun,
      snapshot: Boolean(body?.snapshot),
    });
    return json({ ok: true, ...r });
  } catch (error) {
    return json({ ok: false, error: messageErreur(error) }, 500);
  }
});
