-- Planification du moteur — DOCUMENTATION UNIQUEMENT.
--
-- ⚠️ Ce fichier n'active AUCUN job. Les crons ne doivent être (re)schedulés
-- qu'après un OK manuel explicite.
--
-- Interdit : toute URL d'un autre projet (notamment
-- https://mbikecieskoobeizixig.supabase.co = prod étrangère).
-- Si un cron doit un jour pointer ici, l'URL est
-- https://qkmiwnmiwsvwkttldqgb.supabase.co/functions/v1/<fn>
-- et le secret vient des Edge Function Secrets (jamais du dépôt).
--
-- Deux pièges historiques, à garder en tête le jour du schedule :
-- 1. pg_net abandonne au bout de 5 s par défaut. Nos fonctions prennent 15 à
--    250 s : sans `timeout_milliseconds`, plus aucune erreur visible.
-- 2. pg_cron tourne en UTC. Les heures ci-dessous visent Paris en été.
--
-- Jobs envisagés (NE PAS schedule ici) :
--   metriques-soir          0 17 * * *      /functions/v1/metriques
--   extraction-soir         0 18 * * *      /functions/v1/extraction
--   preparation-nuit        * 18-23,0-5 * * *  /functions/v1/preparation
--   composition-nuit        * 18-23,0-6 * * *  /functions/v1/composition
--   assignation-minuit      0 22 * * *      /functions/v1/assignation
--   assignation-rattrapage  0 4 * * *       /functions/v1/assignation

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Filet : aucun job, quelle que soit son URL, ne doit rester actif à ce stade.
do $unsched$
declare
  r record;
begin
  if to_regclass('cron.job') is null then
    return;
  end if;
  for r in select jobid, jobname from cron.job
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
end
$unsched$;
