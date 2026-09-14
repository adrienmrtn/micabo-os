# Agents — micabo OS

## Produit

micabo = éducation IA pour étudiants : cours / notes / PDF → flashcards,
révision ~10 min/jour.

- Ton : étude, examens, notes, révisions.
- Jamais de culture générale.
- Jamais le mot d’un autre produit dans un CTA (écrire `micabo` en minuscules).

## Retrait des modules annexes (0256, 14/09/2026)

Quatre modules sont **partis** : « Create a post » (`/admin/creation` +
`creation-manuelle`), « CM paper » (`/admin/papier` + `papier-cm` + les étapes
`papier_cm` / `papier_assign` de minuit + le type de compte `cm`), « AI
slideshows » (`/admin/ugc/slideshows`, une page vide) et « AI Videos »
(`/admin/ugc/videos` + `assignation-ugc-video`). La marque système
`ugc-ai-video` est supprimée de `labels` ; `hook` reste.

**Le schéma reste dormant** : rien n’est droppé. Les cinq tables `papier_*`
(0 ligne), `ugc_video_posts`, `comptes.type_compte`, `comptes.ugc_ai_video`,
`labels.ugc_ai_video`, `profiles.hm_ugc_ai_video` et `hm_ugc_video_labels`
sont toujours là — plus personne ne les écrit. Un compte n’a donc plus qu’un
type, et `comptesPoster.ts` a remplacé `comptesCm.ts`.

Ce qui **reste allumé** et ne doit pas être confondu avec le retrait : les
personas UGC (`/admin/ugc/personas`), le face swap slideshow (`comptes.ugc_ai`,
`contenus.ugc_compatible`, `ugc_face_swap.ts`) et le burn.

Deux morceaux ont été **sauvés** de fichiers supprimés parce que le moteur s’en
sert encore : `resoudreVisuelsAssignation` (garnissage d’une slide depuis la
biblio du label) vit dans `_shared/visuels_assignation.ts`, et les exemples
feed d’un label dans `src/features/moteur/promptsFeed.ts`.

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

## Qualification des créateurs (0253, 12/09/2026)

L'ELO compte est **retiré** — colonnes `comptes.score` / `score_maj_at`
supprimées, avec la pénalité de −5 par jour sans post, la moyenne pondérée et
les classements ELO du Pilotage. Un compte porte maintenant une **case** :

    INACTIF < MAUVAISES_VUES < PASSABLE < BIEN < STAR

Les règles vivent dans `_shared/qualification.ts` — module **pur**, réexporté
par `src/features/moteur/qualification.ts` et testé côté front (23 cas), pour
que l'écran et le moteur comptent pareil :

- **INACTIF** : ≤ 6 posts réellement publiés sur les 10 derniers **prévus** ;
- **MAUVAISES_VUES** : moyenne < 600 vues sur les 10 derniers **publiés** ;
- **BIEN** : moyenne ≥ 1 000 **et** ≥ 8 publiés sur 10 prévus ;
- **STAR** : moyenne > 10 000 **et** ≥ 9 publiés sur 10 prévus ;
- **PASSABLE** : tout le reste.

Deux points ont dû être tranchés, et ils sont dans le code :

1. « la moins bonne quand plusieurs cases » ne peut pas jouer entre BIEN et
   STAR, qui sont **emboîtées** — tout STAR remplit aussi BIEN, la règle prise
   au pied de la lettre dégraderait chaque STAR. Elle joue entre ce qui monte
   (vues, assiduité) et ce qui descend (inactivité, vues basses) : 50 000 vues
   avec 5 posts sur 10 → INACTIF.
2. « si moins de 10 prévus, prendre le nombre maximal de prévus » = la
   **proportion** fait foi (6/10, 8/10, 9/10) appliquée aux créneaux réellement
   eus. Sur 10 prévus on retombe sur l'énoncé.

Le créneau du jour est exclu de l'assiduité (il est encore ouvert), les posts
de test ne comptent nulle part, et un post publié mais non mesuré n'est pas un
zéro dans la moyenne.

**Quand** : à la FIN du drain `rattrapage-elo` (`rattrapageEloDrainLot`,
`restants === 0`), jamais au cron de minuit — le relevé des vues est asynchrone
et se termine bien après. Juger à minuit noterait chaque créateur sur la
veille. Une case posée à la main (`qualification_manuelle`) est **verrouillée**
tant qu'un admin ne rend pas la main au moteur.

### Surveillance des comptes (`/admin/surveillance`)

File des comptes INACTIF ou MAUVAISES_VUES, plus les comptes en **essai**
(80 h après `comptes.created_at`) qui entrent d'office 30 h avant la fin — une
échéance de contrat passe outre un skip. Quatre gestes :

- **skip** 7 jours (`surveillance_skip_jusqu_a`) ;
- **changer la case** à la main (verrouille) ou la rendre au moteur ;
- **nudge** : un message interne, choisi parmi `nudges_modeles`, affiché au
  créateur à sa prochaine connexion (`comptes_nudges` + `NudgePopup`). Il
  n'existe aucun canal hors OS : ni e-mail, ni SMS. Le corps est **copié** du
  modèle, pas référencé, et part dans la langue du COMPTE — pas celle de
  l'admin qui clique ;
- **ne pas renouveler** : liste de suivi (`ne_pas_renouveler`) avec la case
  « j'ai demandé au HM » (`hm_prevenu`). **Rien n'est coupé dans le process** :
  ni quota, ni assignation, ni désactivation. C'est une liste, pas un
  interrupteur.

L'essai de `/admin/essai` (5 jours) est un autre compteur, laissé tel quel :
80 h est le seuil de la file de surveillance, pas une redéfinition de l'essai.

## File de validation, formats et placement manuel (0257/0258, 14/09/2026)

**Rien n'entre dans le pool sans un admin.** Le pipeline d'import tourne comme
avant (OCR, pertinence, note /100 et tier d'entrée, nettoyage, format,
caption), mais il s'arrête sur `statut = 'brouillon'` + `import_statut = 'done'`
— cette paire, et elle seule, veut dire « en file ». Pas de nouvelle valeur
d'enum : `assignation_contenu.ts` filtrait déjà sur `valide`. Les variations
suivent la même porte. Le rejet automatique sous 55 est inchangé, et un
`rejete` ne repasse jamais par la file.

`/admin/file` ouvre un éditeur par slideshow : réordonner et supprimer des
slides, corriger le texte du deck source, poser des calques PNG (bibliothèque
globale `blocs_png`, gérée dans les Réglages), régler titre, format, labels,
tier, passages dus, musique, hashtags. Le montage est **aplati dans le
navigateur** — l'Edge n'a ni Pillow ni OpenCV, et le lambda de burn est un
moteur à part qu'on ne détourne pas. L'aplat est réécrit **sur le
`storage_path` existant** de l'image propre : `trouverPropreExistant` cherche
le préfixe `propre/<contenu>/<position>.`, un chemin suffixé casserait la
reprise d'import (même règle que `format_media.ts`). Le `burn_rendus` de la
slide est jeté ; `burn_analyses`, lu sur le BRUT qu'on ne touche jamais, reste
valable.

Refuser = suppression dure, à la main. La purge est un bouton, jamais une
échéance. Un slideshow validé se remet en file depuis sa fiche : les passages
et posts déjà créés ne bougent pas (ils portent leur propre copie des slides
et ne lisent jamais `contenus.statut`), seules les prochaines assignations
cessent de le piocher.

**Les formats ne jouent sur RIEN dans l'assignation** — ni filtre, ni
équilibrage, ni départage. Liste globale, facultative sur un slideshow,
reclassable après coup. Leur seule raison d'être est la carte « Par format »
des Analytics : vues moyennes sur les passages publiés ET mesurés, passages,
slideshows, tiers, requalifications, filtrable par langue et période,
croisable avec les labels. Croisé par label, un slideshow à deux labels compte
dans les deux lignes — le total n'est pas une part de 100 %.

**Placement micabo.** `contenus.placement_manuel` : posé, `integrateSophia` ne
tourne dans AUCUNE langue. La source part telle quelle, les autres langues sont
une simple traduction, et le prompt reçoit la consigne de garder `micabo.app`
littéral, de ne pas déplacer le CTA, de ne pas en inventer un deuxième. Non
posé, le comportement d'avant tient, `placementParDefaut` compris. Un deck
manuel est « prêt » dès qu'il a du texte : sans cette nuance,
`assurerDeckPourLangue` attendait un `position_sophia` qu'aucun modèle n'allait
plus poser et retraduisait à chaque passage.

## micabo.app est un SITE, et le reste (0260 puis 0261, 14/09/2026)

Aller-retour le même jour : 0260 avait basculé la marque sur l'application
mobile « micabo » (nom nu, sans `.app`), 0261 est revenu au site. La règle qui
tient est celle d'origine : **« le site micabo.app »**, en minuscules même en
début de phrase, « el sitio micabo.app » en espagnol, « the site micabo.app »
en anglais, et en turc la forme agglutinée « micabo.app sitesi / sitesini /
sitesine / sitesiyle » — jamais « site micabo.app », l'ordre français.

Deux choses que l'aller-retour a laissées derrière lui, à savoir :

- **Les 176 decks traduits vidés par 0260 ne sont pas revenus.** Les vider
  était le geste correct à ce moment (ils traduisaient une source qui venait de
  changer) mais il est sans retour : `assurerDeckPourLangue` les refait à
  l'assignation, avec le prompt courant. Comme le prompt redit « le site
  micabo.app », ils repartent justes — c'est du crédit Gemini, pas une perte de
  contenu.
- **Le texte des slides est canonique, pas d'origine.** La bascule écrasait
  l'information « quel mot de catégorie précédait le nom » : « le site
  micabo.app » et « micabo.app » nu donnaient tous deux « micabo ». Le retour
  remet donc « le site micabo.app » partout, y compris là où la slide disait
  le nom nu. C'est la forme que le prompt impose de toute façon.

La leçon générale : une réécriture de marque sur du texte existant n'est pas
réversible dès qu'elle fusionne deux formes en une. Avant d'en lancer une,
garder une colonne ou une table avec l'avant — sinon le retour ne peut être
qu'une reconstruction.

`micabo.app` reste par ailleurs le **domaine de messagerie interne**
(`prenom.n@micabo.app`), et `micabo` tout court le nom de l'OS et de la
plateforme : ne jamais les réécrire en cherchant la marque produit.

## Relevé des stats : une file, pas une fenêtre (0259, 14/09/2026)

`chargerPassagesFenetre` sélectionnait `date_publication_prevue IN (4 derniers
jours Paris)`. Un passage raté pendant ces quatre jours n'était **jamais**
repris : la fenêtre avait avancé. Constat du 14/09/2026 — sur 152 passages
publiés, 16 avaient `vues IS NULL` **et** `stats_maj_at IS NULL` ; ceux du 07
et du 08 étaient perdus définitivement.

Le critère est désormais l'état du passage, pas le calendrier
(`chargerPassagesARelever`) : jamais relevé d'abord, puis relevé il y a plus de
6 h, sur 30 jours de profondeur, les plus vieux devant. Trois garde-fous
l'accompagnent :

- **45 minutes de délai plancher** avant tout scrape. Le 13/09, deux posts
  publiés à 22:03 et 22:07 ont été scrapés à 22:07 : TikTok ne les avait pas
  indexés, et sans la file ils n'auraient jamais été mesurés.
- **Scrape profil dimensionné** sur le nombre de passages à retrouver
  (`postsAScraper` : double, plancher 12, plafond 40). À 12 fixe, un créateur
  qui poste aussi pour lui poussait nos posts hors de la liste.
- **25 passages par compte et par passe** : chaque passage sans match coûte un
  `scrapePost` Apify et l'invocation Edge meurt à 150 s. Le reste part à la
  passe suivante — il ne se perd plus, c'est tout l'intérêt.

Une **deuxième passe à 13:00 Paris** (`rattrapage-elo-midi`, planifiée par
`crons_stats_midi_planifier()`, qui ne touche à aucun autre job) s'ajoute à
minuit : un post du soir est mesuré ~15 h après au lieu de 26 h, et chaque
passage est vu deux fois avant le J+3 de la requalification.

Corollaire d'affichage : un passage `assigne` n'a rien à mesurer. Les afficher
comme les publiés jamais relevés donnait l'impression d'un relevé cassé alors
que 68 passages sur 220 n'étaient simplement pas publiés. `relevesStats.ts`
tranche les quatre états, et la fiche d'un slideshow porte un bouton « relever
maintenant » par passage manquant.

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

  **Et cette variable est posée sur Production SEULEMENT.** Conséquence, à
  connaître avant de s'inquiéter : **tout déploiement Preview échoue**, sur
  chaque PR, avec « Total bundle size (303.16 MB) exceeds the maximum function
  size (225 MB) ». Vérifié le 14/09/2026 sur les vingt derniers déploiements :
  7 production sur 7 en READY (avec `lambdaRuntimeStats: {"python":1}`), 13
  preview sur 13 en ERROR, de la PR #60 à la #67. Le front, lui, se construit :
  l'erreur tombe APRÈS le `vite build`, au moment d'empaqueter le lambda.

  Donc : un rouge sur un preview ne dit rien du code de la PR, et **ne bloque
  pas le merge** — le déploiement production qui suit passe. Pour avoir des
  previews verts, ajouter `VERCEL_SUPPORT_LARGE_FUNCTIONS=1` à
  l'environnement **Preview** du projet Vercel (Settings → Environment
  Variables), en plus de Production.

  Pister `requirements.txt` au passage : les bornes sont ouvertes
  (`opencv-python-headless>=4.9`). 303 Mo mesurés contre ~261 Mo attendus avec
  OpenCV 4.9 : la résolution est montée en 5.x. Ça ne fait pas passer sous les
  225 Mo — même épinglé à 4.9 on reste au-dessus, d'où la variable — mais
  épingler éviterait qu'un futur saut de version surprenne la production.

Le contrôle du moteur est `qa_selftest`, dans le moteur : il tourne sur chaque
slide et son rapport remonte jusqu'à la carte « Text burn-in (preview) » du
Moteur, qui affiche l'original TikTok et le rendu brûlé côte à côte, avec les
écarts mesurés et un badge rouge quand la livraison est refusée.

## PostgREST : une seule clé étrangère vers ce qu'on embarque

`comptes(… profiles(…))` se résout **par la clé étrangère**. Dès qu'une table
en a deux vers la même cible, PostgREST refuse de choisir et renvoie
« Could not embed because more than one relationship was found » — pas une
ligne de moins, **l'écran entier**.

Le 12/09/2026, trois colonnes d'audit (`qualification_manuelle_par`,
`ne_pas_renouveler_par`, `hm_prevenu_par`) ont été ajoutées à `comptes` avec,
par réflexe, une clé étrangère vers `profiles`. Sept requêtes sans rapport avec
la qualification sont tombées d'un coup : surveillance, fiche créateur,
calendrier, QA TikTok. Sur la page Posters l'erreur était pire qu'une erreur —
`listerComptes` échouait, le `?? []` la transformait en liste vide, et les 25
créateurs disparaissaient sans un mot.

Donc : **une colonne « qui a fait ça » se stocke en uuid nu, sans clé
étrangère** (0255). Et une lecture dont l'échec vide un écran doit **relever**
son erreur, jamais la remplacer par `?? []`.

Deuxième piège du même jour, même famille : **jamais de `or` entre deux
colonnes dans une policy RLS corrélée** (0254). `(ps.media_id = … or
ps.burned_media_id = …)` interdit l'accès par index et fait balayer la table
une fois par ligne lue — 5 951 ms sur la bibliothèque, au-dessus du
`statement_timeout`. Deux policies permissives sont OR-ées de toute façon :
couper en deux garde le même droit et rend chaque moitié indexable. Et vérifier
qu'un index existe sur la colonne jointe.

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
- Qualification (12/09/2026, 0253) : `rattrapage-elo` et `minuit-vnext` sont
 épinglés sur `ae13aac`. Ce sont les deux seuls chargeurs qui embarquent
 `rattrapage_elo.ts`. `minuit-vnext` était resté sur `814bb95` : le saut lui
 apporte aussi l'étape `burn` (0252), déjà en prod partout ailleurs.
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

- **Déploiement du 14/09/2026** (file de validation, formats, placement manuel,
 relevé des stats). Migrations `0256` → `0259` appliquées, dix chargeurs
 redéployés, test de vie `401` passé sur les dix. SHA épinglés : `b713af1`
 pour `manage-users` ; `edb0f0f` pour `assignation`, `assignation-contenu`,
 `bruler-assignes`, `bruler-texte-test`, `import-contenu`,
 `renettoyer-contenu` et `revoquer-post` ; `36f01d1` pour `minuit-vnext` et
 `rattrapage-elo`. `normaliser-format` et `upscale-assignes` n'ont pas bougé
 (`a82a89e`) : leurs bundles ressortent d'esbuild octet pour octet identiques.
 Six alias `createClient` ont été renommés au passage (`le`→`pe`, `ne`→`oe`,
 `me`→`ne`, `ie`→`ae`, `Ee`→`Ae`, `P`→`k`, `H`→`Y`).
- **Trois fonctions déployées n'ont plus de source ici** depuis `0256` :
 `papier-cm`, `creation-manuelle` et `assignation-ugc-video`. Elles ne sont
 plus appelées (ni cron, ni UI) et sont laissées en place : les supprimer
 détruirait le `papier-cm` v11, dont le code n'a jamais été dans le dépôt.
 Leurs chargeurs pointent sur d'anciens SHA que GitHub sert toujours, donc
 elles bootent encore — **ne jamais les rappeler** : `creation-manuelle` pose
 `statut = 'valide'` et court-circuiterait la file de validation.
- **Cron ajouté le 14/09/2026** : `rattrapage-elo-midi` (`0 11 * * *`, jobid
 47), posé par `crons_stats_midi_planifier()`. Les cinq jobs du pipeline
 minuit n'ont pas été touchés (jobids 41-45 conservés).

Avant tout `functions deploy`, comparer avec `get_edge_function` : la prod peut
être en avance sur `main`.
