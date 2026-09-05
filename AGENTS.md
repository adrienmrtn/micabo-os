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

Le dashboard OS `/admin/upwork` est **lecture seule sur Upwork** : les
seules écritures OS sont la coche admin et la file d'actions ci-dessous.
Page globale : dernier passage de l'agent, prompts prêts, HM, créateurs,
jobs HM ouverts (par pays), jobs créateurs ouverts (par pays). Dive
`/admin/upwork/:langue` : mini-dashboard + timeline **par personne qui a
répondu** (HM puis jobs créateurs), tout replié par défaut.
Missions **PUBLISHED seulement**. Aucun envoi.

### Qui dit vrai sur une case

| Case | Source | Qui l'écrit |
| --- | --- | --- |
| `os_ok` (« rejoint l'OS ») | OS | dérivé SQL : `auth.users.last_sign_in_at` |
| `tiktok_cree_ok` (« compte TikTok créé ») | OS | dérivé SQL : `comptes.handle_tiktok` |
| `slack_ok` (« rejoint Slack ») | Slack MCP | payload du sweep |
| `upwork_ajoute_ok` | admin | coche dans l'OS, jamais le sweep |

`os_ok` et `tiktok_cree_ok` sont recalculés par le trigger
`upwork_approches_relier_os` après chaque insert : **ne pas** les mettre
dans le payload, ils seraient écrasés. Pas de clé Apify ici, tout vient
de l'OS. `upwork_ajoute_ok` est conservé dans `upwork_admin_flags` et
réappliqué après le wipe du sync.

Chaîne HM : contacté → pourparlers → contrat envoyé → contrat signé →
accès envoyés → a rejoint (OS + Slack + Upwork) → job créateurs posté.
Chaîne créateur : … → accès envoyés → a rejoint (OS + Slack) →
**compte TikTok créé** → warmup actif → premier post.
Pas d'« onboarding » nulle part.

- Org figé : `1990051114607612379` (Micabo). `list_accounts` d’abord ;
  si l’org n’est pas celle-là → stop. Jamais Maximilien / VIk Studios.
- Writes Upwork (poster, message, offre) : **cette convo** + confirm
  explicite, **ou** une action de la file écrite depuis l’OS par l’admin.
  Rien d’autre. Pas de cron Supabase.
- Sync vers l’OS : Automation Cursor **toutes les 2 h** (pas `pg_cron`).

### Campagne de recrutement HM (un pays)

L’admin clique « Lancer le recrutement HM » sur `/admin/upwork/:langue`.
Ce clic **est** la validation humaine : il est tracé
(`upwork_campagnes.lance_par` / `lance_at`). L’OS n’appelle jamais Upwork,
il pose l’état ; `upwork_campagnes_planifier()` en déduit la prochaine
action et la met dans la file. Une seule action de campagne à la fois.

    pas de job                    → publier_job_hm
    job publié, rien en attente   → sourcer_hm  (find_freelancers smart_search)
    des profils prêts             → inviter_hm  (invite_freelancer)
    un HM embauché sur le pays    → campagne terminée, file purgée
    job plus PUBLISHED            → campagne en pause

`sourcer_hm` **n’invite personne** : il écrit des recommandations dans
`upwork_candidats`. L’admin valide ou refuse dans l’OS. Sans réponse
sous `delai_validation_h` (10 h par défaut), le profil devient invitable
tout seul — c’est évalué à la lecture par `upwork_candidats_a_inviter()`,
donc **aucun cron** n’est nécessaire, le passage 2 h suffit.

Dès qu’une personne répond, le sync la crée dans `upwork_approches` et
elle rejoint la chaîne HM classique. Rien de spécial à faire.

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
   flags contrat / Slack / OS / warmup / premier_post ;
   `job_createur_id` = le job créateurs **de ce HM**, jamais le job
   du pays — un post = un HM).
   Ne pas envoyer `os_ok`, `tiktok_cree_ok` ni `upwork_ajoute_ok` :
   l'OS les recalcule seul.
7. `select * from public.upwork_actions_en_attente()` : exécuter chaque
   `prompt` **tel quel**, puis
   `select public.upwork_action_terminer('<id>', '<résumé>')`.
   Rien à inventer, le prompt contient déjà la cible et les garde-fous.
   Cet appel replanifie les campagnes : c'est le seul point d'entrée.
   Terminer une action de campagne débloque la suivante au même passage,
   donc **relire la file** après chaque `upwork_action_terminer`.
8. Ne **rien** envoyer d'autre. Pas de draft. Stop si hors Micabo.

Mettre en place l’Automation : Cursor → Automations → New → repo
`adrienmrtn/micabo-os` → trigger cron `0 */2 * * *` → coller le sweep
ci-dessus → activer Upwork MCP + Supabase MCP.
