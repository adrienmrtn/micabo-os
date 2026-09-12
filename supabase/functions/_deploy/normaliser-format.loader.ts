/**
 * Chargeur déployé à la place du tree source.
 *
 * Même raison que `upscale-assignes` : sept fichiers recopiés à la main dans
 * un appel MCP, c'est sept occasions de tronquer en silence. Le bundle voyage
 * par git.
 * Le fichier `supabase/functions/normaliser-format/index.ts` du dépôt reste la
 * source éditable — ne pas le remplacer par ce chargeur.
 */
import { createClient } from "jsr:@supabase/supabase-js@2";

const SHA = "REMPLACER_SHA";
const url =
  `https://raw.githubusercontent.com/adrienmrtn/micabo-os/${SHA}/supabase/functions/_deploy/normaliser-format.bundle.js`;

const res = await fetch(url, {
  headers: { accept: "text/plain,application/javascript,*/*" },
});
if (!res.ok) throw new Error(`normaliser-format bundle ${res.status} (${url})`);
const src = await res.text();
// Sentinelles structurelles (noms de colonnes) : voir `_deploy/README.md`.
if (!src.includes("Deno.serve") || !src.includes("structure_slides")) {
  throw new Error("normaliser-format bundle illisible ou tronqué");
}
new Function("T", src)(createClient);
