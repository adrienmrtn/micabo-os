-- Pipeline minuit : la planification, en une fonction à appeler après OK humain.
--
-- ⚠️ Cette migration ne planifie AUCUN job. Elle crée seulement
-- `public.crons_minuit_planifier()`. Le `db push` reste donc conforme à la
-- règle « après push, unscheduler tous les jobs cron.job, ne rien relancer
-- tant que l'humain n'a pas dit OK après un test manuel » (AGENTS.md).
--
-- Après le OK, un seul appel remet le moteur de nuit en route :
--   select * from public.crons_minuit_planifier();
    10|--
-- Vérifier ensuite (aucune ligne ne doit sortir des rails du projet) :
--   select jobname, schedule, active,
--          position('qkmiwnmiwsvwkttldqgb' in command) > 0 as bon_projet,
--          position('mbikecieskoobeizixig' in command) > 0 as fuite_autre_os
--   from cron.job order by jobname;
--   select d.start_time, j.jobname, d.status
--   from cron.job_run_details d join cron.job j on j.jobid = d.jobid
--   order by d.start_time desc limit 10;
--   select id, status_code, content from net._http_response order by id desc limit 5;
    20|--
-- Trois pièges, tous encaissés par la fonction ci-dessous :
--
-- 1. Le secret. `CRON_SECRET` est un Edge Function Secret : il n'est pas
--    lisible depuis la base. On le lit dans le Vault (`cron_secret`) AU MOMENT
--    de l'appel, donc il n'apparaît jamais dans `cron.job.command`. Si les deux
--    valeurs divergent, l'Edge répond 401 et la fonction ne peut pas le savoir
--    — d'où le test manuel obligatoire après planification.
-- 2. L'hôte. Ne JAMAIS reconstruire ces commandes depuis un job existant :
--    c'est ce que fait `0163_cutover_assignation_vnext.sql`, qui copie une
    30|--    commande contenant `mbikecieskoobeizixig.supabase.co` (prod étrangère) et
--    n'en remplace que le nom de la fonction, pas l'hôte. L'URL est écrite en
--    dur ici, sur `qkmiwnmiwsvwkttldqgb` uniquement.
-- 3. Le timeout. pg_net abandonne au bout de 5 s par défaut ; nos fonctions
--    répondent en quelques secondes mais peuvent traîner, d'où
--    `timeout_milliseconds`.
--
-- pg_cron tourne en UTC. `0 22 * * *` vise minuit Paris en été. Au passage à
-- l'heure d'hiver (25/10/2026) ce tick tombe à 23 h Paris : il ne fera rien
-- (le quota du jour qui s'achève est déjà rempli) et c'est le filet de 01:00
    40|-- UTC qui devient la vraie passe de minuit. Pour rester à l'heure, déplacer
-- `minuit-vnext` sur `0 23 * * *` à ce moment-là.

create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function public.crons_minuit_planifier()
returns table (jobname text, schedule text)
language plpgsql
as $fn$
    50|declare
  r record;
begin
  if not exists (select 1 from vault.decrypted_secrets s where s.name = 'cron_secret') then
    raise exception
      'Vault: secret « cron_secret » absent — le créer avec la valeur du Edge Function Secret CRON_SECRET avant de planifier';
  end if;

  -- Rejeu propre : on ne touche qu'aux jobs du pipeline minuit.
  for r in
    60|    select j.jobname
    from cron.job j
    where j.jobname in (
      'minuit-vnext',
      'minuit-vnext-filet',
      'minuit-vnext-rattrapage',
      'rattrapage-elo-drain'
    )
  loop
    perform cron.unschedule(r.jobname);
    70|  end loop;

  -- Minuit Paris (été) : rattrapage ELO enfilé, puis assignation, upscale,
  -- UGC vidéo, papier. L'Edge respecte le toggle « Pause des process ».
  perform cron.schedule(
    'minuit-vnext',
    '0 22 * * *',
    $cmd$select net.http_post(url := 'https://qkmiwnmiwsvwkttldqgb.supabase.co/functions/v1/minuit-vnext', body := '{}'::jsonb, headers := jsonb_build_object('content-type','application/json','x-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')), timeout_milliseconds := 120000);$cmd$
  );

    80|  -- Filet 03:00 Paris : le drain d'assignation est une chaîne `waitUntil`
  -- sans reprise pg_cron. Si elle meurt en route, cette passe la relance et
  -- saute les comptes déjà au quota.
  perform cron.schedule(
    'minuit-vnext-filet',
    '0 1 * * *',
    $cmd$select net.http_post(url := 'https://qkmiwnmiwsvwkttldqgb.supabase.co/functions/v1/minuit-vnext', body := '{"etapes":["assignation"]}'::jsonb, headers := jsonb_build_object('content-type','application/json','x-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')), timeout_milliseconds := 120000);$cmd$
  );

  -- Dernière chance avant la journée (06:00 Paris).
    90|  perform cron.schedule(
    'minuit-vnext-rattrapage',
    '0 4 * * *',
    $cmd$select net.http_post(url := 'https://qkmiwnmiwsvwkttldqgb.supabase.co/functions/v1/minuit-vnext', body := '{"etapes":["assignation"]}'::jsonb, headers := jsonb_build_object('content-type','application/json','x-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')), timeout_milliseconds := 120000);$cmd$
  );

  -- Minuit ENFILE le drain ELO, il ne le déroule pas : sans ce filet à la
  -- minute, vues et scores restent figés. Idle-safe (`elo_dernier_run.done`
  -- + lock `busy`) : ne part jamais tout seul.
  perform cron.schedule(
   100|    'rattrapage-elo-drain',
    '* * * * *',
    $cmd$select net.http_post(url := 'https://qkmiwnmiwsvwkttldqgb.supabase.co/functions/v1/rattrapage-elo', body := '{}'::jsonb, headers := jsonb_build_object('content-type','application/json','x-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')), timeout_milliseconds := 120000);$cmd$
  );

  return query
    select j.jobname::text, j.schedule::text
    from cron.job j
    where j.jobname in (
   110|      'minuit-vnext',
      'minuit-vnext-filet',
      'minuit-vnext-rattrapage',
      'rattrapage-elo-drain'
    )
    order by j.jobname;
end
$fn$;

comment on function public.crons_minuit_planifier() is
   120|  'Planifie le pipeline minuit (assignation + filets + drain ELO) sur ce projet uniquement. À n''appeler qu''après un OK humain explicite — voir 0236_crons_minuit.sql.';

revoke all on function public.crons_minuit_planifier() from public;
revoke all on function public.crons_minuit_planifier() from anon, authenticated;
