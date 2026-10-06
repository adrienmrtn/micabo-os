/**
 * Chargeur déployé à la place du tree source : `essai-pertinence` tire
 * `gemini.ts`, qu'un appel MCP recopié à la main pourrait tronquer sans que ça
 * se voie. Le bundle vit dans `essai-pertinence.bundle.js` (même commit) et
 * s'évalue ici. La source éditable reste `supabase/functions/essai-pertinence/index.ts`.
 */
import { createClient } from "jsr:@supabase/supabase-js@2";

const SHA = "25361c60cdbece506646fe5aa7aa1533858de788";
const url =
  `https://raw.githubusercontent.com/adrienmrtn/micabo-os/${SHA}/supabase/functions/_deploy/essai-pertinence.bundle.js`;

const res = await fetch(url, {
  headers: { accept: "text/plain,application/javascript,*/*" },
});
if (!res.ok) throw new Error(`essai-pertinence bundle ${res.status} (${url})`);
const src = await res.text();
if (!src.includes("Deno.serve") || !src.includes("pertinence_micabo_v2")) {
  throw new Error("essai-pertinence bundle illisible ou tronqué");
}
// esbuild renomme l'alias d'un rebuild à l'autre : relire le
// `import{createClient as …}` du bundle avant de l'effacer, et reporter le nom ici.
new Function("$", src)(createClient);
