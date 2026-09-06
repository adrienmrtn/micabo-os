-- Stop demandé : le prochain passage archive la candidature sur Upwork
-- (decline = seule écriture dispo) puis l'OS ne la ramène plus.
-- Accès envoyés : le profil hiring_manager est créé avec les codes du message.

alter table public.upwork_admin_flags
  add column if not exists arrete_ok boolean not null default false;

alter table public.upwork_approches
  add column if not exists arrete_ok boolean not null default false;

insert into public.upwork_admin_flags (upwork_proposal_id, arrete_ok, maj_at)
select distinct a.upwork_proposal_id, true, now()
from public.upwork_actions a
where a.type = 'arreter_recrutement'
  and a.statut in ('en_attente', 'fait')
  and a.upwork_proposal_id is not null
on conflict (upwork_proposal_id) do update set
  arrete_ok = true,
  maj_at = now();

update public.upwork_approches a
set arrete_ok = true
from public.upwork_admin_flags f
where f.upwork_proposal_id = a.upwork_proposal_id
  and f.arrete_ok;

create or replace function public.upwork_stop_en_attente(p_proposal_id text)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.upwork_actions
    where upwork_proposal_id = p_proposal_id
      and type = 'arreter_recrutement'
      and statut = 'en_attente'
  );
$$;

revoke all on function public.upwork_stop_en_attente(text) from public, anon;
grant execute on function public.upwork_stop_en_attente(text) to authenticated, service_role;

create or replace function public.upwork_approche_archiver(p_proposal_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid;
begin
  if p_proposal_id is null or btrim(p_proposal_id) = '' then
    return;
  end if;

  insert into public.upwork_admin_flags (upwork_proposal_id, arrete_ok, maj_at)
  values (p_proposal_id, true, now())
  on conflict (upwork_proposal_id) do update set
    arrete_ok = true,
    maj_at = now();

  select profile_id into uid
  from public.upwork_approches
  where upwork_proposal_id = p_proposal_id;

  update public.upwork_approches
  set profile_id = null, arrete_ok = true
  where upwork_proposal_id = p_proposal_id;

  if uid is not null then
    perform public.supprimer_auth_user(uid);
  end if;

  delete from public.upwork_approches
  where upwork_proposal_id = p_proposal_id;
end;
$$;

revoke all on function public.upwork_approche_archiver(text) from public, anon, authenticated;
grant execute on function public.upwork_approche_archiver(text) to service_role;

create or replace function public.upwork_prompt_arreter(
  p_proposal_id text,
  p_action_id uuid
)
returns text
language plpgsql
stable
set search_path = public
as $$
declare
  a record;
begin
  select
    ap.nom,
    ap.role,
    ap.contract_id,
    ap.job_posting_id,
    ap.upwork_profile_url,
    ap.profile_id,
    m.langue
  into a
  from public.upwork_approches ap
  left join public.upwork_missions m on m.job_posting_id = ap.job_posting_id
  where ap.upwork_proposal_id = p_proposal_id;

  return
    'Arrête le recrutement de ' || coalesce(a.nom, p_proposal_id)
    || ' (' || coalesce(a.role, '?') || coalesce(' ' || a.langue, '') || ').' || chr(10)
    || '1. list_accounts → org Micabo ' || public.upwork_org_uid_micabo()
    || ' uniquement. Sinon stop.' || chr(10)
    || '2. Upwork — archive la candidature (pas d''API archive : decline).' || chr(10)
    || '   manage_client_proposals action=decline,' || chr(10)
    || '   proposal_id=' || p_proposal_id
    || ', job_posting_id=' || coalesce(a.job_posting_id, '?') || ',' || chr(10)
    || '   reason=Job is no longer available. Pas de message au freelancer.' || chr(10)
    || '   Puis confirm_preview action=confirm type=proposal_decline'
    || ' avec le preview_id rendu.' || chr(10)
    || '   Déjà declined / hidden / room closed : note-le et passe à 3.' || chr(10)
    || coalesce('   Contrat à clore : ' || a.contract_id || '.' || chr(10), '')
    || coalesce('   Profil : ' || a.upwork_profile_url || chr(10), '')
    || '3. OS — select public.upwork_action_terminer('
    || quote_literal(p_action_id::text) || ', ''<résumé>'');' || chr(10)
    || '   L''OS retire la fiche et le compte s''il en a un'
    || coalesce(' (profile ' || a.profile_id::text || ')', '') || '.' || chr(10)
    || 'Ne fais rien d''autre. Stop si l''org n''est pas Micabo.';
end;
$$;

revoke all on function public.upwork_prompt_arreter(text, uuid) from public, anon;
grant execute on function public.upwork_prompt_arreter(text, uuid) to authenticated, service_role;

create or replace function public.upwork_action_creer(
  p_type text,
  p_proposal_id text,
  p_note text default null
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

  if p_type is distinct from 'arreter_recrutement' then
    raise exception 'upwork_action: type inconnu (%)', p_type;
  end if;

  select
    ap.nom,
    ap.role,
    m.langue
  into a
  from public.upwork_approches ap
  left join public.upwork_missions m on m.job_posting_id = ap.job_posting_id
  where ap.upwork_proposal_id = p_proposal_id;

  if not found then
    raise exception 'upwork_action: approche introuvable (%)', p_proposal_id;
  end if;

  if exists (
    select 1 from public.upwork_actions
    where upwork_proposal_id = p_proposal_id
      and type = p_type
      and statut = 'en_attente'
  ) then
    raise exception 'upwork_action: déjà en attente pour cette personne';
  end if;

  insert into public.upwork_admin_flags (upwork_proposal_id, arrete_ok, maj_par, maj_at)
  values (p_proposal_id, true, auth.uid(), now())
  on conflict (upwork_proposal_id) do update set
    arrete_ok = true,
    maj_par = excluded.maj_par,
    maj_at = now();

  update public.upwork_approches
  set arrete_ok = true
  where upwork_proposal_id = p_proposal_id;

  insert into public.upwork_actions (
    type, upwork_proposal_id, cible_nom, cible_role, langue, prompt, note, demande_par
  )
  values (
    p_type, p_proposal_id, a.nom, a.role, a.langue, '…', nullif(btrim(p_note), ''), auth.uid()
  )
  returning id into nouvelle_id;

  texte := public.upwork_prompt_arreter(p_proposal_id, nouvelle_id);
  if nullif(btrim(p_note), '') is not null then
    texte := texte || chr(10) || 'Contexte admin : ' || btrim(p_note);
  end if;

  update public.upwork_actions
  set prompt = texte
  where id = nouvelle_id;

  return nouvelle_id;
end;
$$;

revoke all on function public.upwork_action_creer(text, text, text) from public, anon;
grant execute on function public.upwork_action_creer(text, text, text) to authenticated;

create or replace function public.upwork_action_annuler(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  a record;
begin
  if not public.is_admin() then
    raise exception 'upwork: admin seulement';
  end if;

  update public.upwork_actions
  set statut = 'annule', fait_at = now()
  where id = p_id and statut = 'en_attente'
  returning * into a;

  if a.type = 'arreter_recrutement' and a.upwork_proposal_id is not null then
    update public.upwork_admin_flags
    set arrete_ok = false, maj_at = now()
    where upwork_proposal_id = a.upwork_proposal_id;
    update public.upwork_approches
    set arrete_ok = false
    where upwork_proposal_id = a.upwork_proposal_id;
  end if;
end;
$$;

revoke all on function public.upwork_action_annuler(uuid) from public, anon;
grant execute on function public.upwork_action_annuler(uuid) to authenticated;

create or replace function public.upwork_hm_provisionner(p_proposal_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  a record;
  uid uuid;
  mail text;
  prenom text;
  nom text;
  langue text;
  mdp text;
  inst uuid;
begin
  select
    ap.nom, ap.profile_id, ap.upwork_proposal_id, m.langue as job_langue
  into a
  from public.upwork_approches ap
  left join public.upwork_missions m on m.job_posting_id = ap.job_posting_id
  where ap.upwork_proposal_id = p_proposal_id;

  if a.upwork_proposal_id is null then
    raise exception 'upwork_hm: approche introuvable (%)', p_proposal_id;
  end if;

  if a.profile_id is not null then
    select p.email into mail from public.profiles p where p.id = a.profile_id;
    return jsonb_build_object(
      'profile_id', a.profile_id, 'email', mail, 'created', false, 'password', null
    );
  end if;

  select p.id, p.email into uid, mail
  from public.profiles p
  where lower(btrim(concat_ws(' ', p.prenom, p.nom))) = lower(btrim(a.nom))
  order by p.created_at
  limit 1;

  if uid is not null then
    update public.upwork_approches
    set profile_id = uid
    where upwork_proposal_id = p_proposal_id;
    return jsonb_build_object(
      'profile_id', uid, 'email', mail, 'created', false, 'password', null
    );
  end if;

  prenom := split_part(btrim(a.nom), ' ', 1);
  nom := nullif(btrim(substr(btrim(a.nom), length(prenom) + 1)), '');
  langue := coalesce(nullif(a.job_langue, ''), 'en');
  mail := public.upwork_email_interne(prenom, nom);
  mdp := 'micabo-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
  uid := gen_random_uuid();
  select instance_id into inst from auth.users limit 1;
  inst := coalesce(inst, '00000000-0000-0000-0000-000000000000'::uuid);

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, recovery_token,
    email_change_token_new, email_change, email_change_token_current
  ) values (
    inst, uid, 'authenticated', 'authenticated', mail,
    crypt(mdp, gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('prenom', prenom),
    now(), now(), '', '', '', '', ''
  );

  insert into auth.identities (
    id, user_id, provider_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at, email
  ) values (
    gen_random_uuid(), uid, uid::text,
    jsonb_build_object('sub', uid::text, 'email', mail, 'email_verified', true),
    'email', now(), now(), now(), mail
  );

  update public.profiles
  set
    prenom = prenom,
    nom = nom,
    email = mail,
    is_active = true,
    must_change_password = false,
    nationalite = langue,
    langues = array[langue]
  where id = uid;

  delete from public.user_roles where user_id = uid;
  insert into public.user_roles (user_id, role) values (uid, 'hiring_manager');

  update public.upwork_approches
  set profile_id = uid
  where upwork_proposal_id = p_proposal_id;

  return jsonb_build_object(
    'profile_id', uid, 'email', mail, 'created', true, 'password', mdp
  );
end;
$$;

revoke all on function public.upwork_hm_provisionner(text) from public, anon, authenticated;
grant execute on function public.upwork_hm_provisionner(text) to service_role;

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

  if p_flag not in ('upwork_ajoute_ok', 'contrat_envoye_ok', 'acces_envoyes') then
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
  elsif p_flag = 'contrat_envoye_ok' then
    update public.upwork_admin_flags
    set contrat_envoye_ok = coalesce(p_ok, false)
    where upwork_proposal_id = p_proposal_id;
    update public.upwork_approches
    set contrat_envoye_ok = coalesce(p_ok, false)
    where upwork_proposal_id = p_proposal_id;
  else
    if coalesce(p_ok, false) then
      perform public.upwork_hm_provisionner(p_proposal_id);
    end if;
    update public.upwork_admin_flags
    set
      slack_envoye_ok = coalesce(p_ok, false),
      email_demande_ok = coalesce(p_ok, false),
      codes_ok = coalesce(p_ok, false)
    where upwork_proposal_id = p_proposal_id;
    update public.upwork_approches
    set
      slack_envoye_ok = coalesce(p_ok, false),
      email_demande_ok = coalesce(p_ok, false),
      codes_ok = coalesce(p_ok, false)
    where upwork_proposal_id = p_proposal_id;
  end if;
end;
$$;

revoke all on function public.upwork_marquer_flag(text, text, boolean) from public, anon;
grant execute on function public.upwork_marquer_flag(text, text, boolean) to authenticated;

create or replace function public.upwork_action_terminer(p_id uuid, p_resultat text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  a record;
  flags jsonb;
begin
  update public.upwork_actions
  set statut = 'fait', fait_at = now(), resultat = nullif(btrim(p_resultat), '')
  where id = p_id and statut = 'en_attente'
  returning * into a;

  if a.id is null then
    return;
  end if;

  if a.type = 'envoyer_acces_hm' then
    perform public.upwork_hm_provisionner(a.upwork_proposal_id);
    flags := coalesce(a.note::jsonb, '{}'::jsonb);
    perform public.upwork_acces_marquer(
      a.upwork_proposal_id,
      coalesce((flags ->> 'slack')::boolean, false),
      coalesce((flags ->> 'email')::boolean, false),
      coalesce((flags ->> 'codes')::boolean, false)
    );
  elsif a.type = 'arreter_recrutement' then
    perform public.upwork_approche_archiver(a.upwork_proposal_id);
  end if;

  perform public.upwork_campagnes_planifier();
  perform public.upwork_acces_planifier();
end;
$$;

revoke all on function public.upwork_action_terminer(uuid, text) from public, anon, authenticated;
grant execute on function public.upwork_action_terminer(uuid, text) to service_role;

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

  update public.upwork_approches a
  set warmup_actif = exists (
    select 1 from public.comptes c
    where c.poster_id = a.profile_id
      and c.warmup_started_at is not null
  );

  update public.upwork_approches a
  set premier_post_ok = exists (
    select 1
    from public.comptes c
    join public.passages p on p.compte_id = c.id
    where c.poster_id = a.profile_id
      and p.statut = 'publie'
  );

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
  set
    upwork_ajoute_ok = coalesce(f.upwork_ajoute_ok, a.upwork_ajoute_ok),
    slack_envoye_ok = a.slack_envoye_ok or coalesce(f.slack_envoye_ok, false),
    email_demande_ok = a.email_demande_ok or coalesce(f.email_demande_ok, false),
    codes_ok = a.codes_ok or coalesce(f.codes_ok, false),
    arrete_ok = a.arrete_ok or coalesce(f.arrete_ok, false)
  from public.upwork_admin_flags f
  where f.upwork_proposal_id = a.upwork_proposal_id;
end;
$$;

create or replace function public.upwork_sync_appliquer(payload jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  org text := payload ->> 'org_uid';
  attendu text := public.upwork_org_uid_micabo();
begin
  if org is distinct from attendu then
    raise exception 'upwork_sync: org_uid interdit (micabo seulement)';
  end if;

  insert into public.upwork_sync (id, org_uid, last_run_at, last_ok, last_detail, updated_at)
  values (
    true, org, now(),
    coalesce((payload ->> 'ok')::boolean, true),
    payload ->> 'detail', now()
  )
  on conflict (id) do update set
    org_uid = excluded.org_uid,
    last_run_at = excluded.last_run_at,
    last_ok = excluded.last_ok,
    last_detail = excluded.last_detail,
    updated_at = now();

  delete from public.upwork_missions;
  insert into public.upwork_missions (
    job_posting_id, titre, famille, langue, statut, type, created_time,
    applicants, new_applicants, shortlisted, messaged, offered, hired,
    pending_invitations, invites_sent, description, job_url, synced_at
  )
  select
    m ->> 'job_posting_id',
    coalesce(m ->> 'titre', '—'),
    public.upwork_classer_mission(m ->> 'titre'),
    coalesce(
      nullif(m ->> 'langue', ''),
      public.upwork_langue_depuis_texte(m ->> 'titre', m ->> 'description')
    ),
    m ->> 'statut',
    m ->> 'type',
    nullif(m ->> 'created_time', '')::timestamptz,
    coalesce((m ->> 'applicants')::int, 0),
    coalesce((m ->> 'new_applicants')::int, 0),
    coalesce((m ->> 'shortlisted')::int, 0),
    coalesce((m ->> 'messaged')::int, 0),
    coalesce((m ->> 'offered')::int, 0),
    coalesce((m ->> 'hired')::int, 0),
    coalesce((m ->> 'pending_invitations')::int, 0),
    coalesce((m ->> 'invites_sent')::int, (m ->> 'pending_invitations')::int, 0),
    nullif(m ->> 'description', ''),
    nullif(m ->> 'job_url', ''),
    now()
  from jsonb_array_elements(coalesce(payload -> 'missions', '[]'::jsonb)) m
  where coalesce(m ->> 'job_posting_id', '') <> ''
    and upper(coalesce(m ->> 'statut', '')) = 'PUBLISHED';

  delete from public.upwork_contrats;
  insert into public.upwork_contrats (
    contract_id, titre, statut, freelancer_nom, freelancer_id,
    hourly_rate, start_date, profile_id, room_id, last_message_at,
    langue, job_posting_id, slack_ok, slack_user_id, slack_at,
    codes_at, os_connecte_at, createurs_n, contrat_at, synced_at
  )
  select
    c ->> 'contract_id',
    c ->> 'titre',
    c ->> 'statut',
    c ->> 'freelancer_nom',
    c ->> 'freelancer_id',
    nullif(c ->> 'hourly_rate', '')::numeric,
    nullif(c ->> 'start_date', '')::date,
    coalesce(
      nullif(c ->> 'profile_id', '')::uuid,
      (
        select p.id
        from public.profiles p
        join public.user_roles ur on ur.user_id = p.id
        where ur.role = 'hiring_manager'
          and (
            lower(btrim(concat_ws(' ', p.prenom, p.nom))) = lower(btrim(c ->> 'freelancer_nom'))
            or lower(btrim(coalesce(p.prenom, ''))) = lower(split_part(btrim(c ->> 'freelancer_nom'), ' ', 1))
          )
        order by case
          when lower(btrim(concat_ws(' ', p.prenom, p.nom))) = lower(btrim(c ->> 'freelancer_nom')) then 0
          else 1
        end
        limit 1
      )
    ),
    nullif(c ->> 'room_id', ''),
    nullif(c ->> 'last_message_at', '')::timestamptz,
    nullif(c ->> 'langue', ''),
    nullif(c ->> 'job_posting_id', ''),
    coalesce((c ->> 'slack_ok')::boolean, false),
    nullif(c ->> 'slack_user_id', ''),
    nullif(c ->> 'slack_at', '')::timestamptz,
    nullif(c ->> 'codes_at', '')::timestamptz,
    nullif(c ->> 'os_connecte_at', '')::timestamptz,
    coalesce((c ->> 'createurs_n')::int, 0),
    coalesce(nullif(c ->> 'contrat_at', '')::timestamptz, nullif(c ->> 'start_date', '')::timestamptz),
    now()
  from jsonb_array_elements(coalesce(payload -> 'contrats', '[]'::jsonb)) c
  where coalesce(c ->> 'contract_id', '') <> '';

  update public.upwork_contrats uc
  set
    codes_at = coalesce(uc.codes_at, p.created_at),
    os_connecte_at = coalesce(uc.os_connecte_at, u.last_sign_in_at),
    createurs_n = (
      select count(*)::int
      from public.profiles pr
      join public.user_roles ur on ur.user_id = pr.id and ur.role = 'poster'
      where pr.manager_id = p.id
    ),
    langue = coalesce(uc.langue, p.langues[1], p.nationalite)
  from public.profiles p
  left join auth.users u on u.id = p.id
  where uc.profile_id = p.id;

  if payload ? 'approches' then
    delete from public.upwork_approches;
    insert into public.upwork_approches (
      job_posting_id, contract_id, upwork_proposal_id, upwork_freelancer_id,
      upwork_profile_url, photo_url, nom, role, statut, resume_discussions,
      dernier_message, dernier_message_at,
      contrat_envoye_ok, contrat_signe_ok, slack_envoye_ok, email_demande_ok,
      codes_ok, os_ok, slack_ok, upwork_ajoute_ok, job_createur_id,
      warmup_actif, premier_post_ok, arrete_ok, synced_at
    )
    select
      a ->> 'job_posting_id',
      nullif(a ->> 'contract_id', ''),
      a ->> 'upwork_proposal_id',
      nullif(a ->> 'upwork_freelancer_id', ''),
      nullif(a ->> 'upwork_profile_url', ''),
      nullif(a ->> 'photo_url', ''),
      coalesce(nullif(a ->> 'nom', ''), '—'),
      a ->> 'role',
      a ->> 'statut',
      nullif(a ->> 'resume_discussions', ''),
      nullif(a ->> 'dernier_message', ''),
      nullif(a ->> 'dernier_message_at', '')::timestamptz,
      coalesce((a ->> 'contrat_envoye_ok')::boolean, false),
      coalesce((a ->> 'contrat_signe_ok')::boolean, false),
      coalesce((a ->> 'slack_envoye_ok')::boolean, false),
      coalesce((a ->> 'email_demande_ok')::boolean, false),
      coalesce((a ->> 'codes_ok')::boolean, false),
      coalesce((a ->> 'os_ok')::boolean, false),
      coalesce((a ->> 'slack_ok')::boolean, false),
      coalesce((a ->> 'upwork_ajoute_ok')::boolean, false),
      nullif(a ->> 'job_createur_id', ''),
      coalesce((a ->> 'warmup_actif')::boolean, false),
      coalesce((a ->> 'premier_post_ok')::boolean, false),
      false,
      now()
    from jsonb_array_elements(coalesce(payload -> 'approches', '[]'::jsonb)) a
    where coalesce(a ->> 'upwork_proposal_id', '') <> ''
      and coalesce(a ->> 'job_posting_id', '') <> ''
      and (a ->> 'role') in ('hm', 'createur')
      and (a ->> 'statut') in ('messaged', 'hired')
      and exists (
        select 1
        from public.upwork_missions m
        where m.job_posting_id = a ->> 'job_posting_id'
      )
      and not exists (
        select 1
        from public.upwork_admin_flags f
        where f.upwork_proposal_id = a ->> 'upwork_proposal_id'
          and f.arrete_ok
          and not public.upwork_stop_en_attente(f.upwork_proposal_id)
      );
  end if;

  perform public.upwork_rafraichir_alertes();
end;
$$;

update public.upwork_actions a
set prompt = public.upwork_prompt_arreter(a.upwork_proposal_id, a.id)
  || coalesce(chr(10) || 'Contexte admin : ' || a.note, '')
where a.type = 'arreter_recrutement'
  and a.statut = 'en_attente'
  and a.upwork_proposal_id is not null;
