-- Pipeline minuit : la planification, en une fonction à appeler après OK humain.
--
-- ⚠️ Cette migration ne planifie AUCUN job. Elle crée seulement
-- `public.crons_minuit_planifier()`. Le `db push` reste donc conforme à la
-- règle « après push, unscheduler tous les jobs cron.job, ne rien relancer
-- tant que l'humain n'a pas dit OK après un test manuel » (AGENTS.md).
--
-- Après le OK, un seul appel remet le moteur de nuit en route :
--   select * from public.crons_minuit_planifier();
--
-- Vérifier ensuite (aucune commande ne doit sortir des rails du projet) :
--   select jobname, schedule, active, command from cron.job order by jobname;
--   select d.start_time, j.jobname, d.status
--   from cron.job_run_details d join cron.job j on j.jobid = d.jobid
--   order by d.start_time desc limit 10;
--   select id, status_code, content from net._http_response order by id desc limit 5;
--
-- Quatre pièges, tous encaissés ci-dessous :
--
-- 1. Le secret. `CRON_SECRET` est un Edge Function Secret : il n'est pas
--    lisible depuis la base. On le lit dans le Vault (`cron_secret`) AU MOMENT
--    de l'appel, donc il n'apparaît jamais dans `cron.job.command`. Si les deux
--    valeurs divergent, l'Edge répond 401 et la base ne peut pas le savoir
--    — d'où le test manuel obligatoire après planification.
-- 2. L'hôte. Ne JAMAIS reconstruire ces commandes depuis un job existant :
--    c'est ce que fait `0163_cutover_assignation_vnext.sql`, qui copie une
--    commande contenant `mbikecieskoobeizixig.supabase.co` (prod étrangère) et
--    n'en remplace que le nom de la fonction, pas l'hôte. Ici l'appel passe par
--    `kick_edge_micabo`, qui refuse toute URL hors `qkmiwnmiwsvwkttldqgb`.
-- 3. Les guillemets. Une commande cron est du SQL dans une chaîne, et le corps
--    JSON traversait un `'{...}'::jsonb` plein de guillemets doubles. Passé par
--    un outil qui échappe (MCP, script, copier-coller), chaque guillemet arrive
--    en base précédé d'un antislash : le cast jsonb casse au premier tick, en
--    silence. Les filets étaient planifiés mais ne partaient jamais.
--    `jsonb_build_object` n'a aucun guillemet à perdre.
-- 4. Le timeout. pg_net abandonne au bout de 5 s par défaut ; nos fonctions
--    répondent en quelques secondes mais peuvent traîner, d'où le
--    `timeout_milliseconds` du helper.
--
-- pg_cron tourne en UTC. `0 22 * * *` vise minuit Paris en été. Au passage à
-- l'heure d'hiver (25/10/2026) ce tick tombe à 23 h Paris : il ne fera rien
-- (le quota du jour qui s'achève est déjà rempli) et c'est le filet de 01:00
-- UTC qui devient la vraie passe de minuit. Pour rester à l'heure, déplacer
-- `minuit-vnext` sur `0 23 * * *` à ce moment-là.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Déjà présent en base (posé hors dépôt avec le suivi RC) : on l'écrit ici à
-- l'identique pour que ce dépôt seul suffise à rejouer le pipeline minuit.
-- Tout appel Edge de la base passe par lui : un seul endroit tient l'hôte.
create or replace function public.kick_edge_micabo(fn text, body jsonb default '{}'::jsonb)
returns bigint
language plpgsql
security definer
set search_path to 'public', 'vault', 'net'
as $fn$
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
$fn$;

create or replace function public.crons_minuit_planifier()
returns table (jobname text, schedule text)
language plpgsql
as $fn$
declare
  r record;
begin
  if not exists (select 1 from vault.decrypted_secrets s where s.name = 'cron_secret') then
    raise exception
      'Vault: secret « cron_secret » absent — le créer avec la valeur du Edge Function Secret CRON_SECRET avant de planifier';
  end if;

  -- Rejeu propre : on ne touche qu'aux jobs du pipeline minuit.
  for r in
    select j.jobname
    from cron.job j
    where j.jobname in (
      'minuit-vnext',
      'minuit-vnext-filet',
      'minuit-vnext-rattrapage',
      'rattrapage-elo-drain'
    )
  loop
    perform cron.unschedule(r.jobname);
  end loop;

  -- Minuit Paris (été) : rattrapage ELO enfilé, puis assignation, upscale,
  -- UGC vidéo, papier. L'Edge respecte le toggle « Pause des process ».
  perform cron.schedule(
    'minuit-vnext',
    '0 22 * * *',
    $cmd$select public.kick_edge_micabo('minuit-vnext');$cmd$
  );

  -- Filet 03:00 Paris : le drain d'assignation est une chaîne `waitUntil`
  -- sans reprise pg_cron. Si elle meurt en route, cette passe la relance et
  -- saute les comptes déjà au quota.
  perform cron.schedule(
    'minuit-vnext-filet',
    '0 1 * * *',
    $cmd$select public.kick_edge_micabo('minuit-vnext', jsonb_build_object('etapes', jsonb_build_array('assignation')));$cmd$
  );

  -- Dernière chance avant la journée (06:00 Paris).
  perform cron.schedule(
    'minuit-vnext-rattrapage',
    '0 4 * * *',
    $cmd$select public.kick_edge_micabo('minuit-vnext', jsonb_build_object('etapes', jsonb_build_array('assignation')));$cmd$
  );

  -- Minuit ENFILE le drain ELO, il ne le déroule pas : sans ce filet à la
  -- minute, vues et scores restent figés. Idle-safe (`elo_dernier_run.done`
  -- + lock `busy`) : ne part jamais tout seul.
  perform cron.schedule(
    'rattrapage-elo-drain',
    '* * * * *',
    $cmd$select public.kick_edge_micabo('rattrapage-elo');$cmd$
  );

  return query
    select j.jobname::text, j.schedule::text
    from cron.job j
    where j.jobname in (
      'minuit-vnext',
      'minuit-vnext-filet',
      'minuit-vnext-rattrapage',
      'rattrapage-elo-drain'
    )
    order by j.jobname;
end
$fn$;

comment on function public.crons_minuit_planifier() is
  'Planifie le pipeline minuit (assignation + filets + drain ELO) sur ce projet uniquement. À n''appeler qu''après un OK humain explicite — voir 0236_crons_minuit.sql.';

revoke all on function public.crons_minuit_planifier() from public;
revoke all on function public.crons_minuit_planifier() from anon, authenticated;
