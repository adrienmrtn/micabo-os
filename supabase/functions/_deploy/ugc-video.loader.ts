/**
 * Chargeur déployé à la place du tree source : `ugc-video` tire `gemini.ts`
 * et `apify.ts`. Le bundle vit dans `ugc-video.bundle.js` et s'évalue ici.
 * La source éditable reste `supabase/functions/ugc-video/index.ts`.
 */
import { createClient } from "jsr:@supabase/supabase-js@2";

const SHA = "ae08386cb66fbb849cb445a24f3f11b99b31a7c7";
const url =
  `https://raw.githubusercontent.com/adrienmrtn/micabo-os/${SHA}/supabase/functions/_deploy/ugc-video.bundle.js`;

const res = await fetch(url, {
  headers: { accept: "text/plain,application/javascript,*/*" },
});
if (!res.ok) throw new Error(`ugc-video bundle ${res.status} (${url})`);
const src = await res.text();
if (!src.includes("Deno.serve") || !src.includes("fal_status_url")) {
  throw new Error("ugc-video bundle illisible ou tronqué");
}
// esbuild renomme l'alias d'un rebuild à l'autre : relire le
// `import{createClient as …}` du bundle avant de l'effacer, et reporter le nom ici.
new Function("qe", src)(createClient);
