-- Deuxième passe quotidienne de relevé des stats (14/09/2026).
--
-- Le relevé des vues n'ouvrait qu'une fois par jour, à minuit Paris. Deux
-- conséquences mesurées le 14/09/2026 :
--
--   1. un post publié le soir était scrapé quelques minutes après — TikTok ne
--      l'avait pas indexé, aucun match, et il fallait attendre 24 h ;
--   2. un post publié APRÈS la passe attendait la nuit suivante.
--
-- Le correctif de fond est ailleurs (`rattrapage_elo.ts` : file « ce qui
-- manque » au lieu d'une fenêtre de dates, délai plancher de 45 min, scrape
-- profil dimensionné sur le nombre de passages à retrouver). Cette passe de
-- 13:00 Paris s'y ajoute : un post du soir est mesuré ~15 h après au lieu de
-- 26 h, et chaque passage est vu deux fois avant le J+3 de la requalification.
--
-- `restart: true` rouvre la file du drain ELO (`elo_dernier_run.done = false`),
-- exactement comme le fait minuit. Le cron minute `rattrapage-elo-drain` la
-- déroule ensuite. Une passe sans rien à relever coûte une requête : la file
-- « ce qui manque » revient vide et le drain se referme.

create or replace function public.crons_stats_midi_planifier()
returns table (jobname text, schedule text)
language plpgsql
as $fn$
begin
  if not exists (select 1 from vault.decrypted_secrets s where s.name = 'cron_secret') then
    raise exception
      'Vault: secret « cron_secret » absent — le créer avec la valeur du Edge Function Secret CRON_SECRET avant de planifier';
  end if;

  if exists (select 1 from cron.job j where j.jobname = 'rattrapage-elo-midi') then
    perform cron.unschedule('rattrapage-elo-midi');
  end if;

  -- 11:00 UTC = 13:00 Paris en été. Corps construit par `jsonb_build_object` :
  -- un littéral jsonb écrit à la main ressort échappé quand la migration passe
  -- par un outil, et le job casse en silence au tick (voir 0236).
  perform cron.schedule(
    'rattrapage-elo-midi',
    '0 11 * * *',
    $cmd$select public.kick_edge_micabo('rattrapage-elo', jsonb_build_object('restart', true));$cmd$
  );

  return query
    select j.jobname::text, j.schedule::text
    from cron.job j
    where j.jobname = 'rattrapage-elo-midi';
end
$fn$;

comment on function public.crons_stats_midi_planifier() is
  'Planifie la deuxième passe quotidienne de relevé des stats (13:00 Paris). Ne touche à aucun autre job — le pipeline minuit reste à crons_minuit_planifier().';

revoke all on function public.crons_stats_midi_planifier() from public;
revoke all on function public.crons_stats_midi_planifier() from anon, authenticated;

notify pgrst, 'reload schema';
