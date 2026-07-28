-- Moteur v-next — Étape 5 : variations déclenchées par la performance.
--
-- Une variation = nouveau contenu (parent_id, profondeur+1) avec reformulation
-- texte + visuels alternatifs du même label. Cap lignée = variation_profondeur_max
-- (réglages.scoring, défaut 2). Une seule variation directe par (parent, langue).

alter table public.contenus
  add column if not exists variation_langue text;

create index if not exists contenus_parent_variation_langue_idx
  on public.contenus (parent_id, variation_langue)
  where parent_id is not null;

-- Cron continu (optionnel) — drain des variations, à activer en prod :
--
-- select cron.schedule('variations-drain', '*/15 * * * *', $job$
--   select net.http_post(
--     url := 'https://<ref>.supabase.co/functions/v1/variations',
--     headers := jsonb_build_object('content-type','application/json','x-cron-secret','<CRON_SECRET>'),
--     body := '{}'::jsonb,
--     timeout_milliseconds := 55000
--   );
-- $job$);
