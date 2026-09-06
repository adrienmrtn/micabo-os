/**
 * Chargeur déployé à la place du tree source : le MCP
 * `deploy_edge_function` tronque au-delà de quelques Ko, donc le pipeline
 * minifié vit dans `import-contenu.bundle.js` (même commit) et s'évalue ici.
 * Le fichier `supabase/functions/import-contenu/index.ts` du dépôt reste la
 * source éditable — ne pas le remplacer par ce chargeur.
 */
import { createClient } from "jsr:@supabase/supabase-js@2";

const SHA = "217fdf30e138f65bc4a778543adc89a0f55a85a1";
const url =
  `https://raw.githubusercontent.com/adrienmrtn/micabo-os/${SHA}/supabase/functions/_deploy/import-contenu.bundle.js`;

const res = await fetch(url, {
  headers: { accept: "text/plain,application/javascript,*/*" },
});
if (!res.ok) throw new Error(`import-contenu bundle ${res.status} (${url})`);
const src = await res.text();
if (!src.includes("clockworks~tiktok-scraper") || !src.includes("Deno.serve")) {
  throw new Error("import-contenu bundle illisible ou tronqué");
}
new Function("Me", src)(createClient);
