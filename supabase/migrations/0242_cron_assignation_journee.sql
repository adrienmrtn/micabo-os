-- Filet horaire d'assignation : le quota du jour se remplit dès la fin du warmup.
--
-- Le warmup dure 24 h et c'est le créateur qui lance le timer, à n'importe
-- quelle heure. Les trois passes d'assignation tombent à 00:00, 03:00 et 06:00
-- Paris : un créateur dont le warmup finit à 08:53 n'est en process pour aucune
-- d'elles, donc personne ne lui assigne quoi que ce soit — il reste à 0/2 toute
-- la journée (et l'ELO le pénalise pour ne pas avoir publié ce jour-là, car
-- `etaitActifAuJour` le considère actif dès que son warmup finit dans la
-- journée). Constaté le 07/09/2026 : 5 créateurs TR sur 8 dans ce cas.
--
-- `minuit-vnext-journee` repasse toutes les heures avec la seule étape
   10|-- `assignation`. C'est le même chemin que les filets existants :
--   - le drain ne prend que les comptes SOUS quota (warmup terminé),
--   - une passe à vide ne fait rien (aucun compte listé) et ne touche plus à
--     `reglages.minuit_dernier_run` (voir `supabase/functions/assignation`),
--   - le toggle « Pause des process » (`assignation_auto`) est respecté.
--
-- ⚠️ Cette migration ne planifie AUCUN job : elle remplace seulement
-- `public.crons_minuit_planifier()`. Conforme à AGENTS.md — après le `db push`,
-- les jobs restent unschedulés jusqu'au OK humain, puis un seul appel remet
-- tout le pipeline en route (filet horaire compris) :
    20|--   select * from public.crons_minuit_planifier();
--
-- Vérifier ensuite :
--   select jobname, schedule, active, command from cron.job order by jobname;
--   -- 5 jobs attendus, tous en https://qkmiwnmiwsvwkttldqgb.supabase.co
--
-- Détails, pièges (secret Vault, hôte, guillemets, timeout) et heure d'hiver :
-- voir `0236_crons_minuit.sql`.

create or replace function public.crons_minuit_planifier()
returns table (jobname text, schedule text)
    30|language plpgsql
as $fn$
declare
  r record;
begin
  if not exists (select 1 from vault.decrypted_secrets s where s.name = 'cron_secret') then
    raise exception
      'Vault: secret « cron_secret » absent — le créer avec la valeur du Edge Function Secret CRON_SECRET avant de planifier';
  end if;

  -- Rejeu propre : on ne touche qu'aux jobs du pipeline minuit.
    40|  for r in
    select j.jobname
    from cron.job j
    where j.jobname in (
      'minuit-vnext',
      'minuit-vnext-filet',
      'minuit-vnext-rattrapage',
      'minuit-vnext-journee',
      'rattrapage-elo-drain'
    )
    50|  loop
    perform cron.unschedule(r.jobname);
  end loop;

  -- Minuit Paris (été) : rattrapage ELO enfilé, puis assignation, upscale,
  -- UGC vidéo, papier. L'Edge respecte le toggle « Pause des process ».
  perform cron.schedule(
    'minuit-vnext',
    '0 22 * * *',
    $cmd$select public.kick_edge_micabo('minuit-vnext');$cmd$
    60|  );

  -- Filet 03:00 Paris : le drain d'assignation est une chaîne `waitUntil`
  -- sans reprise pg_cron. Si elle meurt en route, cette passe la relance et
  -- saute les comptes déjà au quota.
  perform cron.schedule(
    'minuit-vnext-filet',
    '0 1 * * *',
    $cmd$select public.kick_edge_micabo('minuit-vnext', jsonb_build_object('etapes', jsonb_build_array('assignation')));$cmd$
  );

    70|  -- Dernière chance avant la journée (06:00 Paris).
  perform cron.schedule(
    'minuit-vnext-rattrapage',
    '0 4 * * *',
    $cmd$select public.kick_edge_micabo('minuit-vnext', jsonb_build_object('etapes', jsonb_build_array('assignation')));$cmd$
  );

  -- Toutes les heures : un créateur sorti de warmup dans la journée reçoit ses
  -- posts du jour au tick suivant, sans clic admin. Passe à vide = no-op.
  perform cron.schedule(
    80|    'minuit-vnext-journee',
    '0 * * * *',
    $cmd$select public.kick_edge_micabo('minuit-vnext', jsonb_build_object('etapes', jsonb_build_array('assignation')));$cmd$
  );

  -- Minuit ENFILE le drain ELO, il ne le déroule pas : sans ce filet à la
  -- minute, vues et scores restent figés. Idle-safe (`elo_dernier_run.done`
  -- + lock `busy`) : ne part jamais tout seul.
  perform cron.schedule(
    'rattrapage-elo-drain',
    90|    '* * * * *',
    $cmd$select public.kick_edge_micabo('rattrapage-elo');$cmd$
  );

  return query
    select j.jobname::text, j.schedule::text
    from cron.job j
    where j.jobname in (
      'minuit-vnext',
      'minuit-vnext-filet',
   100|      'minuit-vnext-rattrapage',
      'minuit-vnext-journee',
      'rattrapage-elo-drain'
    )
    order by j.jobname;
end
$fn$;

comment on function public.crons_minuit_planifier() is
  'Planifie le pipeline minuit (assignation + filets + filet horaire journée + drain ELO) sur ce projet uniquement. À n''appeler qu''après un OK humain explicite — voir 0242_cron_assignation_journee.sql.';

   110|revoke all on function public.crons_minuit_planifier() from public;
revoke all on function public.crons_minuit_planifier() from anon, authenticated;
