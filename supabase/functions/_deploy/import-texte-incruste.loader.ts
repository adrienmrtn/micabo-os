/**
 * Chargeur PROVISOIRE d'`import-texte-incruste` (0306, 06/10/2026).
 *
 * Le bundle n'a pas pu être poussé sur GitHub ce jour-là : il vit dans le
 * key-value store Apify `micabo-white-post`, épinglé par son sha256. Un octet
 * de différence et la fonction refuse de démarrer. À remplacer par le chargeur
 * GitHub habituel (recette `_deploy/README.md`) dès que le bundle est poussé.
 *
 * Le fichier `supabase/functions/import-texte-incruste/index.ts` du dépôt reste
 * la source éditable.
 */
import { createClient } from "jsr:@supabase/supabase-js@2";

const SHA256 = "eb16f2b786ac81c4f7d5af76100e2d43f1e72652bc51706b71d94adf71287861";
const url =
  "https://api.apify.com/v2/key-value-stores/erajB3pBaZP0DQ3MA/records/import-texte-incruste.bundle.js";

const jeton = Deno.env.get("APIFY_TOKEN");
const res = await fetch(jeton ? `${url}?token=${jeton}` : url);
if (!res.ok) throw new Error(`import-texte-incruste bundle ${res.status}`);
const octets = new Uint8Array(await res.arrayBuffer());
const empreinte = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", octets)))
  .map((b) => b.toString(16).padStart(2, "0"))
  .join("");
if (empreinte !== SHA256) throw new Error("import-texte-incruste bundle altéré");
const src = new TextDecoder().decode(octets);
const sansImport = src.replace('import{createClient as q}from"jsr:@supabase/supabase-js@2";', "");
if (sansImport === src || !sansImport.includes("creer_contenu_texte_incruste")) {
  throw new Error("import-texte-incruste bundle illisible");
}
new Function("q", sansImport)(createClient);
