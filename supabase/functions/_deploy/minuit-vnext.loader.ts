/**
 * Chargeur déployé à la place du tree source : le MCP
 * `deploy_edge_function` tronque au-delà de quelques Ko, donc le pipeline
 * minifié vit dans `minuit-vnext.bundle.js` (même commit) et s'évalue ici.
 * Le fichier `supabase/functions/minuit-vnext/index.ts` du dépôt reste la
 * source éditable — ne pas le remplacer par ce chargeur.
 */
import { createClient } from "jsr:@supabase/supabase-js@2";

const SHA = "33709e469e5d24da466a63f3aa83ef248d72dba4";
const url =
  `https://raw.githubusercontent.com/adrienmrtn/micabo-os/${SHA}/supabase/functions/_deploy/minuit-vnext.bundle.js`;

const res = await fetch(url, {
  headers: { accept: "text/plain,application/javascript,*/*" },
});
if (!res.ok) throw new Error(`minuit-vnext bundle ${res.status} (${url})`);
const src = await res.text();
if (!src.includes("Deno.serve") || !src.includes("date_publication_prevue")) {
  throw new Error("minuit-vnext bundle illisible ou tronqué");
}
new Function("$e", src)(createClient);
