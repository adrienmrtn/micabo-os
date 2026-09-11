/**
 * Chargeur déployé à la place du tree source : le MCP
 * `deploy_edge_function` passe mal un tree de cette taille, donc le pipeline
 * minifié vit dans `revoquer-post.bundle.js` (même commit) et s'évalue ici.
 * Le fichier `supabase/functions/revoquer-post/index.ts` du dépôt reste la
 * source éditable — ne pas le remplacer par ce chargeur.
 */
import { createClient } from "jsr:@supabase/supabase-js@2";

const SHA = "f7289f286ae584d1f587e0fe269992082f259878";
const url =
  `https://raw.githubusercontent.com/adrienmrtn/micabo-os/${SHA}/supabase/functions/_deploy/revoquer-post.bundle.js`;

const res = await fetch(url, {
  headers: { accept: "text/plain,application/javascript,*/*" },
});
if (!res.ok) throw new Error(`revoquer-post bundle ${res.status} (${url})`);
const src = await res.text();
if (!src.includes("Deno.serve") || !src.includes("post_slides")) {
  throw new Error("revoquer-post bundle illisible ou tronqué");
}
// esbuild renomme l'alias d'un rebuild à l'autre : relire le
// `import{createClient as …}` du bundle avant de l'effacer, et reporter le nom ici.
new Function("ie", src)(createClient);
