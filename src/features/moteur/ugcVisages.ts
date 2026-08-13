import { supabase } from "@/lib/supabase/client";

/**
 * Marquage visage UGC hors cycle de vie React.
 *
 * Le panneau détail se ferme / refetch pendant que l'init « tout à Non »
 * tourne encore : les clics Oui/Non doivent survivre à ça, et gagner
 * contre le bulk UPDATE.
 */

export type ValeurVisage = boolean | null;

type PersistFn = (mediaId: string, valeur: ValeurVisage) => Promise<void>;

async function persistDefaut(
  mediaId: string,
  valeur: ValeurVisage,
): Promise<void> {
  const { error } = await supabase
    .from("media_library")
    .update({ visage_premier_plan: valeur })
    .eq("id", mediaId);
  if (error) throw error;
}

export function createUgcVisagesStore(persist: PersistFn = persistDefaut) {
  const overrides = new Map<string, ValeurVisage>();
  /** Clics manuels — le bulk « tout à Non » ne doit pas les écraser. */
  const clics = new Set<string>();
  const chain = new Map<string, Promise<void>>();
  const ugcParContenu = new Map<string, boolean>();
  let barriere: Promise<void> = Promise.resolve();

  function overlayVisages(
    base: Record<string, ValeurVisage> | undefined,
  ): Record<string, ValeurVisage> {
    const out: Record<string, ValeurVisage> = { ...(base ?? {}) };
    for (const [id, v] of overrides) out[id] = v;
    return out;
  }

  function idsClics(): Set<string> {
    return new Set(clics);
  }

  function poserBarriereInit(p: Promise<unknown>) {
    barriere = p.then(
      () => undefined,
      () => undefined,
    );
  }

  function poserUgcOptimistic(contenuId: string, ugc: boolean) {
    ugcParContenu.set(contenuId, ugc);
  }

  /** Défaut Non à l'activation — overlay seulement (le bulk DB s'en charge). */
  function poserVisagesDefautNon(mediaIds: string[]) {
    for (const id of mediaIds) {
      if (!id || clics.has(id) || overrides.has(id)) continue;
      overrides.set(id, false);
    }
  }

  function oublierOverrides(mediaIds: string[]) {
    for (const id of mediaIds) {
      overrides.delete(id);
      clics.delete(id);
    }
  }

  function marquerVisageOptimistic(mediaId: string, valeur: ValeurVisage) {
    overrides.set(mediaId, valeur);
    clics.add(mediaId);
  }

  async function persisterVisage(
    mediaId: string,
    valeur: ValeurVisage,
  ): Promise<void> {
    marquerVisageOptimistic(mediaId, valeur);
    const prev = chain.get(mediaId) ?? Promise.resolve();
    const next = prev.catch(() => undefined).then(async () => {
      await barriere;
      if (!clics.has(mediaId)) return;
      const latest = overrides.get(mediaId);
      if (latest === undefined) return;
      await persist(mediaId, latest);
    });
    chain.set(mediaId, next);
    return next;
  }

  function reconcilierServeur(opts: {
    contenuId: string;
    ugc: boolean;
    visages?: Record<string, ValeurVisage>;
  }) {
    if (ugcParContenu.get(opts.contenuId) === opts.ugc) {
      ugcParContenu.delete(opts.contenuId);
    }
    for (const [id, v] of Object.entries(opts.visages ?? {})) {
      if (overrides.get(id) === v) {
        overrides.delete(id);
        clics.delete(id);
      }
    }
  }

  function appliquerOptimistic<
    T extends {
      id: string;
      ugc_compatible?: boolean;
      mediaVisages?: Record<string, ValeurVisage>;
    },
  >(d: T): T {
    const ugcOpt = ugcParContenu.get(d.id);
    const visages = overlayVisages(d.mediaVisages);
    reconcilierServeur({
      contenuId: d.id,
      ugc: Boolean(d.ugc_compatible),
      visages: d.mediaVisages,
    });
    return {
      ...d,
      ugc_compatible: ugcOpt ?? d.ugc_compatible,
      mediaVisages: visages,
    };
  }

  function reset() {
    overrides.clear();
    clics.clear();
    chain.clear();
    ugcParContenu.clear();
    barriere = Promise.resolve();
  }

  return {
    overlayVisages,
    idsClics,
    poserBarriereInit,
    poserUgcOptimistic,
    poserVisagesDefautNon,
    oublierOverrides,
    marquerVisageOptimistic,
    persisterVisage,
    appliquerOptimistic,
    reset,
  };
}

export const ugcVisages = createUgcVisagesStore();
