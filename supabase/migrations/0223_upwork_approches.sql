-- Personnes approchées (réponse Upwork) + sync étendu.
-- Lectures admin only. Writes via upwork_sync_appliquer (service_role).

create table if not exists public.upwork_approches (
  id uuid primary key default gen_random_uuid(),
  job_posting_id text not null,
  contract_id text,
  upwork_proposal_id text unique not null,
  upwork_freelancer_id text,
  upwork_profile_url text,
  nom text not null,
  role text not null check (role in ('hm', 'createur')),
  statut text not null check (statut in ('messaged', 'hired')),
  resume_discussions text,
  contrat_envoye_ok boolean not null default false,
  contrat_signe_ok boolean not null default false,
  slack_envoye_ok boolean not null default false,
  email_demande_ok boolean not null default false,
  codes_ok boolean not null default false,
  os_ok boolean not null default false,
  slack_ok boolean not null default false,
  upwork_ajoute_ok boolean not null default false,
  job_createur_id text,
  warmup_actif boolean not null default false,
  premier_post_ok boolean not null default false,
  synced_at timestamptz not null default now()
);

create index if not exists upwork_approches_job_idx
  on public.upwork_approches (job_posting_id, role, statut);

alter table public.upwork_approches enable row level security;

drop policy if exists upwork_approches_admin_select on public.upwork_approches;
create policy upwork_approches_admin_select
  on public.upwork_approches
  for select
  using (public.is_admin());

grant select on public.upwork_approches to authenticated;

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
    upwork_profile_url, nom, role, statut, resume_discussions,
    contrat_envoye_ok, contrat_signe_ok, slack_envoye_ok, email_demande_ok,
    codes_ok, os_ok, slack_ok, upwork_ajoute_ok, job_createur_id,
    warmup_actif, premier_post_ok, synced_at
  )
  select
    a ->> 'job_posting_id',
    nullif(a ->> 'contract_id', ''),
    a ->> 'upwork_proposal_id',
    nullif(a ->> 'upwork_freelancer_id', ''),
    nullif(a ->> 'upwork_profile_url', ''),
    coalesce(nullif(a ->> 'nom', ''), '—'),
    a ->> 'role',
    a ->> 'statut',
    nullif(a ->> 'resume_discussions', ''),
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
    );
  end if;

  perform public.upwork_rafraichir_alertes();
end;
$$;
