# Bundles Edge trop gros pour le MCP

`deploy_edge_function` (MCP) ne passe pas un tree de 250 Ko : les appels
tronquent ou n'envoient qu'un stub. Pour `import-contenu` :

1. Regénérer le bundle depuis les sources (pas depuis ce chargeur) :

```
npx esbuild supabase/functions/import-contenu/index.ts \
  --bundle --format=esm --minify --legal-comments=none \
  --external:jsr:@supabase/supabase-js@2 \
  --outfile=supabase/functions/_deploy/import-contenu.bundle.js
```

2. Retirer la ligne `import{createClient as Me}from"jsr:@supabase/supabase-js@2";`
   du bundle (le chargeur injecte `createClient` sous le nom `Me`).
3. Pousser, coller le SHA dans `import-contenu.loader.ts`, redéployer
   **uniquement** le chargeur (`verify_jwt: false`).

Même recette pour `manage-users` (`manage-users.bundle.js` + `manage-users.loader.ts`).
Le chargeur injecte `createClient` sous le nom `me`.

Ne pas redéployer `papier-cm` depuis ce dépôt : la prod est en avance.
