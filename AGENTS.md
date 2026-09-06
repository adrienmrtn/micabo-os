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
| `contrat_envoye_ok` | Upwork + admin | dérivé SQL (`offered` / contrat) **ou** clic sur la pastille |
| `slack_ok` (« rejoint Slack ») | Slack MCP | payload du sweep |
| `upwork_ajoute_ok` | admin | clic sur la pastille dans l'OS, jamais le sweep |
| `slack_envoye_ok` / `email_demande_ok` / `codes_ok` | OS + admin | après `envoyer_acces_hm` **ou** clic sur la pastille « accès envoyés » |

`os_ok` et `tiktok_cree_ok` sont recalculés par le trigger
`upwork_approches_relier_os` après chaque insert : **ne pas** les mettre
dans le payload, ils seraient écrasés. Pas de clé Apify ici, tout vient
de l'OS. `upwork_ajoute_ok`, `slack_envoye_ok`, `email_demande_ok` et
`codes_ok` sont conservés dans `upwork_admin_flags` et réappliqués
après le wipe du sync.

Chaîne HM (phase 1) : contacté → pourparlers → contrat envoyé → contrat
signé → accès envoyés → a rejoint (OS + Slack + Upwork) → job créateurs
posté. Le job créateurs, **c’est le HM qui le poste** depuis le compte
Upwork Micabo — jamais l’admin, jamais l’agent. Phase 2 (créateurs) :
**lecture seule**, on n’intervient pas — pas de message, pas de contrat,
pas d’accès, pas de compte OS. Le HM gère. On lit Upwork / l’OS :
réponse, contrat signé, Slack, TikTok, warmup, premier post.
Dès le **premier post**, le créateur passe en phase 3 (surveillance) :
lien TikTok, posts 10 j. / prévus, vues des 10 derniers, ELO. Le HM
voit la moyenne de son équipe. Alerte (⚠️) si rythme < 80 % ou vues
moy. < 500. Pas d'« onboarding » nulle part.

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

    pas de job (cette vague)      → publier_job_hm  (un post NEUF, même s'il en existe déjà)
    job publié, rien en attente   → sourcer_hm  (find_freelancers smart_search)
    des profils prêts             → inviter_hm  (invite_freelancer)
    un HM embauché sur CE job     → campagne terminée, file purgée
    job plus PUBLISHED            → campagne en pause

Relancer après un HM déjà en place : ça se cumule. Chaque clic publie
un nouveau job et recrute un HM de plus. On ne rattache jamais le job
HM déjà ouvert du pays.

`sourcer_hm` **n’invite personne** : il écrit des recommandations dans
`upwork_candidats`. L’admin valide ou refuse dans l’OS. Sans réponse
sous `delai_validation_h` (10 h par défaut), le profil devient invitable
tout seul — c’est évalué à la lecture par `upwork_candidats_a_inviter()`,
donc **aucun cron** n’est nécessaire, le passage 2 h suffit.

Dès qu’une personne répond, le sync la crée dans `upwork_approches` et
elle rejoint la chaîne HM classique. Rien de spécial à faire.

### Messages et contrats

Après **contrat signé** (HM), l’OS envoie les accès tout seul : il
crée le recruiter (`hiring_manager`, langue du pays, email `@micabo.app`),
compose le message (**lien Slack managers à cliquer** + email/mot de passe
OS + demande d’email) et pose `envoyer_acces_hm` dans la file. L’agent
envoie le champ `message` **tel quel**. Pas un gabarit. Si l’envoi a déjà
eu lieu hors file, l’admin coche la pastille.

`upwork_modeles` est le playbook des autres étapes (la suite à
couvrir), pas la lettre. Sur **Talks / pourparlers**, l’OS affiche le
**dernier message d’eux** (`dernier_message`) et compose une réponse
qui dépend de ce message — pas un « Noted: » + gabarit. Le playbook
ne sert que s’ils n’ont rien dit d’utilisable. **Français si le pays
est la France, anglais sinon** — invitations et brouillons compris,
jamais l’espagnol / l’allemand / etc. L’admin relit et
envoie. L’action `envoyer_message` porte le texte **fini** dans sa
colonne `message` : envoyer ce champ tel quel via `send_message`
action=message_proposal. Ne rien réécrire, ne rien traduire, ne rien
ajouter. Si l’envoi échoue, le dire dans le résumé — pas de reformulation.

Le contrat (HM, phase 1) ne part **jamais** de l’agent : `manage_offers`
ne sait faire qu’un brouillon. L’action `preparer_contrat` crée le draft,
reprend les termes du dernier contrat signé du même rôle, et range la `finalize_url`
avec `upwork_contrat_lien()`. C’est l’admin qui ouvre le lien et envoie.
La case « contrat envoyé » se clique comme « ajoutée à mon compte
Upwork », et se coche aussi toute seule au sync suivant quand Upwork
passe la candidature en `offered`.

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
 `messaged`, `offered` **et** `hired` seulement (pas declined /
 all). Une approche = une personne qui a répondu. `action=get`
 pour `user.photoUrl` + `user.publicUrl`. Puis
 `get_messages` `find_room` (context_type=proposal,
 context_id=proposal_id) + `list_messages` : le **dernier message
 d'eux** (`from_self` absent / false), verbatim, devient
 `dernier_message` + `dernier_message_at`. Pas le nôtre. Pas un
 résumé. `resume_discussions` reste le résumé court.
5. Slack : `slack_search_users` par nom / email. Si trouvé →
   `slack_ok=true` + `slack_user_id`.
6. `select public.upwork_sync_appliquer($payload::jsonb)` :
   missions PUBLISHED (`job_posting_id`, `titre`, `description`,
   `langue`, `statut`, `invites_sent`, funnel, `job_url`) ;
   contrats (`contract_id`, `job_posting_id`, `contrat_at`,
   `freelancer_nom`, `slack_ok`, `slack_user_id`) ;
   approches (`upwork_proposal_id`, `job_posting_id`, `nom`, `role`,
 `statut` messaged|offered|hired, `resume_discussions`,
 `dernier_message`, `dernier_message_at`, `photo_url` depuis
 `user.photoUrl`, `upwork_profile_url` depuis `user.publicUrl`,
   flags contrat / Slack / OS / warmup / premier_post ;
   `job_createur_id` = le job créateurs **de ce HM**, jamais le job
 du pays — un post = un HM).
 Ne pas envoyer `os_ok`, `tiktok_cree_ok`, `contrat_envoye_ok`,
 `upwork_ajoute_ok`, `slack_envoye_ok`, `email_demande_ok` ni
 `codes_ok` : l'OS les recalcule seul.
7. `select * from public.upwork_actions_en_attente()` : exécuter chaque
   `prompt` **tel quel**, puis
   `select public.upwork_action_terminer('<id>', '<résumé>')`.
   Rien à inventer, le prompt contient déjà la cible et les garde-fous.
   Cet appel replanifie les campagnes **et** les accès HM après contrat
   signé : c'est le seul point d'entrée.
   Terminer une action de campagne débloque la suivante au même passage,
   donc **relire la file** après chaque `upwork_action_terminer`.
8. Ne **rien** envoyer d'autre. Pas de draft. Stop si hors Micabo.

Mettre en place l’Automation : Cursor → Automations → New → repo
`adrienmrtn/micabo-os` → trigger cron `0 */2 * * *` → coller le sweep
ci-dessus → activer Upwork MCP + Supabase MCP.
