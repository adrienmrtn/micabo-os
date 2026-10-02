/**
 * Chargeur déployé à la place du tree source : `audit-propres` tire
 * `gemini.ts`, qu'un appel MCP recopié à la main pourrait tronquer sans que ça
 * se voie. Le bundle vit dans `audit-propres.bundle.js` (même commit) et
 * s'évalue ici. La source éditable reste `supabase/functions/audit-propres/index.ts`.
 */
import { createClient } from "jsr:@supabase/supabase-js@2";

const SHA = "91348c09f70959e3372399fa1b026e1056464b59";
const url =
  `https://raw.githubusercontent.com/adrienmrtn/micabo-os/${SHA}/supabase/functions/_deploy/audit-propres.bundle.js`;

const res = await fetch(url, {
  headers: { accept: "text/plain,application/javascript,*/*" },
});
if (!res.ok) throw new Error(`audit-propres bundle ${res.status} (${url})`);
const src = await res.text();
if (!src.includes("Deno.serve") || !src.includes("audit_propres_0295")) {
  throw new Error("audit-propres bundle illisible ou tronqué");
}
// esbuild renomme l'alias d'un rebuild à l'autre : relire le
// `import{createClient as …}` du bundle avant de l'effacer, et reporter le nom ici.
new Function("I", src)(createClient);
