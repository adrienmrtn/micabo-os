import { assertEquals, assertRejects } from "jsr:@std/assert@1";

import { LOT_IDS, lireParLots } from "./assignation_contenu.ts";

const ids = (n: number) => Array.from({ length: n }, (_, i) => `id-${i}`);

Deno.test("lireParLots — aucun lot ne dépasse la borne PostgREST", async () => {
  // Régression 20/08 : `alpha_male` (965 slideshows) partait en un seul
  // `in(...)`, PostgREST répondait 400 dès ~650 uuid, et l'erreur ignorée
  // faisait passer un pool plein pour un pool vide.
  const tailles: number[] = [];
  await lireParLots(ids(965), "test", (lot) => {
    tailles.push(lot.length);
    return Promise.resolve({ data: [], error: null });
  });
  assertEquals(Math.max(...tailles) <= LOT_IDS, true);
  assertEquals(tailles.reduce((a, b) => a + b, 0), 965);
});

Deno.test("lireParLots — concatène les lots dans l'ordre", async () => {
  const out = await lireParLots<{ id: string }>(ids(250), "test", (lot) =>
    Promise.resolve({ data: lot.map((id) => ({ id })), error: null }));
  assertEquals(out.length, 250);
  assertEquals(out[0].id, "id-0");
  assertEquals(out[249].id, "id-249");
});

Deno.test("lireParLots — une lecture ratée lève, elle ne rend pas une liste vide", async () => {
  // Le cœur du bug : un pool illisible ne doit jamais ressembler à un pool
  // vide, sinon minuit baisse le quota des créateurs sur une requête ratée.
  await assertRejects(
    () =>
      lireParLots(ids(300), "Slideshows prêts", (lot) =>
        Promise.resolve(
          lot[0] === "id-200"
            ? { data: null, error: { message: "Bad Request" } }
            : { data: [], error: null },
        )),
    Error,
    "Slideshows prêts",
  );
});

Deno.test("lireParLots — liste vide : aucune requête", async () => {
  let appels = 0;
  const out = await lireParLots([], "test", () => {
    appels += 1;
    return Promise.resolve({ data: [], error: null });
  });
  assertEquals(appels, 0);
  assertEquals(out, []);
});
