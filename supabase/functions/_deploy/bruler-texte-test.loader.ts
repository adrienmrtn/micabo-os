/**
 * Chargeur déployé à la place du tree source : le MCP
 * `deploy_edge_function` passe mal un tree de cette taille (273 Ko — la
 * fonction tire tout le moteur de deck via `import_contenu.ts`), donc le
 * pipeline minifié vit dans `bruler-texte-test.bundle.js` (même commit) et
 * s'évalue ici. Le fichier `supabase/functions/bruler-texte-test/index.ts` du
 * dépôt reste la source éditable — ne pas le remplacer par ce chargeur.
 */
import { createClient } from "jsr:@supabase/supabase-js@2";

const SHA = "676796e8962fc98b5a6bd4a3b19dda55aa445dbe";
const url =
  `https://raw.githubusercontent.com/adrienmrtn/micabo-os/${SHA}/supabase/functions/_deploy/bruler-texte-test.bundle.js`;

const res = await fetch(url, {
  headers: { accept: "text/plain,application/javascript,*/*" },
});
if (!res.ok) throw new Error(`bruler-texte-test bundle ${res.status} (${url})`);
const src = await res.text();
// Sentinelles structurelles (noms de colonnes), jamais une phrase d'interface :
// voir `_deploy/README.md`.
if (!src.includes("Deno.serve") || !src.includes("burn_analyses")) {
  throw new Error("bruler-texte-test bundle illisible ou tronqué");
}
// esbuild renomme l'alias d'un rebuild à l'autre : relire le
// `import{createClient as …}` du bundle avant de l'effacer, et reporter le nom ici.
new Function("G", src)(createClient);
