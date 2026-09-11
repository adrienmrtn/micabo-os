-- Filet d'assignation : toutes les 15 minutes au lieu de l'heure.
--
-- Le warmup dure 24 h et c'est le créateur qui lance le timer : il finit donc
-- à n'importe quelle minute. Avec un filet horaire, un créateur sorti à 17:45
-- attend 18:00 pour recevoir ses posts — jusqu'à 59 minutes pendant lesquelles
-- la page Minuit le compte comme incomplet (constaté le 11/09/2026 : Manon
-- 15:49 → 16:00, Ines 16:54 → 17:00, Gabriel 17:45 → servi à la main).
--
-- Une passe à vide ne fait rien : `listerComptesSousQuota` ne renvoie que les
-- comptes réellement sous quota, et le drain s'arrête immédiatement s'il n'y
-- en a aucun. Passer à 4 ticks par heure ne coûte donc que 3 invocations
-- Edge vides de plus, et ramène l'attente maximale à 15 minutes.
--
-- ⚠️ Cette migration ne planifie AUCUN job : elle remplace seulement
-- `public.crons_minuit_planifier()`. Le job `minuit-vnext-journee` a été
-- reprogrammé à part (`cron.schedule` sur ce seul nom, les quatre autres jobs
-- n'ont pas été touchés) après OK humain explicite, le 11/09/2026.
--
-- Détails, pièges (secret Vault, hôte, guillemets) : voir `0236_crons_minuit.sql`
-- et `0242_cron_assignation_journee.sql`.

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
      'minuit-vnext-journee',
      'rattrapage-elo-drain'
    )
  loop
    perform cron.unschedule(r.jobname);
  end loop;

  -- Minuit Paris (été) : rattrapage enfilé, puis assignation, upscale,
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

  -- Toutes les 15 minutes : un créateur sorti de warmup dans la journée reçoit
  -- ses posts du jour au quart d'heure suivant, sans clic admin. Passe à vide
  -- = no-op (aucun compte sous quota → le drain s'arrête tout de suite).
  perform cron.schedule(
    'minuit-vnext-journee',
    '*/15 * * * *',
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
      'minuit-vnext-journee',
      'rattrapage-elo-drain'
    )
    order by j.jobname;
end
$fn$;

comment on function public.crons_minuit_planifier() is
  'Planifie le pipeline minuit (assignation + filets + filet 15 min en journée + drain ELO) sur ce projet uniquement. À n''appeler qu''après un OK humain explicite — voir 0242_cron_assignation_journee.sql et 0251_filet_assignation_15min.sql.';

revoke all on function public.crons_minuit_planifier() from public;
revoke all on function public.crons_minuit_planifier() from anon, authenticated;
