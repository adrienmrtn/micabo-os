# Agents — micabo OS

## Produit

micabo = éducation IA pour étudiants : cours / notes / PDF → flashcards,
révision ~10 min/jour.

- Ton : étude, examens, notes, révisions.
- Jamais de culture générale.
- Jamais le mot d’un autre produit dans un CTA (écrire `micabo` en minuscules).
- UGC AI VIDEO : laisser dormant, ne pas l’allumer.
- File Settings / least-used : jamais de label `ugc_ai_video` (ex. `test`)
  sur un créateur slideshow.

## Tierlist des slideshows (0250, en prod depuis le 11/09/2026)

Un slideshow porte **un tier** (`contenus.tier` : D, C, B, A, S, S+) et un
nombre de passages à effectuer (`passages_cible` : 0/1/2/4/8/16). Il n'y a plus
d'ELO par langue — `contenu_langues.score` est **gelé** (historique) et n'est
plus lu par le moteur.

- Import : note /100 = 30 % pertinence + 70 % vues source, régularisée
  (`kk = k/2`). <55 → non importé · 55–60 C · 60–70 B · ≥70 A. **Plafond :
  sans 10 000 vues sur le TikTok d'origine (`VUES_SOURCE_MIN_B_PLUS`), l'entrée
  se fait en C quelle que soit la note** — un slideshow très pertinent mais peu
  vu ne mérite pas 2 à 4 passages d'emblée, il remontera s'il performe chez
  nous. Une seule ligne `contenu_langues` est créée (langue source) ; les
  autres langues arrivent à la demande, à l'assignation (`assurerDeckPourLangue`).
- Cycle : les passages du cycle sont ceux créés depuis `tier_maj_at`, hors
  reposts bonus et hors posts test. Quand ils sont tous publiés **et** mesurés
  (3 jours après publication), minuit requalifie sur `m` = moyenne des vues :
  bandes absolues (<600 D · <1 000 C · <5 000 B · <30 000 A · <150 000 S ·
  sinon S+), jamais plus d'un cran de descente, et il faut 1 000 vues pour
  sortir de D. Cycle qui traîne → requalification forcée à 14 jours.
- Assignation : tirage **au hasard** parmi les slideshows du pool (labels ∩,
  toutes langues) qui ont encore des passages dus — mais **un C n'est tiré que
  si le pool n'a plus rien en B ou mieux**. Plus de softmax, plus de pénalité
  de saturation, plus de « jamais deux fois le même post » (mais jamais deux
  fois le même jour sur le même compte). S'il n'y a pas assez de passages dus,
  un slideshow en D est repêché avec un cycle d'un passage.
- Le quota d'un créateur (`posts_par_jour`) **ne baisse plus jamais**.
- Repost bonus : un passage > 50 000 vues rejoue le même post sur le même
  compte à J+7 (`reposts_bonus`). Hors cycle, mais dans le quota du jour ;
  abandonné si le créneau est passé.

L'**ELO compte** (`comptes.score`) est inchangé : moyenne pondérée des ≤10
derniers posts mesurés, −5 par jour actif sans publication, skip warmup.

## Burned (0252, 12/09/2026)

Un compte coché `comptes.burned` reçoit ses slides **texte déjà incrusté** : ni
image vierge, ni texte à replacer. Le rendu est déterministe et vit sur Vercel,
pas sur l'Edge — Deno n'a ni Pillow, ni numpy, ni OpenCV.

**Le moteur est le burn-kit, tel quel.** `api/burn_engine.py` est le
`burn/engine.py` du kit à une adaptation près, commentée dans le fichier : le
kit résout `fonts/` depuis le dossier courant, qu'un lambda n'a pas, donc les
chemins passent par le dossier du module. `api/burn_pipeline.py` est son
`pipeline.py` ramené à un appel HTTP — les deux appels LLM (lecture du style,
traduction) vivent côté Edge, qui a la clé et les decks, et leur résultat arrive
en entrée. `api/burn.py` n'est qu'une enveloppe HTTP. Le protocole est dans
`docs/burn-RECETTE.md` et `docs/burn-kit-README.md` : **s'y tenir à la lettre**,
ne pas garder « au cas où » un bout d'un moteur maison.

Trois règles non négociables du kit :

1. **Le LLM lit et traduit, Python mesure et dessine.** Aucune valeur numérique
   ne sort de l'estimation d'un modèle : la boîte et la couleur annoncées sont
   des indices, jamais des mesures.
2. **Reproduire avant de traduire.** Le moteur redessine le texte *source* avec
   le spec calculé, le re-mesure avec le même code et compare à la capture :
   position à 0,5 % de la largeur d'image près, largeur d'encre à 2 % près,
   coupures de lignes identiques. Tant que ça ne passe pas, la traduction n'est
   pas rendue.
3. **La taille se cale sur la LARGEUR, jamais sur la hauteur d'x.** Le seuil du
   masque gonfle la hauteur d'x de 2 à 3 px → taille 10 % trop grande → tracking
   négatif pour rattraper → mots collés.

L'ordre des étapes, dans `run_slide` : recalage ORB + RANSAC brut → propre
(repli sur le rapport de largeurs sous 50 inliers) ; lecture LLM (`READ_PROMPT`,
JSON strict, bbox **en pixels**) ; mesure au pixel ; identification de la police
par `font_score` et verdict visuel ; traduction (un appel par carrousel, avec un
`text_short` de repli) ; re-découpe par `wrap_paragraphs` ; rendu Pillow
(SS = 3, caractère par caractère, masques en niveaux de gris, contour puis
remplissage) ; `qa_selftest`.

**La lecture est faite par Claude, et seulement par Claude**
(`MODELES_LECTURE_BURN` dans `gemini.ts` : `anthropic/claude-opus-5` puis
`anthropic/claude-sonnet-5`, par le routeur OpenRouter de Fal — un identifiant
déjà préfixé passe tel quel, aucune plomberie à changer). C'est le seul endroit
du burn où un modèle parle ; tout le reste est mesuré. `gemini-2.5-flash` n'y
tient pas : une bbox à 20 px près ou une coupure de ligne inventée fait échouer
un autotest dont la tolérance est 0,5 % de la largeur d'image. **Pas de repli
vers un modèle plus faible** : la lecture est mise en cache dans
`burn_analyses`, donc une mauvaise lecture ne rate pas une slide, elle la rate
définitivement. `burn_analyses.modele` porte désormais le modèle qui a répondu,
préfixé `burn-kit/read_style:` ; une ligne sans ce préfixe est une lecture
Gemini ou d'avant le kit, et elle est relue au lieu d'être resservie.

`api/fonts/` contient **exactement** ce que télécharge `api/fonts/fetch_fonts.sh`
(24 fichiers, 1,7 Mo) : TikTok Sans 500/600/700, Figtree, Mulish, Playfair
Display, Bodoni Moda, plus DejaVu Sans en repli de glyphes. Ni en ajouter, ni en
retirer : `candidates_for_style` restreint les candidats au bon genre avant de
les noter, et une graisse de plus déplace le score.

**Résultat honnête sur notre stock : 2 zones sur 27 passent l'autotest**, donc
presque toutes les slides repartent en classique. La cause est isolée et n'est
pas dans le rendu : `color_mask` isole le texte **par la couleur seule**, et nos
slides sont posées sur des tableaux blancs ou des pastilles claires — le fond
entre dans le masque et l'autotest compte 6 lignes là où il y en a 2, alors que
la mesure, elle, est juste (TikTok Sans 500, 111,4 px sur la paire de contrôle).
Croiser le masque avec la plaque propre — une ligne — remonte à 8-9/27 ; **c'est
délibérément non fait** : le kit est le modèle, verbatim. Toute reprise de ce
sujet se discute avec Adrien avant d'être codée.

Le reste du chemin :

- deux caches, indépendants du compte : `burn_analyses` (lecture du LLM, une
  fois par slide) et `burn_rendus` (image finale, une fois par slide + langue),
  rangée sous `burned/<contenu>/<langue>/<position>.jpg` ;
- `bruler-assignes` draine le jour, hors du chemin de minuit. Il est entraîné
  par l'étape `burn` de `minuit-vnext` — laquelle part aussi avec `assignation`,
  donc le filet des 15 minutes le couvre sans job pg_cron de plus — et par la
  fin du drain `upscale-assignes` (le burn vient **après** l'upscale) ;
- repli permanent : une slide non brûlée part avec l'image propre et
  `texte_overlay`, qui reste rempli. `BURN_SECRET` absent = burn désactivé,
  aucune slide marquée en échec ; `post_slides.burn_erreur` dit pourquoi une
  slide n'a pas été brûlée ;
- secret partagé `BURN_SECRET` (Edge **et** Vercel) + `BURN_URL` facultatif
  côté Edge. `GET /api/burn` dit ce que le lambda embarque vraiment : polices
  chargées, table de glyphes lisible, secret posé ;
- **le lambda ne tient pas dans un build Vercel standard.** OpenCV pèse 136 Mo
  installés (4.9) à 153 Mo (5.0), numpy 73, fontTools 30, Pillow 22 : ~300 Mo
  là où le build standard plafonne à 225 Mo une fois les dépendances
  optimisées. Le déblocage est une variable de projet Vercel,
  `VERCEL_SUPPORT_LARGE_FUNCTIONS=1` (Large Functions, bêta publique, Python
  jusqu'à 5 Go sur Fluid compute) — pas une coupe dans le moteur. Sans elle, le
  build échoue en `LAMBDA_SIZE_EXCEEDED` et la prod reste sur le déploiement
  précédent : l'Edge parle alors le contrat du kit à un moteur qui ne le
  comprend pas, et **toutes** les slides repartent en classique.
  `excludeFiles` sort du lambda ce qui ne sert pas à `api/burn.py` (front,
  sources Edge, docs) : ~9 Mo, de l'hygiène, pas la solution.

Le contrôle du moteur est `qa_selftest`, dans le moteur : il tourne sur chaque
slide et son rapport remonte jusqu'à la carte « Text burn-in (preview) » du
Moteur, qui affiche l'original TikTok et le rendu brûlé côte à côte, avec les
écarts mesurés et un badge rouge quand la livraison est refusée.

## Cloisonnement (non négociable)

Tu travailles **uniquement** dans `adrienmrtn/micabo-os`.

- Supabase : `qkmiwnmiwsvwkttldqgb` uniquement
  (`https://qkmiwnmiwsvwkttldqgb.supabase.co`).
- Vercel : projet `micabo-os`.
- Interdit : dump, remote, secrets, users, comptes, sources, médias, prompts
  live d’un autre OS.
- Si un cron, un secret ou une URL pointe vers `mbikecieskoobeizixig` → stop,
  corriger. Ne pas rescheduler les crons sans OK manuel.

## Technique

- Front Vite : `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (type Config
  sur Vercel, jamais Secret, jamais `service_role`).
- Secrets moteur (`FAL_KEY`, `APIFY_TOKEN`, `CRON_SECRET`) : Edge Function
  Secrets du projet `qkmiwnmiwsvwkttldqgb` seulement. Seule exception :
  `BURN_SECRET`, posé des deux côtés (Edge + Vercel) parce qu'il ferme le
  moteur de rendu `api/burn.py` — il ne donne accès à rien d'autre. Le texte (Gemini)
  passe par Fal OpenRouter — pas de `GEMINI_API_KEY`.
- Côté Vercel, `VERCEL_SUPPORT_LARGE_FUNCTIONS=1` n'est pas un secret mais une
  condition de build : sans elle, `api/burn.py` dépasse la taille maximale d'un
  lambda Python standard et le déploiement échoue (voir Burned).
- Slug unique : `micabo`. Pas de switcher, pas de `localStorage`
  `os-application-slug`, pas de fallback `application_id_sophia()`.
- Mails internes : domaine `micabo.app`.
- Signups publics : off.

## Schéma / crons

Après `db push`, unscheduler **tous** les jobs `cron.job`. Vérifier
`cron.job.command`. Ne rien relancer tant que l’humain n’a pas dit OK
après un test manuel.

Une fois le OK donné, le pipeline minuit se remet par
`select * from public.crons_minuit_planifier();` — jamais en recopiant la
commande d’un job existant (`0163_cutover_assignation_vnext.sql` recopie
l’hôte `mbikecieskoobeizixig`). Détails et vérifications :
`supabase/migrations/0236_crons_minuit.sql`.

Le planificateur pose cinq jobs (`0242_cron_assignation_journee.sql`, révisé
par `0251_filet_assignation_15min.sql`) : minuit, ses deux filets de nuit, le
drain ELO, et `minuit-vnext-journee` — **toutes les 15 minutes**. Ce dernier
existe parce que le warmup finit à n'importe quelle minute : sans lui, un
créateur sorti de warmup après 06:00 Paris n'a aucun post ce jour-là (personne
ne le voit sous quota) alors que l'ELO le pénalise déjà pour ne pas avoir
publié. Une passe à vide ne fait rien — c'est ce qui permet de tourner au
quart d'heure sans coût.

Planifié le 07/09/2026 après test manuel : les cinq jobs sont actifs, tous en
`kick_edge_micabo` sur l’hôte Micabo. Ne pas rejouer le planificateur sans
nouveau OK — il désenfile et réenfile les cinq.

Le 11/09/2026, après OK explicite, `minuit-vnext-journee` est passé de
`0 * * * *` à `*/15 * * * *` — par un `cron.schedule` sur ce seul nom (jobid 44
conservé), pas en rejouant le planificateur : les quatre autres jobs n'ont pas
été touchés. Préférer toujours cette voie pour changer un seul job.

Toute commande cron appelle l’Edge via `public.kick_edge_micabo('<fn>', <jsonb>)` :
lui seul tient l’hôte et le secret. Corps JSON avec `jsonb_build_object`, jamais
un `'{"…":…}'::jsonb` écrit à la main — les guillemets ressortent échappés
quand la migration passe par un outil, et le job casse en silence au tick.

## Prod ≠ dépôt (à savoir avant de déployer)

Ce dépôt n’est **pas** la source de vérité de tout ce qui tourne sur
`qkmiwnmiwsvwkttldqgb`. Vérifié le 11/09/2026 :

- `papier-cm` (v11, déployée le 01/09) embarque sept modules `_shared/papier_*`
 absents d’ici et un `papier_master.ts` bien plus gros. La redéployer depuis ce
 dépôt est une régression. Schéma récupéré en `0237` / `0238`, code non.
- `suivi-rc` (déployée le 03/09) lit les charts RevenueCat du projet **Sophia**
 (`proj3f496a80`, cache `rc_metrics_cache` id `sophia`) : hors cloisonnement,
 aucune source ici. Son cron 4 h est **non planifié** — ne pas le relancer.
- Sept fonctions sont des chargeurs `_deploy` depuis le 11/09/2026 (tierlist) :
 `assignation` (v9), `minuit-vnext` (v8) et `import-contenu` (v15) épinglés sur
 `5d8255d` ; `rattrapage-elo` (v9), `revoquer-post` (v8), `creation-manuelle`
 (v8) et `assignation-contenu` (v8) épinglés sur `dd59237`. Les trees sources
 restent éditables ; ne pas redéployer un tree par-dessus un chargeur, et
 regénérer le bundle (recette `_deploy/README.md`) à chaque changement du
 moteur. Avant ce passage : `assignation` était en v8 **tree** (337 Ko déployés
 le 08/09, fidèles au dépôt — le MCP ne tronque plus), `minuit-vnext` et
 `import-contenu` en chargeur sur `b821612` / `066e7d6`. L'avertissement papier
 ne s'applique pas : le `papier_master.ts` de `minuit-vnext` est celui du dépôt
 (seul `papier-cm` v11 est en avance).

- Depuis le 12/09/2026 (burn), les chargeurs sont **onze** : s'ajoutent
 `bruler-assignes`, `bruler-texte-test`, `upscale-assignes` et
 `normaliser-format`. Les SHA épinglés sont ceux du commit
 qui porte les bundles, pas celui de `main` après squash — GitHub continue de
 servir les commits de branche.
- Passage au moteur du kit (12/09/2026, fin de journée) : `assignation`,
 `assignation-contenu`, `bruler-assignes`, `bruler-texte-test`,
 `creation-manuelle`, `import-contenu`, `renettoyer-contenu` et `revoquer-post`
 sont épinglés sur `f4da0b9` — huit bundles bougent parce que `gemini.ts` a
 changé, et `gemini.ts` est tiré par tout le moteur de deck. L'alias que
 `new Function(...)` passe au bundle est **renommé par esbuild à chaque
 rebuild** : relire le `import{createClient as …}` du bundle avant de l'effacer
 et reporter le nom dans le chargeur, sinon la fonction boote sur un
 `ReferenceError`. Test de vie après déploiement : un POST anonyme doit rendre
 `401 {"error":"unauthorized"}` — un chargeur cassé rend un 500.

Avant tout `functions deploy`, comparer avec `get_edge_function` : la prod peut
être en avance sur `main`.
