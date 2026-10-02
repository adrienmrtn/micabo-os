/**
 * Chargeur déployé à la place du tree source : `nettoyage-cible` tire le moteur partagé.
 * Le bundle vit dans `nettoyage-cible.bundle.js` et s'évalue ici. La source éditable
 * reste `supabase/functions/nettoyage-cible/index.ts`.
 */
import { createClient } from "jsr:@supabase/supabase-js@2";

const SHA = "7186ea54b57d5fd809db971689ba3cda386128e5";
const url =
  `https://raw.githubusercontent.com/adrienmrtn/micabo-os/${SHA}/supabase/functions/_deploy/nettoyage-cible.bundle.js`;

const res = await fetch(url, {
  headers: { accept: "text/plain,application/javascript,*/*" },
});
if (!res.ok) throw new Error(`nettoyage-cible bundle ${res.status} (${url})`);
const src = await res.text();
if (!src.includes("Deno.serve") || !src.includes("nettoyage_cible")) {
  throw new Error("nettoyage-cible bundle illisible ou tronqué");
}
// esbuild renomme l'alias d'un rebuild à l'autre : relire le
// `import{createClient as …}` du bundle avant de l'effacer, et reporter le nom ici.
new Function("V", src)(createClient);
