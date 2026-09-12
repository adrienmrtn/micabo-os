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


Même recette pour `assignation` et `minuit-vnext` (tree trop gros pour le MCP).
Le chargeur injecte `createClient` sous le nom `se` (assignation) et `$e`
(minuit-vnext) — relire le `import{createClient as …}` du bundle avant de
l’effacer : esbuild change l’alias d’un rebuild à l’autre.

`renettoyer-contenu` est passé au chargeur le 10/09/2026 : 158 Ko sur 18
fichiers, au-dessus des 108 Ko de `manage-users` qui suivait déjà cette recette.
L’enjeu n’est pas la taille brute mais `gemini.ts` (52 Ko de prompts) : recopié
à la main dans un appel MCP, un caractère qui saute ne se voit pas. Alias
courant : `H`. Attention, esbuild place l’`import{createClient …}` **au milieu**
du bundle, pas forcément en tête — le chercher, ne pas supposer la 1ʳᵉ ligne.

Passés au chargeur le 11/09/2026 avec la tierlist : `rattrapage-elo` (`ee`),
`revoquer-post` (`ie`), `creation-manuelle` (`C`) et `assignation-contenu`
(`ne`). Les quatre embarquent `assignation_contenu.ts` ou `rattrapage_elo.ts`,
donc tout le moteur — le tree d'`assignation` faisait déjà 337 Ko. Chaque
chargeur vérifie une sentinelle **ASCII** du bundle : esbuild échappe les
accents (`é` → `\u00e9`), une sentinelle accentuée ne matcherait jamais.

La sentinelle anti-troncature d'un chargeur doit être **structurelle** (nom de
colonne, id d'acteur Apify), jamais une phrase d'interface : le 11/09/2026 la
réécriture d'un message a fait disparaître « warmup fini » des bundles, et les
chargeurs auraient refusé de démarrer. `assignation`, `minuit-vnext` et
`assignation-contenu` vérifient désormais `date_publication_prevue`.

Passés au chargeur le 12/09/2026 avec le burn : `bruler-assignes` (`N`, 20 Ko)
et `bruler-texte-test` (`G`, 32 Ko). Les deux embarquent `gemini.ts` — ce n'est
pas la taille du bundle qui décide, c'est le tree source (144 et 273 Ko) et le
fait qu'un caractère perdu dans un prompt ne se voit pas. Sentinelles :
`burned_media_id` et `burn_analyses`.

Le même jour, `_shared/burn.ts` a été coupé en deux : `burn_file.ts` (file,
kick, invalidation — sans LLM) et `burn.ts` (analyse + rendu). Sans cette
coupe, `upscale-assignes` et `normaliser-format` traînaient `gemini.ts` pour un
seul appel de kick et passaient de 48 à 156 Ko, donc au chargeur. Quand un
module partagé n'a besoin du LLM que dans une partie de ses fonctions, le
couper coûte moins cher que deux chargeurs de plus.

Ne pas redéployer `papier-cm` depuis ce dépôt : la prod est en avance.
Le `papier_master.ts` embarqué par `minuit-vnext` est celui du dépôt, pas
celui de `papier-cm` v11.
