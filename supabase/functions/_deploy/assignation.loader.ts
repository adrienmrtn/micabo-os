/**
 * Chargeur déployé à la place du tree source : le MCP
 * `deploy_edge_function` tronque au-delà de quelques Ko, donc le pipeline
 * minifié vit dans `assignation.bundle.js` (même commit) et s'évalue ici.
 * Le fichier `supabase/functions/assignation/index.ts` du dépôt reste la
 * source éditable — ne pas le remplacer par ce chargeur.
 */
import { createClient } from "jsr:@supabase/supabase-js@2";

const SHA = "b821612e79595bdb2b1a459b8efd99b5979c75fe";
const url =
  `https://raw.githubusercontent.com/adrienmrtn/micabo-os/${SHA}/supabase/functions/_deploy/assignation.bundle.js`;

const res = await fetch(url, {
  headers: { accept: "text/plain,application/javascript,*/*" },
});
if (!res.ok) throw new Error(`assignation bundle ${res.status} (${url})`);
const src = await res.text();
if (!src.includes("Deno.serve") || !src.includes("warmup fini")) {
  throw new Error("assignation bundle illisible ou tronqué");
}
new Function("se", src)(createClient);
