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
- Secrets moteur (`GEMINI`, `FAL`, `APIFY`, `CRON_SECRET`) : Edge Function
  Secrets du projet `qkmiwnmiwsvwkttldqgb` seulement.
- Slug unique : `micabo`. Pas de switcher, pas de `localStorage`
  `os-application-slug`, pas de fallback `application_id_sophia()`.
- Mails internes : domaine `micabo.app`.
- Signups publics : off.

## Schéma / crons

Après `db push`, unscheduler **tous** les jobs `cron.job`. Vérifier
`cron.job.command`. Ne rien relancer tant que l’humain n’a pas dit OK
après un test manuel.

## Upwork (Micabo seulement)

Le dashboard OS `/admin/upwork` est **lecture seule** : missions, funnel,
contrats HM, alertes « jours sans post ». Aucun envoi depuis l’OS.

- Org figé : `1990051114607612379` (Micabo). `list_accounts` d’abord ;
  si l’org n’est pas celle-là → stop. Jamais Maximilien / VIk Studios.
- Writes Upwork (poster, message, offre) : **cette convo** + confirm
  explicite. Pas de cron Supabase.
- Sync vers l’OS : Automation Cursor **toutes les 2 h** (pas `pg_cron`).

### Sweep 2 h (Automation Cursor)

Prompt à coller dans l’Automation (repo `adrienmrtn/micabo-os`, MCP
Upwork + Supabase, projet `qkmiwnmiwsvwkttldqgb`) :

1. `list_accounts` → garder uniquement org Micabo
   `1990051114607612379`.
2. `get_job_posting` action=list (pager `next_page` jusqu’à la fin).
3. `list_contracts` action=search (`ACTIVE`, `PAUSED`).
4. Appeler `select public.upwork_sync_appliquer($payload::jsonb)` avec
   `org_uid`, `ok`, `detail`, `missions[]` (`job_posting_id`, `titre`,
   `statut`, `type`, `created_time`, compteurs funnel), `contrats[]`
   (`contract_id` = `node.contract.id`, `titre`, `statut`,
   `freelancer_nom`, `freelancer_id`).
5. Ne **rien** envoyer sur Upwork. Ne pas confirmer de draft.
6. Si un compte / job / contrat pointe hors Micabo → stop, ne pas
   écrire.

Mettre en place l’Automation : Cursor → Automations → New → repo
`adrienmrtn/micabo-os` → trigger cron `0 */2 * * *` → coller le sweep
ci-dessus → activer Upwork MCP + Supabase MCP.
