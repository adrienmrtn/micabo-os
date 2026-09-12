/**
 * Chargeur déployé à la place du tree source : le MCP
 * `deploy_edge_function` passe mal un tree de cette taille (144 Ko, dont les
 * 52 Ko de prompts de `gemini.ts`), donc le pipeline minifié vit dans
 * `bruler-assignes.bundle.js` (même commit) et s'évalue ici.
 * Le fichier `supabase/functions/bruler-assignes/index.ts` du dépôt reste la
 * source éditable — ne pas le remplacer par ce chargeur.
 */
import { createClient } from "jsr:@supabase/supabase-js@2";

const SHA = "676796e8962fc98b5a6bd4a3b19dda55aa445dbe";
const url =
  `https://raw.githubusercontent.com/adrienmrtn/micabo-os/${SHA}/supabase/functions/_deploy/bruler-assignes.bundle.js`;

const res = await fetch(url, {
  headers: { accept: "text/plain,application/javascript,*/*" },
});
if (!res.ok) throw new Error(`bruler-assignes bundle ${res.status} (${url})`);
const src = await res.text();
// Sentinelles structurelles (noms de colonnes) : une phrase d'interface
// disparaîtrait à la première reformulation et le chargeur refuserait de
// démarrer. Voir `_deploy/README.md`.
if (!src.includes("Deno.serve") || !src.includes("burned_media_id")) {
  throw new Error("bruler-assignes bundle illisible ou tronqué");
}
// esbuild renomme l'alias d'un rebuild à l'autre : relire le
// `import{createClient as …}` du bundle avant de l'effacer, et reporter le nom ici.
new Function("N", src)(createClient);
