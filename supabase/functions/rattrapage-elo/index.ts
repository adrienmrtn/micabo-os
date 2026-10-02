import { lireUsageApify } from "../_shared/apify_usage.ts";
import {
  backfillSnapshotVuesJour,
  DRAIN_BUSY_STALE_MS,
  DRAIN_MAX_CHAIN_ELO,
  ecrireEloDernierRun,
  kickRattrapageElo,
  lireEloDernierRunReglage,
  rattrapageElo,
  rattrapageEloDrainLot,
  type EloDernierRun,
} from "../_shared/rattrapage_elo.ts";
import { assertAuthorised, json, messageErreur, serviceClient } from "../_shared/supabase.ts";

/**
 * Rattrapage (admin / cron minuit / cron minute) — fenêtre Paris (défaut 4 jours) :
 *   1) stats TikTok des passages publiés (publie_url)
 *   2) reposts bonus J+7 pour les passages > 50 000 vues
 *   3) fin de file : requalification tierlist des slideshows, qualification des
 *      comptes (INACTIF → STAR) et snapshot vues
 *
 *   {} | { drain: true }     → 1 compte / invoke ; reprend elo_dernier_run si !done
 *                              (cron `rattrapage-elo-drain` * * * * * = filet)
 *   { drain: true, offset }  → force le curseur (kick auto-chaîne)
 *   { restart: true }        → repart de offset 0 (minuit)
 *   { compteId, jours, dryRun }
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

    const joursBody = typeof body?.jours === "number" ? body.jours : undefined;
    const dryRun = Boolean(body?.dryRun);
    const compteId = body?.compteId ? String(body.compteId) : null;
    const restart = body?.restart === true || body?.restart === "true";
    // Cron minute envoie {} → drain mode. Kick minuit envoie drain:true.
    const drainExplicit = body?.drain === true || body?.drain === "true";
    const drain =
      drainExplicit ||
      restart ||
      (!compteId &&
        body?.snapshot !== true &&
        typeof body?.backfillJour !== "string" &&
        (body == null || Object.keys(body).length === 0));

    if (drain && !compteId) {
      const prev = await lireEloDernierRunReglage(supabase);

      // Idle (cron minute) : rien enfilé / déjà fini — ne lance PAS un drain spontané.
      // Minuit (ou restart) doit poser done=false pour ouvrir la file.
      if (!restart && body?.offset == null && (prev == null || prev.done === true)) {
        return json({
          ok: true,
          drain: true,
          idle: true,
          done: prev?.done === true,
          detail: prev?.done === true
            ? "drain ELO déjà terminé — rien à faire"
            : "aucun drain ELO enfilé — attente minuit",
          at: prev?.at ?? null,
        });
      }

      // Prise du verrou EN BASE, en une seule instruction (0281). L'ancien
      // verrou lisait elo_dernier_run puis l'écrivait : entre la fin d'un lot
      // (busy=false) et le kick du suivant, le cron minute lisait le même
      // curseur et traitait le même compte. La chaîne se dédoublait jusqu'à la
      // fin du drain — 23 scrapes Apify en double le 28/09, sur 74.
      // Un kick qui arrive après qu'un autre worker a avancé le curseur est
      // refusé aussi : il traiterait un compte déjà fait.
      const { data: pris, error: erreurVerrou } = await supabase.rpc("prendre_verrou_drain_elo", {
        p_offset: restart
          ? 0
          : typeof body?.offset === "number"
            ? Math.max(0, Math.floor(body.offset))
            : null,
        p_restart: restart,
        p_perime_secondes: Math.round(DRAIN_BUSY_STALE_MS / 1000),
      });
      if (erreurVerrou) throw erreurVerrou;
      if (!pris) {
        return json({
          ok: true,
          drain: true,
          busy: true,
          skipped: true,
          detail: "drain ELO déjà en cours, ou curseur déjà avancé (verrou)",
          offset: prev?.offset ?? 0,
          at: prev?.at ?? null,
        });
      }
      const verrou = pris as EloDernierRun;
      const offset = Math.max(0, Math.floor(Number(verrou.offset) || 0));

      // Départ d'une passe : relever la consommation Apify du cycle, pour que
      // le brief du matin la lise (le crédit s'est épuisé le 28/09 sans que
      // rien ne le montre). lireUsageApify ne lève jamais.
      if (offset === 0) {
        const usage = await lireUsageApify();
        await supabase.from("reglages").upsert(
          {
            cle: "apify_usage",
            valeur: { at: new Date().toISOString(), ...usage },
            updated_at: new Date().toISOString(),
          },
          { onConflict: "cle" },
        );
      }
      const drainGen = Math.max(0, Math.floor(Number(body?.drainGen) || 0));
      const jours = joursBody ?? (typeof prev?.jours === "number" ? prev.jours : 4);
      const source = String(body?.source ?? prev?.source ?? "cron");

      // Heartbeat AVANT le scrape — si timeout 150s, le cron minute reprend.
      const heartbeat: EloDernierRun = {
        ...(verrou ?? prev ?? {}),
        at: new Date().toISOString(),
        busy: true,
        drain: true,
        drainGen,
        offset,
        done: false,
        jours,
        source,
        kick: Boolean(prev?.kick),
        detail: `busy offset=${offset}`,
      };
      await ecrireEloDernierRun(supabase, heartbeat);

      let lot: Awaited<ReturnType<typeof rattrapageEloDrainLot>>;
      try {
        lot = await rattrapageEloDrainLot(supabase, {
          offset,
          jours,
          dryRun,
        });
      } catch (error) {
        // Libère le lock pour que le cron minute puisse retenter.
        await ecrireEloDernierRun(supabase, {
          ...heartbeat,
          at: new Date().toISOString(),
          busy: false,
          done: false,
          detail: `erreur lot: ${messageErreur(error)}`,
        });
        throw error;
      }

      // Apify à court de crédit : chaque compte suivant rendrait le même 402.
      // On arrête la file ; la passe suivante (13:00 ou minuit) repartira.
      const done = lot.restants === 0 || lot.apifyEpuise;
      await ecrireEloDernierRun(supabase, {
        at: new Date().toISOString(),
        busy: false,
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
        jours,
        source,
        kick: Boolean(prev?.kick),
        detail: lot.apifyEpuise
          ? `Apify à court de crédit (402) — drain arrêté à ${lot.nextOffset}/${lot.total}`
          : done
            ? `drain terminé${lot.erreurs.length ? ` · ${lot.erreurs.length} erreur(s)` : ""}`
            : `ok · next=${lot.nextOffset}/${lot.total}`,
      });

      // Auto-chaîne rapide (filet = cron minute si waitUntil meurt).
      if (!lot.apifyEpuise && lot.restants > 0 && drainGen < DRAIN_MAX_CHAIN_ELO) {
        kickRattrapageElo(request, {
          drain: true,
          drainGen: drainGen + 1,
          offset: lot.nextOffset,
          jours,
          dryRun,
          source,
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
        apifyEpuise: lot.apifyEpuise,
        kick: !lot.apifyEpuise && lot.restants > 0 && drainGen < DRAIN_MAX_CHAIN_ELO,
        done,
      });
    }

    const r = await rattrapageElo(supabase, {
      compteId,
      jours: joursBody,
      dryRun,
      snapshot: Boolean(body?.snapshot),
    });
    return json({ ok: true, ...r });
  } catch (error) {
    return json({ ok: false, error: messageErreur(error) }, 500);
  }
});
