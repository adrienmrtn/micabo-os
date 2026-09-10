/**
 * Chargeur déployé à la place du tree source.
 *
 * L'arbre de `renettoyer-contenu` pèse ~158 Ko sur 18 fichiers (dont
 * `gemini.ts`, 52 Ko de prompts) : au-delà de ~100 Ko, `deploy_edge_function`
 * (MCP) demande de recopier tout l'arbre dans l'appel, et une dérive d'un seul
 * caractère dans les prompts de nettoyage passerait inaperçue. Le bundle voyage
 * donc par git — octet pour octet — et s'évalue ici.
 *
 * `manage-users` (108 Ko) suit déjà la même recette : voir README.md.
 *
 * Le fichier `supabase/functions/renettoyer-contenu/index.ts` du dépôt reste la
 * source éditable — ne pas le remplacer par ce chargeur.
 */
import { createClient } from "jsr:@supabase/supabase-js@2";

const SHA = "066e7d6107fb370a6b913a4c1e21d208c9e603eb";
const url =
  `https://raw.githubusercontent.com/adrienmrtn/micabo-os/${SHA}/supabase/functions/_deploy/renettoyer-contenu.bundle.js`;

const res = await fetch(url, {
  headers: { accept: "text/plain,application/javascript,*/*" },
});
if (!res.ok) throw new Error(`renettoyer-contenu bundle ${res.status} (${url})`);
const src = await res.text();
if (!src.includes("renettoyer-contenu") || !src.includes("Deno.serve")) {
  throw new Error("renettoyer-contenu bundle illisible ou tronqué");
}
// esbuild renomme l'alias d'un rebuild à l'autre : relire le
// `import{createClient as …}` du bundle avant de l'effacer, et reporter le nom ici.
new Function("H", src)(createClient);
