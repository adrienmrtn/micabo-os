/**
 * Chargeur déployé à la place du tree source : le MCP
 * `deploy_edge_function` passe mal un tree de cette taille, donc le pipeline
 * minifié vit dans `rattrapage-elo.bundle.js` (même commit) et s'évalue ici.
 * Le fichier `supabase/functions/rattrapage-elo/index.ts` du dépôt reste la
 * source éditable — ne pas le remplacer par ce chargeur.
 */
import { createClient } from "jsr:@supabase/supabase-js@2";

const SHA = "ae13aac02b82315e8deab357e31aaa48a4725276";
const url =
  `https://raw.githubusercontent.com/adrienmrtn/micabo-os/${SHA}/supabase/functions/_deploy/rattrapage-elo.bundle.js`;

const res = await fetch(url, {
  headers: { accept: "text/plain,application/javascript,*/*" },
});
if (!res.ok) throw new Error(`rattrapage-elo bundle ${res.status} (${url})`);
const src = await res.text();
if (!src.includes("Deno.serve") || !src.includes("[rattrapage-elo]")) {
  throw new Error("rattrapage-elo bundle illisible ou tronqué");
}
// esbuild renomme l'alias d'un rebuild à l'autre : relire le
// `import{createClient as …}` du bundle avant de l'effacer, et reporter le nom ici.
new Function("H", src)(createClient);
