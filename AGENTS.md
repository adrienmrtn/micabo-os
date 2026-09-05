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

## Upwork (Micabo seulement)

Le dashboard OS `/admin/upwork` est **lecture seule**.
Page globale : HM, créateurs, jobs HM ouverts (par pays), jobs créateurs
ouverts (par pays). Dive `/admin/upwork/:langue` : mini-dashboard +
timeline **par personne qui a répondu** (HM puis jobs créateurs).
Missions **PUBLISHED seulement**. Aucun envoi.

- Org figé : `1990051114607612379` (Micabo). `list_accounts` d’abord ;
  si l’org n’est pas celle-là → stop. Jamais Maximilien / VIk Studios.
- Writes Upwork (poster, message, offre) : **cette convo** + confirm
  explicite. Pas de cron Supabase.
- Sync vers l’OS : Automation Cursor **toutes les 2 h** (pas `pg_cron`).

### Sweep 2 h (Automation Cursor)

Prompt à coller dans l’Automation (repo `adrienmrtn/micabo-os`, MCP
Upwork + Supabase + Slack, projet `qkmiwnmiwsvwkttldqgb`) :

1. `list_accounts` → org Micabo `1990051114607612379` seulement.
2. `get_job_posting` action=list, **uniquement statut PUBLISHED**.
   Pour chaque job : `action=get` (description, `totalInvitesSent`,
   `job_url`). Langue = pays dans titre/description.
3. `list_contracts` action=search (`ACTIVE`, `PAUSED`) puis `get` pour
   `job.id`, `startDate`.
4. Pour chaque job PUBLISHED : `list_client_proposals` status
   `messaged` **et** `hired` seulement (pas declined / all). Une
   approche = une personne qui a répondu. `action=get` pour
   `user.photoUrl` + `user.publicUrl`.
5. Slack : `slack_search_users` par nom / email. Si trouvé →
   `slack_ok=true` + `slack_user_id`.
6. `select public.upwork_sync_appliquer($payload::jsonb)` :
   missions PUBLISHED (`job_posting_id`, `titre`, `description`,
   `langue`, `statut`, `invites_sent`, funnel, `job_url`) ;
   contrats (`contract_id`, `job_posting_id`, `contrat_at`,
   `freelancer_nom`, `slack_ok`, `slack_user_id`) ;
   approches (`upwork_proposal_id`, `job_posting_id`, `nom`, `role`,
   `statut` messaged|hired, `resume_discussions`, `photo_url` depuis
   `user.photoUrl`, `upwork_profile_url` depuis `user.publicUrl`,
   flags contrat / Slack / OS / warmup / premier_post).
7. Ne **rien** envoyer. Pas de draft. Stop si hors Micabo.

Mettre en place l’Automation : Cursor → Automations → New → repo
`adrienmrtn/micabo-os` → trigger cron `0 */2 * * *` → coller le sweep
ci-dessus → activer Upwork MCP + Supabase MCP.
