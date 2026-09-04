-- Missions = jobs PUBLISHED seulement. Langue + faits pipeline.
-- Contrats HM : Slack / codes / OS + job lié.

create or replace function public.upwork_langue_depuis_texte(titre text, description text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when coalesce(titre, '') || ' ' || coalesce(description, '')
      ~* '(t[uü]rkiye|turkey|turquie|turkish|turc|slayt)' then 'tr'
    when coalesce(titre, '') || ' ' || coalesce(description, '')
      ~* '(spain|espagne|spanish|espagnol)' then 'es'
    when coalesce(titre, '') || ' ' || coalesce(description, '')
      ~* '(germany|allemagne|german|allemand|deutschland)' then 'de'
    when coalesce(titre, '') || ' ' || coalesce(description, '')
      ~* '(italy|italie|italian|italien)' then 'it'
    when coalesce(titre, '') || ' ' || coalesce(description, '')
      ~* '(portugal|portuguese|portugais)' then 'pt'
    when coalesce(titre, '') || ' ' || coalesce(description, '')
      ~* '(france|french-speaking|fran[cç]ais|based in france)' then 'fr'
    when coalesce(titre, '') ~* 'responsable du recrutement' then 'fr'
    else null
  end
$$;

alter table public.upwork_missions add column if not exists langue text;
alter table public.upwork_missions add column if not exists invites_sent int not null default 0;
alter table public.upwork_missions add column if not exists description text;

alter table public.upwork_contrats add column if not exists langue text;
alter table public.upwork_contrats add column if not exists job_posting_id text;
alter table public.upwork_contrats add column if not exists slack_ok boolean not null default false;
alter table public.upwork_contrats add column if not exists slack_user_id text;
alter table public.upwork_contrats add column if not exists slack_at timestamptz;
alter table public.upwork_contrats add column if not exists codes_at timestamptz;
alter table public.upwork_contrats add column if not exists os_connecte_at timestamptz;
alter table public.upwork_contrats add column if not exists createurs_n int not null default 0;
alter table public.upwork_contrats add column if not exists contrat_at timestamptz;

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

  perform public.upwork_rafraichir_alertes();
end;
$$;
