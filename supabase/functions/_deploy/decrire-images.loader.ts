/**
 * Chargeur déployé à la place du tree source : `decrire-images` tire
 * `gemini.ts`. Le bundle vit dans `decrire-images.bundle.js` et s'évalue ici.
 * La source éditable reste `supabase/functions/decrire-images/index.ts`.
 */
import { createClient } from "jsr:@supabase/supabase-js@2";

const SHA = "f9e15f3bf98bd7a4c23201a3f167f0dd2608bac6";
const url =
  `https://raw.githubusercontent.com/adrienmrtn/micabo-os/${SHA}/supabase/functions/_deploy/decrire-images.bundle.js`;

const res = await fetch(url, {
  headers: { accept: "text/plain,application/javascript,*/*" },
});
if (!res.ok) throw new Error(`decrire-images bundle ${res.status} (${url})`);
const src = await res.text();
if (!src.includes("Deno.serve") || !src.includes("seules les images de notre Storage")) {
  throw new Error("decrire-images bundle illisible ou tronqué");
}
// esbuild renomme l'alias d'un rebuild à l'autre : relire le
// `import{createClient as …}` du bundle avant de l'effacer, et reporter le nom ici.
new Function("_", src)(createClient);
