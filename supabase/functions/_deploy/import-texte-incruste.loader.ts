/**
 * Chargeur déployé à la place du tree source (0306/0307).
 *
 * Même recette que les autres chargeurs (`_deploy/README.md`) : le bundle
 * voyage par git, octet pour octet. Jusqu'au 06/10/2026 il était lu dans le
 * key-value store Apify `micabo-white-post`, faute d'avoir pu être poussé.
 * Le fichier `supabase/functions/import-texte-incruste/index.ts` du dépôt reste
 * la source éditable — ne pas le remplacer par ce chargeur.
 */
import { createClient } from "jsr:@supabase/supabase-js@2";

const SHA = "d5c9ee753c77263e80c804c3ad3d2c7fa73a15a9";
const url =
  `https://raw.githubusercontent.com/adrienmrtn/micabo-os/${SHA}/supabase/functions/_deploy/import-texte-incruste.bundle.js`;

const res = await fetch(url, {
  headers: { accept: "text/plain,application/javascript,*/*" },
});
if (!res.ok) throw new Error(`import-texte-incruste bundle ${res.status} (${url})`);
const src = await res.text();
// Sentinelles structurelles (noms de fonctions SQL) : voir `_deploy/README.md`.
if (
  !src.includes("Deno.serve") || !src.includes("creer_contenu_texte_incruste") ||
  !src.includes("ajouter_langues_texte_incruste")
) {
  throw new Error("import-texte-incruste bundle illisible ou tronqué");
}
// esbuild renomme l'alias d'un rebuild à l'autre : relire le
// `import{createClient as …}` du bundle avant de l'effacer, et reporter le nom ici.
new Function("B", src)(createClient);
