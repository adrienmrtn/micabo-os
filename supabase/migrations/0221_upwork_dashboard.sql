-- Dashboard Upwork (lecture seule côté OS).
-- L'agent Cursor (cette convo / Automation 2h) écrit le snapshot via
-- public.upwork_sync_appliquer. Le front admin ne fait que SELECT.
-- Org figé : Micabo uniquement.

create or replace function public.upwork_org_uid_micabo()
returns text
language sql
immutable
set search_path = public
as $$
  select '1990051114607612379'
$$;

create or replace function public.upwork_classer_mission(titre text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when coalesce(titre, '') ~* 'hiring manager|responsable du recrutement'
      then 'hm'
    when coalesce(titre, '') ~* 'tiktok|slideshow|slayt|ugc creator|publisher|cr[eé]ateur'
      then 'createur'
    else 'autre'
  end
$$;

create table if not exists public.upwork_sync (
  id boolean primary key default true check (id),
  org_uid text not null,
  last_run_at timestamptz,
  last_ok boolean,
  last_detail text,
  updated_at timestamptz not null default now()
);

create table if not exists public.upwork_missions (
  id uuid primary key default gen_random_uuid(),
  job_posting_id text unique not null,
  titre text not null,
  famille text not null default 'autre'
    check (famille in ('hm', 'createur', 'autre')),
  statut text,
  type text,
  created_time timestamptz,
  applicants int not null default 0,
  new_applicants int not null default 0,
  shortlisted int not null default 0,
  messaged int not null default 0,
  offered int not null default 0,
  hired int not null default 0,
  pending_invitations int not null default 0,
  job_url text,
  synced_at timestamptz not null default now()
);

create index if not exists upwork_missions_statut_idx
  on public.upwork_missions (statut, famille);

create table if not exists public.upwork_contrats (
  id uuid primary key default gen_random_uuid(),
  contract_id text unique not null,
  titre text,
  statut text,
  freelancer_nom text,
  freelancer_id text,
  hourly_rate numeric,
  start_date date,
  profile_id uuid references public.profiles (id) on delete set null,
  room_id text,
  last_message_at timestamptz,
  synced_at timestamptz not null default now()
);

create index if not exists upwork_contrats_profile_idx
  on public.upwork_contrats (profile_id);

create table if not exists public.upwork_alertes (
  id uuid primary key default gen_random_uuid(),
  compte_id uuid not null,
  poster_id uuid,
  nom text,
  handle text,
  niveau text not null check (niveau in ('l1', 'l2')),
  jours_sans_post int not null,
  manager_id uuid,
  manager_nom text,
  contract_id text,
  synced_at timestamptz not null default now()
);

create index if not exists upwork_alertes_niveau_idx
  on public.upwork_alertes (niveau, jours_sans_post desc);

alter table public.upwork_sync enable row level security;
alter table public.upwork_missions enable row level security;
alter table public.upwork_contrats enable row level security;
alter table public.upwork_alertes enable row level security;

drop policy if exists upwork_sync_admin_select on public.upwork_sync;
create policy upwork_sync_admin_select on public.upwork_sync
  for select using (public.is_admin());

drop policy if exists upwork_missions_admin_select on public.upwork_missions;
create policy upwork_missions_admin_select on public.upwork_missions
  for select using (public.is_admin());

drop policy if exists upwork_contrats_admin_select on public.upwork_contrats;
create policy upwork_contrats_admin_select on public.upwork_contrats
  for select using (public.is_admin());

drop policy if exists upwork_alertes_admin_select on public.upwork_alertes;
create policy upwork_alertes_admin_select on public.upwork_alertes
  for select using (public.is_admin());

grant select on public.upwork_sync to authenticated;
grant select on public.upwork_missions to authenticated;
grant select on public.upwork_contrats to authenticated;
grant select on public.upwork_alertes to authenticated;

-- Recalcule L1/L2 depuis passages + HM + contrat lié (fuseau Paris).
create or replace function public.upwork_rafraichir_alertes()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  auj date := (timezone('Europe/Paris', now()))::date;
begin
  delete from public.upwork_alertes;

  insert into public.upwork_alertes (
    compte_id, poster_id, nom, handle, niveau, jours_sans_post,
    manager_id, manager_nom, contract_id, synced_at
  )
  select
    c.id,
    c.poster_id,
    coalesce(
      nullif(btrim(concat_ws(' ', pr.prenom, pr.nom)), ''),
      c.persona_nom,
      case when c.handle_tiktok is not null then '@' || c.handle_tiktok end,
      '—'
    ),
    c.handle_tiktok,
    case when jours.n >= 2 then 'l2' else 'l1' end,
    least(jours.n, 99),
    pr.manager_id,
    nullif(btrim(concat_ws(' ', hm.prenom, hm.nom)), ''),
    uc.contract_id,
    now()
  from public.comptes c
  join public.profiles pr on pr.id = c.poster_id
  left join public.profiles hm on hm.id = pr.manager_id
  left join public.upwork_contrats uc on uc.profile_id = pr.manager_id
  left join lateral (
    select max(
      coalesce(
        (p.publie_at at time zone 'Europe/Paris')::date,
        p.date_publication_prevue
      )
    ) as jour
    from public.passages p
    where p.compte_id = c.id
      and p.statut = 'publie'
  ) der on true
  cross join lateral (
    select case
      when der.jour is null then 99
      else greatest(0, auj - der.jour)
    end as n
  ) jours
  where c.is_active
    and c.warmup_started_at is not null
    and c.warmup_ends_at is not null
    and c.warmup_ends_at <= now()
    and jours.n >= 1;
end;
$$;

revoke all on function public.upwork_rafraichir_alertes() from public, anon, authenticated;
grant execute on function public.upwork_rafraichir_alertes() to service_role;

-- Snapshot atomique : missions + contrats + alertes + horodatage.
-- Interdit tout org_uid autre que Micabo.
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
    true,
    org,
    now(),
    coalesce((payload ->> 'ok')::boolean, true),
    payload ->> 'detail',
    now()
  )
  on conflict (id) do update set
    org_uid = excluded.org_uid,
    last_run_at = excluded.last_run_at,
    last_ok = excluded.last_ok,
    last_detail = excluded.last_detail,
    updated_at = now();

  delete from public.upwork_missions;
  insert into public.upwork_missions (
    job_posting_id, titre, famille, statut, type, created_time,
    applicants, new_applicants, shortlisted, messaged, offered, hired,
    pending_invitations, job_url, synced_at
  )
  select
    m ->> 'job_posting_id',
    coalesce(m ->> 'titre', '—'),
    public.upwork_classer_mission(m ->> 'titre'),
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
    nullif(m ->> 'job_url', ''),
    now()
  from jsonb_array_elements(coalesce(payload -> 'missions', '[]'::jsonb)) m
  where coalesce(m ->> 'job_posting_id', '') <> '';

  delete from public.upwork_contrats;
  insert into public.upwork_contrats (
    contract_id, titre, statut, freelancer_nom, freelancer_id,
    hourly_rate, start_date, profile_id, room_id, last_message_at, synced_at
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
    now()
  from jsonb_array_elements(coalesce(payload -> 'contrats', '[]'::jsonb)) c
  where coalesce(c ->> 'contract_id', '') <> '';

  perform public.upwork_rafraichir_alertes();
end;
$$;

revoke all on function public.upwork_sync_appliquer(jsonb) from public, anon, authenticated;
grant execute on function public.upwork_sync_appliquer(jsonb) to service_role;
