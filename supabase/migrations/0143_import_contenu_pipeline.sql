-- Moteur v-next — Étape 3 : colonnes pipeline d'import pré-calculé.
--
-- La fonction Edge `import-contenu` avance OCR → pertinence → nettoyage →
-- traduction toutes langues → Sophia par langue → score → valide.
-- Compteur de tentatives pour les reprises (Gemini / nettoyage).

alter table public.contenus
  add column if not exists import_tentatives integer not null default 0;

-- Cron drain (à activer en prod avec le vrai CRON_SECRET — même pattern que 0117) :
--
-- select cron.schedule('import-contenu-drain', '* * * * *', $job$
--   select net.http_post(
--     url := 'https://<ref>.supabase.co/functions/v1/import-contenu',
--     headers := jsonb_build_object('content-type','application/json','x-cron-secret','<CRON_SECRET>'),
--     body := '{}'::jsonb,
--     timeout_milliseconds := 55000
--   );
-- $job$);
