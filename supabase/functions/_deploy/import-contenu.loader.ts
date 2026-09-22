/**
 * Chargeur déployé à la place du tree source : le MCP
 * `deploy_edge_function` tronque au-delà de quelques Ko, donc le pipeline
 * minifié vit dans `import-contenu.bundle.js` (même commit) et s'évalue ici.
 * Le fichier `supabase/functions/import-contenu/index.ts` du dépôt reste la
 * source éditable — ne pas le remplacer par ce chargeur.
 */
import { createClient } from "jsr:@supabase/supabase-js@2";

const SHA = "6c57410e4fa6b403483c19fb16ac9969fc9a1bc0";
const url =
  `https://raw.githubusercontent.com/adrienmrtn/micabo-os/${SHA}/supabase/functions/_deploy/import-contenu.bundle.js`;

const res = await fetch(url, {
  headers: { accept: "text/plain,application/javascript,*/*" },
});
if (!res.ok) throw new Error(`import-contenu bundle ${res.status} (${url})`);
const src = await res.text();
if (!src.includes("clockworks~tiktok-scraper") || !src.includes("Deno.serve")) {
  throw new Error("import-contenu bundle illisible ou tronqué");
}
// esbuild renomme l'alias d'un rebuild à l'autre : relire le
// `import{createClient as …}` du bundle avant de l'effacer, et reporter le nom ici.
// 22/09/2026 : `Le` → `je` → `Le` au fil des rebuilds du correctif de boucle.
// Ne jamais le supposer stable : le relire dans le bundle à chaque fois.
new Function("Le", src)(createClient);
