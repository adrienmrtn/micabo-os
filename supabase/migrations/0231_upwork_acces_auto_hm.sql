-- Accès HM automatiques après contrat signé : créer le recruiter dans
-- l'OS, composer le message (lien Slack managers + codes + demande email)
-- et le mettre dans la file. Pas un gabarit recopié.

alter table public.upwork_admin_flags
  add column if not exists slack_envoye_ok boolean not null default false,
  add column if not exists email_demande_ok boolean not null default false,
  add column if not exists codes_ok boolean not null default false;

-- Le sync wipe les approches : sans ça, codes / email déjà faits reviendraient.
insert into public.upwork_admin_flags (
  upwork_proposal_id, slack_envoye_ok, email_demande_ok, codes_ok, maj_at
)
select
  upwork_proposal_id,
  slack_envoye_ok,
  email_demande_ok,
  codes_ok,
  now()
from public.upwork_approches
where slack_envoye_ok or email_demande_ok or codes_ok
on conflict (upwork_proposal_id) do update set
  slack_envoye_ok = public.upwork_admin_flags.slack_envoye_ok or excluded.slack_envoye_ok,
  email_demande_ok = public.upwork_admin_flags.email_demande_ok or excluded.email_demande_ok,
  codes_ok = public.upwork_admin_flags.codes_ok or excluded.codes_ok,
  maj_at = now();

insert into public.reglages (cle, valeur)
values (
  'upwork_acces',
  jsonb_build_object(
    'slack_invite_manager', '',
    'os_url', 'https://os.micabo.app/login'
  )
)
on conflict (cle) do nothing;

alter table public.upwork_actions drop constraint if exists upwork_actions_type_check;
alter table public.upwork_actions add constraint upwork_actions_type_check
  check (type in (
    'arreter_recrutement', 'publier_job_hm', 'sourcer_hm', 'inviter_hm',
    'envoyer_message', 'preparer_contrat', 'envoyer_acces_hm'
  ));

create or replace function public.upwork_acces_reglages()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select valeur from public.reglages where cle = 'upwork_acces'),
    '{}'::jsonb
  )
$$;

create or replace function public.upwork_acces_reglages_sauver(p_valeur jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'upwork: admin seulement';
  end if;
  insert into public.reglages (cle, valeur)
  values ('upwork_acces', coalesce(p_valeur, '{}'::jsonb))
  on conflict (cle) do update set valeur = excluded.valeur, updated_at = now();
end;
$$;

revoke all on function public.upwork_acces_reglages() from public, anon;
grant execute on function public.upwork_acces_reglages() to authenticated, service_role;
revoke all on function public.upwork_acces_reglages_sauver(jsonb) from public, anon;
grant execute on function public.upwork_acces_reglages_sauver(jsonb) to authenticated;

create or replace function public.upwork_email_interne(p_prenom text, p_nom text)
returns text
language plpgsql
stable
set search_path = public
as $$
declare
  base text;
  mail text;
  n int := 0;
begin
  base := regexp_replace(
    translate(
      lower(coalesce(p_prenom, '')),
      'àáâãäåçèéêëìíîïñòóôõöùúûüýÿ',
      'aaaaaaceeeeiiiinooooouuuuyy'
    ),
    '[^a-z0-9]',
    '',
    'g'
  ) || left(
    regexp_replace(
      translate(
        lower(coalesce(p_nom, '')),
        'àáâãäåçèéêëìíîïñòóôõöùúûüýÿ',
        'aaaaaaceeeeiiiinooooouuuuyy'
      ),
      '[^a-z0-9]',
      '',
      'g'
    ),
    1
  );
  if base = '' then
    base := 'hm';
  end if;

  loop
    mail := base || case when n = 0 then '' else n::text end || '@micabo.app';
    exit when not exists (select 1 from public.profiles where lower(email) = mail);
    n := n + 1;
    exit when n > 50;
  end loop;
  if n > 50 then
    mail := base || extract(epoch from now())::bigint::text || '@micabo.app';
  end if;
  return mail;
end;
$$;

-- Crée le hiring manager dans l'OS s'il n'existe pas encore.
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
  mdp constant text := '12345678';
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

create or replace function public.upwork_acces_marquer(
  p_proposal_id text,
  p_slack boolean,
  p_email boolean,
  p_codes boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.upwork_admin_flags (
    upwork_proposal_id, slack_envoye_ok, email_demande_ok, codes_ok, maj_at
  )
  values (
    p_proposal_id,
    coalesce(p_slack, false),
    coalesce(p_email, false),
    coalesce(p_codes, false),
    now()
  )
  on conflict (upwork_proposal_id) do update set
    slack_envoye_ok = public.upwork_admin_flags.slack_envoye_ok or excluded.slack_envoye_ok,
    email_demande_ok = public.upwork_admin_flags.email_demande_ok or excluded.email_demande_ok,
    codes_ok = public.upwork_admin_flags.codes_ok or excluded.codes_ok,
    maj_at = now();

  update public.upwork_approches
  set
    slack_envoye_ok = slack_envoye_ok or coalesce(p_slack, false),
    email_demande_ok = email_demande_ok or coalesce(p_email, false),
    codes_ok = codes_ok or coalesce(p_codes, false)
  where upwork_proposal_id = p_proposal_id;
end;
$$;

revoke all on function public.upwork_acces_marquer(text, boolean, boolean, boolean)
  from public, anon, authenticated;
grant execute on function public.upwork_acces_marquer(text, boolean, boolean, boolean)
  to service_role;

create or replace function public.upwork_acces_planifier()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  a record;
  compte jsonb;
  cfg jsonb;
  slack_url text;
  os_url text;
  fr boolean;
  prenom text;
  pays text;
  blocs text[] := '{}';
  corps text;
  prompt text;
  nouvelle_id uuid;
  envoi_slack boolean;
  envoi_email boolean;
  envoi_codes boolean;
begin
  cfg := public.upwork_acces_reglages();
  slack_url := nullif(btrim(coalesce(cfg ->> 'slack_invite_manager', '')), '');
  os_url := coalesce(nullif(btrim(cfg ->> 'os_url'), ''), 'https://os.micabo.app/login');

  for a in
    select
      ap.upwork_proposal_id,
      ap.nom,
      ap.role,
      ap.resume_discussions,
      ap.slack_envoye_ok,
      ap.email_demande_ok,
      ap.codes_ok,
      ap.job_posting_id,
      m.langue
    from public.upwork_approches ap
    left join public.upwork_missions m on m.job_posting_id = ap.job_posting_id
    where ap.role = 'hm'
      and ap.contrat_signe_ok
      and (
        not ap.slack_envoye_ok
        or not ap.email_demande_ok
        or not ap.codes_ok
      )
  loop
    if exists (
      select 1 from public.upwork_actions
      where upwork_proposal_id = a.upwork_proposal_id
        and type in ('envoyer_acces_hm', 'envoyer_message')
        and statut = 'en_attente'
    ) then
      continue;
    end if;

    envoi_slack := not a.slack_envoye_ok and slack_url is not null;
    envoi_email := not a.email_demande_ok;
    envoi_codes := not a.codes_ok;

    if not envoi_slack and not envoi_email and not envoi_codes then
      continue;
    end if;

    compte := public.upwork_hm_provisionner(a.upwork_proposal_id);
    if envoi_codes and (compte ->> 'created')::boolean then
      envoi_codes := true;
    elsif envoi_codes and compte ->> 'email' is not null and compte ->> 'password' is null then
      -- Compte déjà là : on rappelle l'email, pas le mot de passe.
      envoi_codes := true;
    end if;

    fr := coalesce(a.langue, '') = 'fr';
    prenom := split_part(btrim(a.nom), ' ', 1);
    pays := case a.langue
      when 'fr' then 'France'
      when 'es' then 'Spain'
      when 'de' then 'Germany'
      when 'it' then 'Italy'
      when 'pt' then 'Portugal'
      when 'tr' then 'Turkey'
      when 'nl' then 'Netherlands'
      when 'pl' then 'Poland'
      else coalesce(upper(a.langue), '')
    end;

    if fr then
      blocs := array['Bonjour ' || prenom || ','];
      if nullif(btrim(a.resume_discussions), '') is not null then
        blocs := blocs || array['', 'J''ai bien noté : ' || btrim(a.resume_discussions)];
      end if;
      blocs := blocs || array['', 'Bienvenue dans l''équipe micabo sur ' || pays || '.'];
      if envoi_slack then
        blocs := blocs || array[
          '',
          '1. Slack managers — rejoins-nous ici :',
          slack_url
        ];
      end if;
      if envoi_codes then
        blocs := blocs || array[
          '',
          '2. OS micabo — connecte-toi sur ' || os_url,
          '   email : ' || coalesce(compte ->> 'email', '—'),
          '   mot de passe : ' || coalesce(compte ->> 'password', '(celui déjà reçu)')
        ];
      end if;
      if envoi_email then
        blocs := blocs || array[
          '',
          '3. Réponds-moi avec l''email que tu veux utiliser au quotidien (Slack + suite).'
        ];
      end if;
      blocs := blocs || array['', 'Adrien'];
    else
      blocs := array['Hi ' || prenom || ','];
      if nullif(btrim(a.resume_discussions), '') is not null then
        blocs := blocs || array['', 'Noted: ' || btrim(a.resume_discussions)];
      end if;
      blocs := blocs || array['', 'Welcome to the micabo team for ' || pays || '.'];
      if envoi_slack then
        blocs := blocs || array[
          '',
          '1. Slack for managers — join here:',
          slack_url
        ];
      end if;
      if envoi_codes then
        blocs := blocs || array[
          '',
          '2. micabo OS — sign in at ' || os_url,
          '   email: ' || coalesce(compte ->> 'email', '—'),
          '   password: ' || coalesce(compte ->> 'password', '(the one you already received)')
        ];
      end if;
      if envoi_email then
        blocs := blocs || array[
          '',
          '3. Reply with the email you want to use day to day (Slack and the rest).'
        ];
      end if;
      blocs := blocs || array['', 'Adrien'];
    end if;

    corps := array_to_string(blocs, chr(10));

    prompt :=
      'Envoie les accès à ' || a.nom
      || ' (hm' || coalesce(' ' || a.langue, '') || ') sur Upwork.' || chr(10)
      || '1. list_accounts → org Micabo ' || public.upwork_org_uid_micabo()
      || ' uniquement. Sinon stop.' || chr(10)
      || '2. send_message action=message_proposal, job_posting_id='
      || a.job_posting_id || ', proposal_id=' || a.upwork_proposal_id || '.' || chr(10)
      || '   Le message est le champ `message` de cette action, à envoyer'
      || ' **tel quel**. N''y touche pas, ne le traduis pas, n''ajoute rien.' || chr(10)
      || '3. select public.upwork_action_terminer(''<id>'', ''<résumé>'');' || chr(10)
      || 'Si l''envoi échoue, dis-le dans le résumé et n''essaie pas de reformuler.';

    insert into public.upwork_actions (
      type, upwork_proposal_id, cible_nom, cible_role, langue,
      prompt, message, note, demande_par
    )
    values (
      'envoyer_acces_hm',
      a.upwork_proposal_id,
      a.nom,
      'hm',
      a.langue,
      prompt,
      corps,
      jsonb_build_object(
        'slack', envoi_slack, 'email', envoi_email, 'codes', envoi_codes
      )::text,
      null
    )
    returning id into nouvelle_id;

    update public.upwork_actions
    set prompt = replace(prompt, '''<id>''', quote_literal(nouvelle_id::text))
    where id = nouvelle_id;
  end loop;
end;
$$;

revoke all on function public.upwork_acces_planifier() from public, anon, authenticated;
grant execute on function public.upwork_acces_planifier() to service_role;

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
    codes_ok = a.codes_ok or coalesce(f.codes_ok, false)
  from public.upwork_admin_flags f
  where f.upwork_proposal_id = a.upwork_proposal_id;
end;
$$;

create or replace function public.upwork_actions_en_attente()
returns setof public.upwork_actions
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.upwork_campagnes_planifier();
  perform public.upwork_acces_planifier();
  return query
    select * from public.upwork_actions
    where statut = 'en_attente'
    order by demande_at;
end;
$$;

revoke all on function public.upwork_actions_en_attente() from public, anon, authenticated;
grant execute on function public.upwork_actions_en_attente() to service_role;

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

  if a.type = 'envoyer_acces_hm' then
    flags := coalesce(a.note::jsonb, '{}'::jsonb);
    perform public.upwork_acces_marquer(
      a.upwork_proposal_id,
      coalesce((flags ->> 'slack')::boolean, false),
      coalesce((flags ->> 'email')::boolean, false),
      coalesce((flags ->> 'codes')::boolean, false)
    );
  end if;

  perform public.upwork_campagnes_planifier();
  perform public.upwork_acces_planifier();
end;
$$;

revoke all on function public.upwork_action_terminer(uuid, text) from public, anon, authenticated;
grant execute on function public.upwork_action_terminer(uuid, text) to service_role;
