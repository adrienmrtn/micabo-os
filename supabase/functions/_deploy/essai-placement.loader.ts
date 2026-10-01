/**
 * Chargeur déployé à la place du tree source : `essai-placement` tire
 * `gemini.ts` (52 Ko de prompts), qu'un appel MCP recopié à la main pourrait
 * tronquer sans que ça se voie. Le bundle vit dans `essai-placement.bundle.js`
 * (même commit) et s'évalue ici. La source éditable reste
 * `supabase/functions/essai-placement/index.ts`.
 */
import { createClient } from "jsr:@supabase/supabase-js@2";

const SHA = "baa5add848a43375f1f2326d9ae45ba363ce29ae";
const url =
  `https://raw.githubusercontent.com/adrienmrtn/micabo-os/${SHA}/supabase/functions/_deploy/essai-placement.bundle.js`;

const res = await fetch(url, {
  headers: { accept: "text/plain,application/javascript,*/*" },
});
if (!res.ok) throw new Error(`essai-placement bundle ${res.status} (${url})`);
const src = await res.text();
if (!src.includes("Deno.serve") || !src.includes("placement_micabo_v2")) {
  throw new Error("essai-placement bundle illisible ou tronqué");
}
// esbuild renomme l'alias d'un rebuild à l'autre : relire le
// `import{createClient as …}` du bundle avant de l'effacer, et reporter le nom ici.
new Function("z", src)(createClient);
