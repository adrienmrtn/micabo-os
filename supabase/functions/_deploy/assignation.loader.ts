/**
 * Chargeur déployé à la place du tree source : le MCP
 * `deploy_edge_function` tronque au-delà de quelques Ko, donc le pipeline
 * minifié vit dans `assignation.bundle.js` (même commit) et s'évalue ici.
 * Le fichier `supabase/functions/assignation/index.ts` du dépôt reste la
 * source éditable — ne pas le remplacer par ce chargeur.
 */
import { createClient } from "jsr:@supabase/supabase-js@2";

const SHA = "772589b1d9a3b5e1e17e10f572a1511d2b44ab0f";
const url =
  `https://raw.githubusercontent.com/adrienmrtn/micabo-os/${SHA}/supabase/functions/_deploy/assignation.bundle.js`;

const res = await fetch(url, {
  headers: { accept: "text/plain,application/javascript,*/*" },
});
if (!res.ok) throw new Error(`assignation bundle ${res.status} (${url})`);
const src = await res.text();
if (!src.includes("Deno.serve") || !src.includes("date_publication_prevue")) {
  throw new Error("assignation bundle illisible ou tronqué");
}
new Function("_e", src)(createClient);
