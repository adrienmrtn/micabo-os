/**
 * Chargeur déployé à la place du tree source.
 *
 * Le tree ne pèse que 48 Ko, mais neuf fichiers recopiés à la main dans un
 * appel MCP, c'est neuf occasions de tronquer sans que rien ne le dise. Le
 * bundle voyage donc par git, octet pour octet.
 * Le fichier `supabase/functions/upscale-assignes/index.ts` du dépôt reste la
 * source éditable — ne pas le remplacer par ce chargeur.
 */
import { createClient } from "jsr:@supabase/supabase-js@2";

const SHA = "REMPLACER_SHA";
const url =
  `https://raw.githubusercontent.com/adrienmrtn/micabo-os/${SHA}/supabase/functions/_deploy/upscale-assignes.bundle.js`;

const res = await fetch(url, {
  headers: { accept: "text/plain,application/javascript,*/*" },
});
if (!res.ok) throw new Error(`upscale-assignes bundle ${res.status} (${url})`);
const src = await res.text();
// Sentinelles structurelles (noms de colonnes) : voir `_deploy/README.md`.
if (!src.includes("Deno.serve") || !src.includes("upscale_le")) {
  throw new Error("upscale-assignes bundle illisible ou tronqué");
}
new Function("z", src)(createClient);
