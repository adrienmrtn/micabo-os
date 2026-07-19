/**
 * Transforme le résultat de `npm run build` en module TypeScript.
 *
 * Le CLI Supabase ne téléverse que les fichiers atteignables par un import :
 * un dossier `static/` posé à côté de la fonction est ignoré. On inline donc
 * les assets dans un module, que la fonction importe normalement.
 *
 * Usage : DEPLOY_TARGET=supabase VITE_ROUTER=hash npm run build
 *         node scripts/bundle-site.mjs
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const DIST = "dist";
const OUT = "supabase/functions/site/assets.ts";

const files = {};

files["/index.html"] = readFileSync(join(DIST, "index.html"), "utf8");

for (const name of readdirSync(join(DIST, "assets"))) {
  files[`/assets/${name}`] = readFileSync(join(DIST, "assets", name), "utf8");
}

const entries = Object.entries(files)
  // JSON.stringify échappe correctement guillemets, backslashes et sauts de
  // ligne — écrire des template literals à la main casserait sur le premier
  // backtick présent dans le bundle.
  .map(([path, content]) => `  ${JSON.stringify(path)}: ${JSON.stringify(content)},`)
  .join("\n");

mkdirSync("supabase/functions/site", { recursive: true });
writeFileSync(
  OUT,
  `// Généré par scripts/bundle-site.mjs — ne pas modifier à la main.\n` +
    `export const ASSETS: Record<string, string> = {\n${entries}\n};\n`,
);

const total = Object.values(files).reduce((sum, c) => sum + c.length, 0);
console.log(
  `${Object.keys(files).length} fichiers inlinés (${Math.round(total / 1024)} Ko) → ${OUT}`,
);
