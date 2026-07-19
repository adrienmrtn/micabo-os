import { ASSETS } from "./assets.ts";

/**
 * Sert l'application compilée.
 *
 * Hébergement volontairement minimal : le projet Supabase existe déjà, ce qui
 * évite d'ouvrir un compte chez un hébergeur pour mettre le site en ligne.
 *
 * Les assets sont inlinés dans `assets.ts` (voir scripts/bundle-site.mjs) car
 * le CLI ne téléverse que les fichiers atteignables par un import.
 *
 * Le routage est en `#` (VITE_ROUTER=hash au build) : tout chemin inconnu rend
 * donc index.html, et le navigateur se débrouille avec le reste.
 */

const MIME: Record<string, string> = {
  html: "text/html; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  css: "text/css; charset=utf-8",
  svg: "image/svg+xml",
  json: "application/json",
};

function contentType(path: string): string {
  return MIME[path.split(".").pop()?.toLowerCase() ?? ""] ?? "text/plain; charset=utf-8";
}

Deno.serve((request) => {
  const url = new URL(request.url);

  // Le nom de la fonction fait partie du chemin public : on le retire pour
  // retrouver le chemin réel du fichier.
  let path = url.pathname.replace(/^\/functions\/v1\/site/, "").replace(/^\/site/, "");
  if (!path || path === "/") path = "/index.html";

  const body = ASSETS[path];

  if (body === undefined) {
    // Chemin inconnu : on rend l'app, qui gère elle-même ses routes.
    return new Response(ASSETS["/index.html"], {
      headers: { "content-type": MIME.html, "cache-control": "no-cache" },
    });
  }

  return new Response(body, {
    headers: {
      "content-type": contentType(path),
      // Les assets portent un hash dans leur nom : ils sont immuables.
      // index.html ne doit jamais être mis en cache, sinon un déploiement
      // suivant continuerait de servir l'ancien bundle.
      "cache-control": path.startsWith("/assets/")
        ? "public, max-age=31536000, immutable"
        : "no-cache",
    },
  });
});
