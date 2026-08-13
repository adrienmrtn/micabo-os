import { describe, expect, it, vi } from "vitest";

import { createUgcVisagesStore } from "./ugcVisages";

function deferred<T>() {
  let resolve!: (v: T | PromiseLike<T>) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("ugcVisages", () => {
  it("l’overlay l’emporte sur les valeurs serveur", () => {
    const store = createUgcVisagesStore(async () => undefined);
    store.marquerVisageOptimistic("a", true);
    store.poserVisagesDefautNon(["a", "b"]);
    expect(store.overlayVisages({ a: false, b: null })).toEqual({
      a: true,
      b: false,
    });
  });

  it("n’écrase pas un clic déjà posé avec le défaut Non", () => {
    const store = createUgcVisagesStore(async () => undefined);
    store.marquerVisageOptimistic("a", true);
    store.poserVisagesDefautNon(["a"]);
    expect(store.overlayVisages({})).toEqual({ a: true });
  });

  it("attend la barrière d’init avant d’écrire, et le dernier clic gagne", async () => {
    const writes: Array<[string, boolean | null]> = [];
    const persist = vi.fn(async (id: string, v: boolean | null) => {
      writes.push([id, v]);
    });
    const store = createUgcVisagesStore(persist);
    const init = deferred<void>();
    store.poserBarriereInit(init.promise);
    store.poserVisagesDefautNon(["m1"]);

    const p1 = store.persisterVisage("m1", true);
    const p2 = store.persisterVisage("m1", false);
    expect(persist).not.toHaveBeenCalled();

    init.resolve();
    await Promise.all([p1, p2]);

    expect(writes[writes.length - 1]).toEqual(["m1", false]);
    expect(writes.some(([, v]) => v === true)).toBe(false);
    expect(store.overlayVisages({})).toEqual({ m1: false });
  });

  it("garde le checkmark UGC si le refetch serveur est encore à false", () => {
    const store = createUgcVisagesStore(async () => undefined);
    store.poserUgcOptimistic("c1", true);
    store.poserVisagesDefautNon(["m1"]);
    const out = store.appliquerOptimistic({
      id: "c1",
      ugc_compatible: false,
      mediaVisages: { m1: null },
    });
    expect(out.ugc_compatible).toBe(true);
    expect(out.mediaVisages).toEqual({ m1: false });
  });

  it("lâche l’optimistic UGC une fois le serveur aligné", () => {
    const store = createUgcVisagesStore(async () => undefined);
    store.poserUgcOptimistic("c1", true);
    store.appliquerOptimistic({
      id: "c1",
      ugc_compatible: true,
      mediaVisages: {},
    });
    const out = store.appliquerOptimistic({
      id: "c1",
      ugc_compatible: false,
      mediaVisages: {},
    });
    expect(out.ugc_compatible).toBe(false);
  });

  it("le bulk init ignore uniquement les clics manuels, pas le défaut Non", () => {
    const store = createUgcVisagesStore(async () => undefined);
    store.poserVisagesDefautNon(["m1", "m2"]);
    expect(store.idsClics().size).toBe(0);
    store.marquerVisageOptimistic("m2", true);
    expect(store.idsClics()).toEqual(new Set(["m2"]));
  });
});
