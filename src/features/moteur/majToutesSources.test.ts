import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Test d'intégration de l'orchestrateur : c'est bien `demarrerMajToutesSources`
 * qui tourne, seules la couche API et l'horloge sont simulées. Un « serveur »
 * factice draine sa file au fil du temps simulé.
 */

/** Éléments encore en file côté « serveur » simulé. */
let restant = 0;
/** Un compte lancé, avec l'état de la file au moment où il part. */
let lancements: Array<{ compteId: string; restantAuDepart: number }> = [];
/** Force une file figée pour tester le garde-fou de stagnation. */
let fileFigee: number | null = null;
/** Rend le suivi par batch illisible : il abandonne au bout de 8 échecs. */
let statsCassees = false;

vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: async () => ({ data: [] }) }),
    }),
  },
}));

vi.mock("@/features/moteur/api", () => ({
  fileImportEnCours: async () => ({ file: 0, pipeline: fileFigee ?? restant }),
  enqueueImportCompte: async (compteReferenceId: string) => {
    lancements.push({ compteId: compteReferenceId, restantAuDepart: restant });
    restant += 5;
    return {
      ok: true,
      batchId: `batch-${compteReferenceId}`,
      total: 5,
      connus: 0,
      manquants: 5,
      nouveaux: 5,
      enqueued: 5,
      skipped: 0,
      source: "apify",
      diagnostic: [],
    };
  },
  statsImportBatch: async () => {
    if (statsCassees) throw new Error("Failed to send a request to the Edge Function");
    return {
    total: 5,
    pending: restant,
    running: 0,
    done: 5 - restant,
    failed: 0,
    contenusPending: restant,
    contenusDone: 5 - restant,
    };
  },
  contenusEloDuBatch: async () => [],
  enqueueImportUrls: async () => ({ ok: true, batchId: "x", enqueued: 0, skipped: 0 }),
}));

const COMPTES = [
  { compteReferenceId: "a", handle: "alpha", langue: "fr" },
  { compteReferenceId: "b", handle: "beta", langue: "fr" },
  { compteReferenceId: "c", handle: "gamma", langue: "fr" },
];

let drain: ReturnType<typeof setInterval>;

beforeEach(() => {
  restant = 0;
  lancements = [];
  fileFigee = null;
  statsCassees = false;
  vi.resetModules();
  vi.useFakeTimers();
  // Le drain serveur : un élément traité toutes les 2 s de temps simulé.
  drain = setInterval(() => {
    if (restant > 0) restant -= 1;
  }, 2_000);
});

afterEach(() => {
  clearInterval(drain);
  vi.useRealTimers();
});

describe("demarrerMajToutesSources", () => {
  it("lance les comptes un par un, chacun sur une file vide", async () => {
    const mod = await import("./importJobs");
    mod.demarrerMajToutesSources(COMPTES);
    await vi.advanceTimersByTimeAsync(600_000);

    expect(lancements.map((l) => l.compteId)).toEqual(["a", "b", "c"]);
    // Le cœur du correctif : aucun compte ne part sur une file encore chargée.
    for (const l of lancements) expect(l.restantAuDepart).toBe(0);
    expect(mod.getMajSources().actif).toBe(false);
  });

  it("ne démarre jamais deux comptes en même temps", async () => {
    const mod = await import("./importJobs");
    mod.demarrerMajToutesSources(COMPTES);

    let maxSimultane = 0;
    for (let i = 0; i < 300; i += 1) {
      await vi.advanceTimersByTimeAsync(2_000);
      const etat = mod.getMajSources();
      if (etat.actif && etat.phase === "import") maxSimultane = Math.max(maxSimultane, 1);
      // `faits` n'avance que quand le compte précédent est terminé.
      expect(etat.faits).toBeLessThanOrEqual(lancements.length);
    }
    expect(maxSimultane).toBe(1);
    expect(lancements).toHaveLength(3);
  });

  it("s'arrête à la demande sans lancer les comptes restants", async () => {
    const mod = await import("./importJobs");
    mod.demarrerMajToutesSources(COMPTES);
    await vi.advanceTimersByTimeAsync(3_000);
    expect(lancements).toHaveLength(1);

    mod.annulerMajSources();
    await vi.advanceTimersByTimeAsync(600_000);

    expect(lancements.map((l) => l.compteId)).toEqual(["a"]);
    expect(mod.getMajSources().actif).toBe(false);
  });

  it("attend la file même quand le suivi du compte a abandonné", async () => {
    // Le polling du batch renonce après 8 échecs de lecture alors que le
    // serveur draine encore : sans l'attente sur la file globale, le compte
    // suivant partirait par-dessus le travail en cours.
    statsCassees = true;
    const mod = await import("./importJobs");
    mod.demarrerMajToutesSources(COMPTES.slice(0, 2));
    await vi.advanceTimersByTimeAsync(600_000);

    expect(lancements.map((l) => l.compteId)).toEqual(["a", "b"]);
    expect(lancements[1].restantAuDepart).toBe(0);
  });

  it("coupe la séquence si la file ne descend plus, sans rien enfiler", async () => {
    fileFigee = 12;
    const mod = await import("./importJobs");
    const jobId = mod.demarrerMajToutesSources(COMPTES);

    await vi.advanceTimersByTimeAsync(9 * 60_000);
    expect(mod.getImportJobs().find((j) => j.id === jobId)?.statut).toBe("encours");

    await vi.advanceTimersByTimeAsync(2 * 60_000);
    expect(lancements).toEqual([]);
    const chef = mod.getImportJobs().find((j) => j.id === jobId);
    expect(chef?.statut).toBe("echec");
    expect(chef?.logs.some((l) => l.message.includes("figée"))).toBe(true);
    expect(mod.getMajSources().actif).toBe(false);
  });
});
