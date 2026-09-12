/**
 * Chargeur déployé à la place du tree source : le MCP
 * `deploy_edge_function` passe mal un tree de cette taille, donc le pipeline
 * minifié vit dans `creation-manuelle.bundle.js` (même commit) et s'évalue ici.
 * Le fichier `supabase/functions/creation-manuelle/index.ts` du dépôt reste la
 * source éditable — ne pas le remplacer par ce chargeur.
 */
import { createClient } from "jsr:@supabase/supabase-js@2";

const SHA = "d6b88a0b1d40fe0954ca2082713e406de95a1bfa";
const url =
  `https://raw.githubusercontent.com/adrienmrtn/micabo-os/${SHA}/supabase/functions/_deploy/creation-manuelle.bundle.js`;

const res = await fetch(url, {
  headers: { accept: "text/plain,application/javascript,*/*" },
});
if (!res.ok) throw new Error(`creation-manuelle bundle ${res.status} (${url})`);
const src = await res.text();
if (!src.includes("Deno.serve") || !src.includes("hook_contenu_id")) {
  throw new Error("creation-manuelle bundle illisible ou tronqué");
}
// esbuild renomme l'alias d'un rebuild à l'autre : relire le
// `import{createClient as …}` du bundle avant de l'effacer, et reporter le nom ici.
new Function("U", src)(createClient);
