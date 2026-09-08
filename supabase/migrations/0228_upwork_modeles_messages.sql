-- Messages pré-écrits, un par étape de la timeline, éditables dans l'OS.
--
-- Le texte final est composé côté OS (variables remplies, admin relit) et
-- c'est ce texte-là qui part dans la file : l'agent n'improvise rien.
--
-- Le contrat fait exception : le MCP Upwork ne sait créer qu'un brouillon
-- d'offre et renvoie une finalize_url. L'agent prépare, l'admin envoie.
-- La case « contrat envoyé » se clique comme « ajoutée à mon compte
-- Upwork », et se coche aussi toute seule dès qu'Upwork passe en offered.

create table if not exists public.upwork_modeles (
  id uuid primary key default gen_random_uuid(),
  cle text not null,
  role_cible text not null default 'hm' check (role_cible in ('hm', 'createur')),
  langue text not null default '*',
  corps text not null default '',
  maj_par uuid references public.profiles (id) on delete set null,
  maj_at timestamptz not null default now(),
  unique (cle, role_cible, langue)
);

alter table public.upwork_modeles enable row level security;

drop policy if exists upwork_modeles_admin on public.upwork_modeles;
create policy upwork_modeles_admin on public.upwork_modeles
  for all using (public.is_admin()) with check (public.is_admin());

grant select, insert, update, delete on public.upwork_modeles to authenticated;

-- Lien de finalisation du brouillon d'offre, rendu par Upwork.
alter table public.upwork_approches
  add column if not exists offre_finalize_url text;

alter table public.upwork_actions drop constraint if exists upwork_actions_type_check;
alter table public.upwork_actions add constraint upwork_actions_type_check
  check (type in (
    'arreter_recrutement', 'publier_job_hm', 'sourcer_hm', 'inviter_hm',
    'envoyer_message', 'preparer_contrat'
  ));

-- Le corps exact qui part sur Upwork, tel que l'admin l'a relu.
alter table public.upwork_actions
  add column if not exists message text;

alter table public.upwork_admin_flags
  add column if not exists contrat_envoye_ok boolean not null default false;

create or replace function public.upwork_marquer_flag(
  p_proposal_id text,
  p_flag text,
  p_ok boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'upwork: admin seulement';
  end if;

  if p_flag is distinct from 'upwork_ajoute_ok'
     and p_flag is distinct from 'contrat_envoye_ok' then
    raise exception 'upwork_flag: inconnu (%)', p_flag;
  end if;

  insert into public.upwork_admin_flags (upwork_proposal_id, maj_par, maj_at)
  values (p_proposal_id, auth.uid(), now())
  on conflict (upwork_proposal_id) do update set
    maj_par = excluded.maj_par,
    maj_at = now();

  if p_flag = 'upwork_ajoute_ok' then
    update public.upwork_admin_flags
    set upwork_ajoute_ok = coalesce(p_ok, false)
    where upwork_proposal_id = p_proposal_id;
    update public.upwork_approches
    set upwork_ajoute_ok = coalesce(p_ok, false)
    where upwork_proposal_id = p_proposal_id;
  else
    update public.upwork_admin_flags
    set contrat_envoye_ok = coalesce(p_ok, false)
    where upwork_proposal_id = p_proposal_id;
    update public.upwork_approches
    set contrat_envoye_ok = coalesce(p_ok, false)
    where upwork_proposal_id = p_proposal_id;
  end if;
end;
$$;

revoke all on function public.upwork_marquer_flag(text, text, boolean) from public, anon;
grant execute on function public.upwork_marquer_flag(text, text, boolean) to authenticated;

-- Compat : l'ancien nom pointe sur le même geste.
create or replace function public.upwork_marquer_ajout_upwork(
  p_proposal_id text,
  p_ok boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.upwork_marquer_flag(p_proposal_id, 'upwork_ajoute_ok', p_ok);
end;
$$;

-- --------------------------------------------------------------- modèles

insert into public.upwork_modeles (cle, role_cible, langue, corps) values
  ('pourparlers', 'hm', '*',
   'Bonjour {{prenom}},

Merci pour votre retour. Je suis Adrien, je lance micabo sur {{pays}} — une app d''éducation par IA : les étudiants transforment leurs cours et leurs PDF en flashcards et révisent une dizaine de minutes par jour.

Le rôle : recruter et piloter une petite équipe de créateurs TikTok sur {{pays}}, en autonomie. Environ 10 créateurs à terme.

Trois questions pour avancer :
1. Vous avez déjà recruté et encadré des créateurs de contenu ?
2. Combien d''heures par semaine pouvez-vous y consacrer ?
3. Vous démarreriez quand ?

À vous lire,
Adrien'),

  ('contrat_envoye', 'hm', '*',
   'Bonjour {{prenom}},

Parfait, on avance. Je vous envoie le contrat sur Upwork dans la foulée.

Une fois accepté, je vous ouvre l''accès à Slack et à l''OS micabo : vous y trouverez tout ce qu''il faut pour démarrer, et je reste dispo pour les premiers jours.

Adrien'),

  ('acces_envoyes', 'hm', '*',
   'Bonjour {{prenom}},

Bienvenue. Trois choses pour démarrer :

1. Slack — l''invitation part sur l''adresse email que vous m''avez donnée.
2. L''OS micabo — vos codes arrivent par email, connectez-vous une première fois pour valider le compte.
3. Répondez-moi ici quand les deux sont faits, je vous ajoute à mon compte Upwork.

Le guide complet est dans l''OS, onglet Documents.

Adrien'),

  ('integration', 'hm', '*',
   'Bonjour {{prenom}},

On est bons sur les accès. Prochaine étape : je poste votre job créateurs sur {{pays}} pour que vous puissiez commencer à recruter votre équipe.

Objectif : une dizaine de créateurs actifs. On avance par paliers, pas besoin de tout faire la première semaine.

Adrien'),

  ('job_createur_poste', 'hm', '*',
   'Bonjour {{prenom}},

Votre job créateurs est en ligne sur {{pays}}. Vous pouvez commencer à trier les candidatures.

Ce qu''on cherche : des profils capables de poster régulièrement en slideshow TikTok, dans la langue du pays. La régularité compte plus que l''expérience.

Dites-moi si vous voulez qu''on regarde les premiers profils ensemble.

Adrien'),

  ('pourparlers', 'createur', '*',
   'Bonjour {{prenom}},

Merci pour votre candidature. On cherche des créateurs TikTok pour micabo sur {{pays}} — une app d''éducation par IA pour les étudiants.

Le format : des slideshows courts, publiés régulièrement, dans la langue du pays. Tout le contenu vous est fourni, vous n''avez pas à l''écrire.

Deux questions :
1. Vous postez déjà sur TikTok ? Si oui, votre compte ?
2. Vous pouvez tenir un rythme de publication quotidien ?

À vous lire,
{{hm_prenom}}'),

  ('acces_envoyes', 'createur', '*',
   'Bonjour {{prenom}},

Bienvenue. Deux choses pour démarrer :

1. Slack — l''invitation part sur votre email.
2. L''OS micabo — vos codes arrivent par email, connectez-vous une première fois.

Ensuite on crée votre compte TikTok ensemble et on lance le warmup.

{{hm_prenom}}'),

  ('tiktok_cree', 'createur', '*',
   'Bonjour {{prenom}},

Il me manque votre compte TikTok pour lancer la suite. Créez-le et renseignez le pseudo dans l''OS (onglet Mon compte).

Dès qu''il est là, on démarre le warmup : 24 h sans publier, le temps que le compte se pose. Après ça, vous recevez vos premiers posts.

{{hm_prenom}}')
on conflict (cle, role_cible, langue) do nothing;

-- ---------------------------------------------------------------- actions

create or replace function public.upwork_message_envoyer(
  p_proposal_id text,
  p_corps text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  a record;
  nouvelle_id uuid;
  texte text;
begin
  if not public.is_admin() then
    raise exception 'upwork: admin seulement';
  end if;

  if p_corps is null or btrim(p_corps) = '' then
    raise exception 'upwork_message: corps vide';
  end if;

  if length(p_corps) > 10000 then
    raise exception 'upwork_message: trop long pour Upwork (10 000 caractères max)';
  end if;

  select ap.nom, ap.role, ap.job_posting_id, ap.upwork_proposal_id, m.langue
  into a
  from public.upwork_approches ap
  left join public.upwork_missions m on m.job_posting_id = ap.job_posting_id
  where ap.upwork_proposal_id = p_proposal_id;

  if not found then
    raise exception 'upwork_message: approche introuvable (%)', p_proposal_id;
  end if;

  texte :=
    'Envoie ce message à ' || a.nom
    || ' (' || coalesce(a.role, '?') || coalesce(' ' || a.langue, '') || ') sur Upwork.' || chr(10)
    || '1. list_accounts → org Micabo ' || public.upwork_org_uid_micabo()
    || ' uniquement. Sinon stop.' || chr(10)
    || '2. send_message action=message_proposal, job_posting_id=' || a.job_posting_id
    || ', proposal_id=' || p_proposal_id || '.' || chr(10)
    || '   Le message est le champ `message` de cette action, à envoyer'
    || ' **tel quel**. N''y touche pas, ne le traduis pas, n''ajoute rien.' || chr(10)
    || '3. select public.upwork_action_terminer(''<id>'', ''<résumé>'');' || chr(10)
    || 'Si l''envoi échoue, dis-le dans le résumé et n''essaie pas de reformuler.';

  insert into public.upwork_actions (
    type, upwork_proposal_id, cible_nom, cible_role, langue, prompt, message, demande_par
  )
  values (
    'envoyer_message', p_proposal_id, a.nom, a.role, a.langue, texte, p_corps, auth.uid()
  )
  returning id into nouvelle_id;

  update public.upwork_actions
  set prompt = replace(prompt, '''<id>''', quote_literal(nouvelle_id::text))
  where id = nouvelle_id;

  return nouvelle_id;
end;
$$;

revoke all on function public.upwork_message_envoyer(text, text) from public, anon;
grant execute on function public.upwork_message_envoyer(text, text) to authenticated;

-- Brouillon d'offre : l'agent prépare, l'admin envoie depuis Upwork.
create or replace function public.upwork_contrat_preparer(p_proposal_id text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  a record;
  nouvelle_id uuid;
  texte text;
begin
  if not public.is_admin() then
    raise exception 'upwork: admin seulement';
  end if;

  select ap.nom, ap.role, ap.job_posting_id, ap.upwork_freelancer_id, m.langue
  into a
  from public.upwork_approches ap
  left join public.upwork_missions m on m.job_posting_id = ap.job_posting_id
  where ap.upwork_proposal_id = p_proposal_id;

  if not found then
    raise exception 'upwork_contrat: approche introuvable (%)', p_proposal_id;
  end if;

  if exists (
    select 1 from public.upwork_actions
    where upwork_proposal_id = p_proposal_id
      and type = 'preparer_contrat' and statut = 'en_attente'
  ) then
    raise exception 'upwork_contrat: brouillon déjà demandé';
  end if;

  texte :=
    'Prépare le contrat de ' || a.nom
    || ' (' || coalesce(a.role, '?') || coalesce(' ' || a.langue, '') || ').'
    || ' Brouillon seulement : c''est l''admin qui envoie.' || chr(10)
    || '1. list_accounts → org Micabo ' || public.upwork_org_uid_micabo()
    || ' uniquement. Sinon stop.' || chr(10)
    || '2. list_contracts action=search puis get sur le dernier contrat '
    || coalesce(a.role, 'hm') || ' signé : reprends son taux horaire et son'
    || ' plafond hebdomadaire. Mêmes termes que l''équipe en place.' || chr(10)
    || '3. find_freelancers action=get_profile, person_id='
    || coalesce(a.upwork_freelancer_id, '<inconnu>')
    || ' → récupère vendor_org_uid.' || chr(10)
    || '4. manage_offers action=create_draft, org_uid='
    || public.upwork_org_uid_micabo()
    || ', vendor_user_id=' || coalesce(a.upwork_freelancer_id, '<inconnu>')
    || ', metadata {sourceType: JobApplication, sourceId: ' || p_proposal_id
    || ', jobPostingId: ' || a.job_posting_id || '}.' || chr(10)
    || '5. Le brouillon rend une finalize_url. Enregistre-la :' || chr(10)
    || '   select public.upwork_contrat_lien(' || quote_literal(p_proposal_id)
    || ', ''<finalize_url>'');' || chr(10)
    || '6. N''envoie PAS l''offre et ne confirme aucun preview d''envoi.'
    || ' L''admin relit et envoie depuis Upwork.' || chr(10)
    || '7. select public.upwork_action_terminer(''<id>'', ''<résumé>'');';

  insert into public.upwork_actions (
    type, upwork_proposal_id, cible_nom, cible_role, langue, prompt, demande_par
  )
  values (
    'preparer_contrat', p_proposal_id, a.nom, a.role, a.langue, texte, auth.uid()
  )
  returning id into nouvelle_id;

  update public.upwork_actions
  set prompt = replace(prompt, '''<id>''', quote_literal(nouvelle_id::text))
  where id = nouvelle_id;

  return nouvelle_id;
end;
$$;

revoke all on function public.upwork_contrat_preparer(text) from public, anon;
grant execute on function public.upwork_contrat_preparer(text) to authenticated;

create or replace function public.upwork_contrat_lien(p_proposal_id text, p_url text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.upwork_approches
  set offre_finalize_url = nullif(btrim(p_url), '')
  where upwork_proposal_id = p_proposal_id;
end;
$$;

revoke all on function public.upwork_contrat_lien(text, text) from public, anon, authenticated;
grant execute on function public.upwork_contrat_lien(text, text) to service_role;

-- ------------------------------------------------- « contrat envoyé » auto
--
-- Une offre partie fait passer la candidature en `offered` côté Upwork.
-- On dérive la case plutôt que de la faire cocher à la main.

alter table public.upwork_approches drop constraint if exists upwork_approches_statut_check;
alter table public.upwork_approches add constraint upwork_approches_statut_check
  check (statut in ('messaged', 'offered', 'hired'));

create or replace function public.upwork_approches_relier_os()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.upwork_approches a
  set profile_id = coalesce(
    (
      select uc.profile_id
      from public.upwork_contrats uc
      where uc.contract_id = a.contract_id
        and uc.profile_id is not null
    ),
    (
      select p.id
      from public.profiles p
      where lower(btrim(concat_ws(' ', p.prenom, p.nom))) = lower(btrim(a.nom))
      order by p.created_at
      limit 1
    )
  );

  update public.upwork_approches a
  set os_ok = (u.last_sign_in_at is not null)
  from public.profiles p
  left join auth.users u on u.id = p.id
  where a.profile_id = p.id;

  update public.upwork_approches a
  set os_ok = false
  where a.profile_id is null;

  update public.upwork_approches a
  set
    tiktok_handle = c.handle_tiktok,
    tiktok_cree_ok = true
  from public.comptes c
  where c.poster_id = a.profile_id
    and c.handle_tiktok is not null
    and btrim(c.handle_tiktok) <> '';

  update public.upwork_approches a
  set tiktok_cree_ok = false, tiktok_handle = null
  where a.tiktok_handle is null;

  -- Offre envoyée sur Upwork, contrat déjà rattaché, ou coche admin.
  update public.upwork_approches a
  set contrat_envoye_ok =
    a.statut in ('offered', 'hired')
    or a.contract_id is not null
    or exists (
      select 1 from public.upwork_admin_flags f
      where f.upwork_proposal_id = a.upwork_proposal_id
        and f.contrat_envoye_ok
    );

  update public.upwork_approches a
  set upwork_ajoute_ok = f.upwork_ajoute_ok
  from public.upwork_admin_flags f
  where f.upwork_proposal_id = a.upwork_proposal_id;
end;
$$;

revoke all on function public.upwork_approches_relier_os() from public, anon, authenticated;
grant execute on function public.upwork_approches_relier_os() to service_role;

select public.upwork_approches_relier_os();
