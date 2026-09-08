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

Le planificateur pose cinq jobs depuis `0242_cron_assignation_journee.sql` :
minuit, ses deux filets de nuit, le drain ELO, et `minuit-vnext-journee`
(horaire). Ce dernier existe parce que le warmup finit à n’importe quelle
heure : sans lui, un créateur sorti de warmup après 06:00 Paris n’a aucun
post ce jour-là (personne ne le voit sous quota) alors que l’ELO le pénalise
déjà pour ne pas avoir publié. Une passe à vide ne fait rien.

Planifié le 07/09/2026 après test manuel : les cinq jobs sont actifs, tous en
`kick_edge_micabo` sur l’hôte Micabo. Ne pas rejouer le planificateur sans
nouveau OK — il désenfile et réenfile les cinq.

Toute commande cron appelle l’Edge via `public.kick_edge_micabo('<fn>', <jsonb>)` :
lui seul tient l’hôte et le secret. Corps JSON avec `jsonb_build_object`, jamais
un `'{"…":…}'::jsonb` écrit à la main — les guillemets ressortent échappés
quand la migration passe par un outil, et le job casse en silence au tick.

## Prod ≠ dépôt (à savoir avant de déployer)

Ce dépôt n’est **pas** la source de vérité de tout ce qui tourne sur
`qkmiwnmiwsvwkttldqgb`. Vérifié le 07/09/2026 :

- `papier-cm` (v11, déployée le 01/09) embarque sept modules `_shared/papier_*`
 absents d’ici et un `papier_master.ts` bien plus gros. La redéployer depuis ce
 dépôt est une régression. Schéma récupéré en `0237` / `0238`, code non.
- `suivi-rc` (déployée le 03/09) lit les charts RevenueCat du projet **Sophia**
 (`proj3f496a80`, cache `rc_metrics_cache` id `sophia`) : hors cloisonnement,
 aucune source ici. Son cron 4 h est **non planifié** — ne pas le relancer.
- `import-contenu` (v13) est le chargeur `_deploy` épinglé sur `217fdf3` : ce
 commit porte `relacherContenuApresPas`, donc le correctif imports coincés est
 déjà en prod. Rien à redéployer.
- `assignation` et `minuit-vnext` sont en **v7** depuis le 07/09 : chargeurs
 `_deploy` épinglés sur `b821612`, même recette que `import-contenu`. Le tree
 source reste éditable ; ne pas redéployer le tree (MCP tronque). Comparaison
 faite avant le déploiement : la v6 n’avait rien d’absent du dépôt
 (`extraireLabelsAssignables`, ELO 30/70, verdict pool). L’avertissement
 papier ne s’applique pas : le `papier_master.ts` de `minuit-vnext` est celui
 du dépôt (seul `papier-cm` v11 est en avance).

Avant tout `functions deploy`, comparer avec `get_edge_function` : la prod peut
être en avance sur `main`.
