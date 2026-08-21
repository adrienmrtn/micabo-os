import { assertEquals, assertRejects, assertThrows } from "jsr:@std/assert@1";

import { IN_MAX_VALEURS, LOT_IDS, decouperEnLots, lireParLots } from "./lots.ts";
import { verifierTailleIn } from "./supabase.ts";

const ids = (n: number) => Array.from({ length: n }, (_, i) => `id-${i}`);

Deno.test("decouperEnLots — aucun lot ne dépasse la taille demandée", () => {
  const lots = decouperEnLots(ids(965), LOT_IDS);
  assertEquals(Math.max(...lots.map((l) => l.length)) <= LOT_IDS, true);
  assertEquals(lots.flat().length, 965);
});

Deno.test("lireParLots — un label de 965 slideshows passe sous la borne", async () => {
  // Régression 20-21/08 : `alpha_male` (965) partait en un seul `in(...)`,
  // PostgREST répondait 400 dès ~650 uuid, et l'erreur ignorée faisait passer
  // un pool plein pour un pool vide.
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

Deno.test("verifierTailleIn — laisse passer les listes bornées", () => {
  verifierTailleIn("id", ids(IN_MAX_VALEURS));
  verifierTailleIn("statut", ["pending", "running"]);
  verifierTailleIn("id", []);
});

Deno.test("verifierTailleIn — lève avant que PostgREST ne réponde 400", () => {
  // Le garde-fou du client : n'importe quel appelant du dépôt qui oublie de
  // découper échoue bruyamment, au lieu de recevoir un silencieux « vide ».
  const e = assertThrows(
    () => verifierTailleIn("contenu_id", ids(IN_MAX_VALEURS + 1)),
    Error,
    "contenu_id",
  );
  assertEquals(e.message.includes("lireParLots"), true);
});
