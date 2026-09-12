/**
 * Chargeur déployé à la place du tree source : le MCP
 * `deploy_edge_function` passe mal un tree de cette taille, donc le pipeline
 * minifié vit dans `assignation-contenu.bundle.js` (même commit) et s'évalue ici.
 * Le fichier `supabase/functions/assignation-contenu/index.ts` du dépôt reste la
 * source éditable — ne pas le remplacer par ce chargeur.
 */
import { createClient } from "jsr:@supabase/supabase-js@2";

const SHA = "0974782efa18cd782ff61e62776b1e2f23d5ee30";
const url =
  `https://raw.githubusercontent.com/adrienmrtn/micabo-os/${SHA}/supabase/functions/_deploy/assignation-contenu.bundle.js`;

const res = await fetch(url, {
  headers: { accept: "text/plain,application/javascript,*/*" },
});
if (!res.ok) throw new Error(`assignation-contenu bundle ${res.status} (${url})`);
const src = await res.text();
if (!src.includes("Deno.serve") || !src.includes("date_publication_prevue")) {
  throw new Error("assignation-contenu bundle illisible ou tronqué");
}
// esbuild renomme l'alias d'un rebuild à l'autre : relire le
// `import{createClient as …}` du bundle avant de l'effacer, et reporter le nom ici.
new Function("ne", src)(createClient);
