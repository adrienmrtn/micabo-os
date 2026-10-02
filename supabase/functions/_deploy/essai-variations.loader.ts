/**
 * Chargeur déployé à la place du tree source : `essai-variations` tire le moteur partagé.
 * Le bundle vit dans `essai-variations.bundle.js` et s'évalue ici. La source éditable
 * reste `supabase/functions/essai-variations/index.ts`.
 */
import { createClient } from "jsr:@supabase/supabase-js@2";

const SHA = "fea89afa63d3d88ce877cf08faef027d35c89836";
const url =
  `https://raw.githubusercontent.com/adrienmrtn/micabo-os/${SHA}/supabase/functions/_deploy/essai-variations.bundle.js`;

const res = await fetch(url, {
  headers: { accept: "text/plain,application/javascript,*/*" },
});
if (!res.ok) throw new Error(`essai-variations bundle ${res.status} (${url})`);
const src = await res.text();
if (!src.includes("Deno.serve") || !src.includes("LA SLIDE micabo")) {
  throw new Error("essai-variations bundle illisible ou tronqué");
}
// esbuild renomme l'alias d'un rebuild à l'autre : relire le
// `import{createClient as …}` du bundle avant de l'effacer, et reporter le nom ici.
new Function("ee", src)(createClient);
