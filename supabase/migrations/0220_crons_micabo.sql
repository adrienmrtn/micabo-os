-- Crons moteur micabo-os.
--
-- URL figée sur CE projet uniquement. Interdit : tout autre ref
-- (notamment mbikecieskoobeizixig = OS étranger).
-- Le secret n'est PAS dans cron.job.command : il est lu dans vault au tick
-- (`cron_secret`, aligné sur l'Edge Secret CRON_SECRET).

create or replace function public.kick_edge_micabo(
  fn text,
  body jsonb default '{}'::jsonb
)
returns bigint
language plpgsql
security definer
set search_path = public, vault, net
as $$
declare
  secret text;
  rid bigint;
  target text;
begin
  if fn is null or fn !~ '^[a-z0-9-]+$' then
    raise exception 'kick_edge_micabo: fonction invalide';
  end if;

  select ds.decrypted_secret into secret
  from vault.decrypted_secrets ds
  where ds.name = 'cron_secret'
  limit 1;
  if secret is null or length(secret) = 0 then
    raise exception 'kick_edge_micabo: vault cron_secret manquant';
  end if;

  target := 'https://qkmiwnmiwsvwkttldqgb.supabase.co/functions/v1/' || fn;
  if target not like 'https://qkmiwnmiwsvwkttldqgb.supabase.co/functions/v1/%' then
    raise exception 'kick_edge_micabo: URL hors projet';
  end if;

  select net.http_post(
    url := target,
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-cron-secret', secret
    ),
    body := body,
    timeout_milliseconds := 120000
  ) into rid;
  return rid;
end;
$$;

revoke all on function public.kick_edge_micabo(text, jsonb) from public;
revoke all on function public.kick_edge_micabo(text, jsonb) from anon;
revoke all on function public.kick_edge_micabo(text, jsonb) from authenticated;

do $sched$
declare
  r record;
  i int;
begin
  if to_regclass('cron.job') is null then
    return;
  end if;

  for r in
    select jobid, jobname from cron.job
    where jobname like 'import-contenu-drain%'
       or jobname like 'caption-media-drain%'
       or jobname in (
         'rattrapage-elo-drain',
         'upscale-assignes-drain',
         'minuit-vnext',
         'minuit-vnext-rattrapage'
       )
  loop
    begin
      perform cron.unschedule(r.jobid);
    exception when others then
      begin
        perform cron.unschedule(r.jobname);
      exception when others then
        null;
      end;
    end;
  end loop;

  for i in 1..12 loop
    perform cron.schedule(
      format('import-contenu-drain-%s', i),
      '* * * * *',
      format(
        $cmd$select public.kick_edge_micabo('import-contenu', '{"worker":true}'::jsonb)$cmd$
      )
    );
  end loop;

  for i in 1..6 loop
    perform cron.schedule(
      format('caption-media-drain-%s', i),
      '* * * * *',
      $cmd$select public.kick_edge_micabo('caption-media', '{"action":"drain"}'::jsonb)$cmd$
    );
  end loop;

  perform cron.schedule(
    'rattrapage-elo-drain',
    '* * * * *',
    $cmd$select public.kick_edge_micabo('rattrapage-elo', '{}'::jsonb)$cmd$
  );
  perform cron.schedule(
    'upscale-assignes-drain',
    '* * * * *',
    $cmd$select public.kick_edge_micabo('upscale-assignes', '{}'::jsonb)$cmd$
  );
  -- 0 22 UTC = minuit Paris (été). 0 4 UTC = 06:00 Paris (été).
  perform cron.schedule(
    'minuit-vnext',
    '0 22 * * *',
    $cmd$select public.kick_edge_micabo('minuit-vnext', '{}'::jsonb)$cmd$
  );
  perform cron.schedule(
    'minuit-vnext-rattrapage',
    '0 4 * * *',
    $cmd$select public.kick_edge_micabo('minuit-vnext', '{}'::jsonb)$cmd$
  );
end
$sched$;
