/**
 * Chargeur déployé à la place du tree source : le MCP
 * `deploy_edge_function` tronque / stubbe manage-users. Le pipeline
 * minifié vit dans `manage-users.bundle.js` (même commit) et s'évalue ici.
 * Le fichier `supabase/functions/manage-users/index.ts` du dépôt reste la
 * source éditable — ne pas le remplacer par ce chargeur.
 */
import { createClient } from "jsr:@supabase/supabase-js@2";

const SHA = "PLACEHOLDER_SHA";
const url =
  `https://raw.githubusercontent.com/adrienmrtn/micabo-os/${SHA}/supabase/functions/_deploy/manage-users.bundle.js`;

const res = await fetch(url, {
  headers: { accept: "text/plain,application/javascript,*/*" },
});
if (!res.ok) throw new Error(`manage-users bundle ${res.status} (${url})`);
const src = await res.text();
if (!src.includes("Deno.serve") || !src.includes('"hook"')) {
  throw new Error("manage-users bundle illisible ou tronqué");
}
new Function("me", src)(createClient);
