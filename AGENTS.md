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
  Secrets du projet `qkmiwnmiwsvwkttldqgb` seulement. Le texte (Gemini)
  passe par Fal OpenRouter — pas de `GEMINI_API_KEY`.
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

Avant tout `functions deploy`, comparer avec `get_edge_function` : la prod peut
être en avance sur `main`.
