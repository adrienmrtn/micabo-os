-- Rattrapage captions serveur : survit à la fermeture de l’onglet + logs persistés.

create table if not exists public.caption_rattrapage_runs (
  id uuid primary key default gen_random_uuid(),
  statut text not null default 'running'
    check (statut in ('running', 'done', 'failed')),
  total integer not null default 0,
  fait integer not null default 0,
  ok integer not null default 0,
  aucune integer not null default 0,
  hooks integer not null default 0,
  echecs integer not null default 0,
  logs text[] not null default '{}',
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists caption_rattrapage_runs_statut_idx
  on public.caption_rattrapage_runs (statut, started_at desc);

create table if not exists public.caption_rattrapage_file (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.caption_rattrapage_runs (id) on delete cascade,
  media_id uuid not null references public.media_library (id) on delete cascade,
  motif text not null default 'caption',
  statut text not null default 'pending'
    check (statut in ('pending', 'running', 'done', 'failed')),
  lease_until timestamptz,
  created_at timestamptz not null default now(),
  unique (run_id, media_id)
);

create index if not exists caption_rattrapage_file_claim_idx
  on public.caption_rattrapage_file (run_id, statut, created_at)
  where statut in ('pending', 'running');

alter table public.caption_rattrapage_runs enable row level security;
alter table public.caption_rattrapage_file enable row level security;

drop policy if exists caption_rattrapage_runs_admin on public.caption_rattrapage_runs;
create policy caption_rattrapage_runs_admin on public.caption_rattrapage_runs
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists caption_rattrapage_file_admin on public.caption_rattrapage_file;
create policy caption_rattrapage_file_admin on public.caption_rattrapage_file
  for all using (public.is_admin()) with check (public.is_admin());

grant select, insert, update, delete on public.caption_rattrapage_runs to authenticated;
grant select, insert, update, delete on public.caption_rattrapage_file to authenticated;
grant all on public.caption_rattrapage_runs to service_role;
grant all on public.caption_rattrapage_file to service_role;

create or replace function public.claim_caption_rattrapage(p_n integer)
returns table (id uuid, run_id uuid, media_id uuid, motif text)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with pris as (
    select f.id
    from public.caption_rattrapage_file f
    join public.caption_rattrapage_runs r on r.id = f.run_id
    where r.statut = 'running'
      and (
        f.statut = 'pending'
        or (f.statut = 'running' and coalesce(f.lease_until, now() - interval '1 second') < now())
      )
    order by f.created_at
    limit greatest(1, least(coalesce(p_n, 4), 12))
    for update of f skip locked
  )
  update public.caption_rattrapage_file f
  set statut = 'running',
      lease_until = now() + interval '3 minutes'
  from pris
  where f.id = pris.id
  returning f.id, f.run_id, f.media_id, f.motif;
end;
$$;

create or replace function public.appendre_log_caption_rattrapage(
  p_run_id uuid,
  p_ligne text,
  p_ok integer,
  p_aucune integer,
  p_hooks integer,
  p_echecs integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  update public.caption_rattrapage_runs
  set
    fait = fait + 1,
    ok = ok + coalesce(p_ok, 0),
    aucune = aucune + coalesce(p_aucune, 0),
    hooks = hooks + coalesce(p_hooks, 0),
    echecs = echecs + coalesce(p_echecs, 0),
    logs = case
      when coalesce(array_length(logs, 1), 0) >= 200
        then (logs || p_ligne)[greatest(2, coalesce(array_length(logs, 1), 0) - 198) : ]
      else logs || p_ligne
    end,
    updated_at = now()
  where id = p_run_id;

  select count(*)::integer into n
  from public.caption_rattrapage_file
  where run_id = p_run_id
    and statut in ('pending', 'running');

  if n = 0 then
    update public.caption_rattrapage_runs
    set statut = 'done',
        finished_at = now(),
        updated_at = now()
    where id = p_run_id
      and statut = 'running';
  end if;
end;
$$;

revoke all on function public.claim_caption_rattrapage(integer) from public, anon, authenticated;
revoke all on function public.appendre_log_caption_rattrapage(uuid, text, integer, integer, integer, integer)
  from public, anon, authenticated;
grant execute on function public.claim_caption_rattrapage(integer) to service_role;
grant execute on function public.appendre_log_caption_rattrapage(uuid, text, integer, integer, integer, integer)
  to service_role;

-- 6 workers / minute (même recette que l’import file).
do $caption_drain$
declare
  template text;
  cmd text;
  i int;
  jobname text;
begin
  select c.command into template
  from cron.job c
  where position('x-cron-secret' in c.command) > 0
    and position('functions/v1/' in c.command) > 0
  order by case when c.jobname = 'import-contenu-drain-1' then 0
                when c.jobname = 'minuit-vnext' then 1
                else 2 end
  limit 1;

  if template is null or position('x-cron-secret' in template) = 0 then
    raise notice 'caption_rattrapage: aucun cron template — schedule manuelle requise';
    return;
  end if;

  for jobname in
    select j.jobname from cron.job j where j.jobname like 'caption-media-drain%'
  loop
    begin
      perform cron.unschedule(jobname);
    exception when others then
      null;
    end;
  end loop;

  for i in 1..6 loop
    jobname := format('caption-media-drain-%s', i);
    cmd := regexp_replace(
      template,
      'functions/v1/[a-z0-9-]+',
      'functions/v1/caption-media',
      'i'
    );
    cmd := regexp_replace(
      cmd,
      $$body\s*:=\s*'[^']*'::jsonb$$,
      $$body := '{"action":"drain"}'::jsonb$$,
      'i'
    );
    if position('caption-media' in cmd) = 0 then
      raise notice 'caption_rattrapage: remplacement URL échoué pour %', jobname;
      continue;
    end if;
    perform cron.schedule(jobname, '* * * * *', cmd);
  end loop;
end
$caption_drain$;

notify pgrst, 'reload schema';
