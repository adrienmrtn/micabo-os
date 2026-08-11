-- Filet durable pour le drain ELO de minuit.
-- Le kick waitUntil + auto-chaîne meurt souvent (idle Edge 150s) → ELO/vues figés.
-- Comme upscale-assignes-drain : 1 invoke / minute reprend elo_dernier_run tant que !done.
-- Body {} → mode drain (voir rattrapage-elo/index.ts).

do $elo_drain$
declare
  template text;
  cmd text;
  re_body text := 'body\s*:=\s*''[^'']*''::jsonb';
  body_empty text := 'body := ''{}''::jsonb';
begin
  select c.command into template
  from cron.job c
  where position('x-cron-secret' in c.command) > 0
    and position('functions/v1/' in c.command) > 0
  order by case
    when c.jobname = 'minuit-vnext' then 0
    when c.jobname = 'upscale-assignes-drain' then 1
    else 2
  end
  limit 1;

  if template is null or position('x-cron-secret' in template) = 0 then
    raise notice 'rattrapage_elo: aucun cron template avec secret — schedule manuelle requise';
    return;
  end if;

  begin
    perform cron.unschedule('rattrapage-elo-drain');
  exception when others then
    null;
  end;

  cmd := regexp_replace(
    template,
    'functions/v1/[a-z0-9-]+',
    'functions/v1/rattrapage-elo',
    'i'
  );
  cmd := regexp_replace(cmd, re_body, body_empty, 'i');

  if position('rattrapage-elo' in cmd) = 0 then
    raise notice 'rattrapage_elo: remplacement URL échoué';
    return;
  end if;

  perform cron.schedule('rattrapage-elo-drain', '* * * * *', cmd);
end
$elo_drain$;
