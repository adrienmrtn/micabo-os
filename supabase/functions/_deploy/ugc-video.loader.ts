/**
 * Chargeur déployé à la place du tree source : `ugc-video` tire `gemini.ts`
 * et `apify.ts`. Le bundle vit dans `ugc-video.bundle.js` et s'évalue ici.
 * La source éditable reste `supabase/functions/ugc-video/index.ts`.
 */
import { createClient } from "jsr:@supabase/supabase-js@2";

const SHA = "c64578f876d45f8f2135ce456d95f4960f197e7b";
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
new Function("$e", src)(createClient);
