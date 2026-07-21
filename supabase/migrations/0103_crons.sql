-- Planification du moteur.
--
-- ⚠️ Ce fichier documente la configuration appliquée en base ; il n'est pas
-- rejouable tel quel : <CRON_SECRET> doit être remplacé par le secret réel
-- (stocké dans les secrets Supabase, jamais dans le dépôt).
--
-- Deux pièges rencontrés, corrigés ici :
--
-- 1. pg_net abandonne au bout de 5 s par défaut. Nos fonctions prennent 15 à
--    250 s : sans `timeout_milliseconds`, la fonction s'exécute quand même mais
--    aucune réponse n'est enregistrée, donc plus aucune erreur visible.
-- 2. pg_cron tourne en UTC, sans fuseau par job. Les heures ci-dessous visent
--    l'heure de Paris en période d'été ; elles décalent d'une heure en hiver.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Extraction tôt le soir : la préparation a besoin de plusieurs heures pour
-- drainer (2 visuels par passage, un passage par minute).
select cron.schedule('extraction-soir', '0 18 * * *', $$
  select net.http_post(
    url := 'https://mbikecieskoobeizixig.supabase.co/functions/v1/extraction',
    headers := jsonb_build_object('content-type','application/json','x-cron-secret','<CRON_SECRET>'),
    body := '{}'::jsonb,
    timeout_milliseconds := 280000
  );
$$);

-- Préparation : chaque minute sur la fenêtre de nuit. Ne coûte rien quand la
-- file est vide (une simple requête qui renvoie « idle »).
select cron.schedule('preparation-nuit', '* 18-23,0-5 * * *', $$
  select net.http_post(
    url := 'https://mbikecieskoobeizixig.supabase.co/functions/v1/preparation',
    headers := jsonb_build_object('content-type','application/json','x-cron-secret','<CRON_SECRET>'),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  );
$$);

-- Assignation à minuit Paris, puis rattrapage au petit matin pour les sujets
-- préparés trop tard. Idempotente : elle ne complète que ce qui manque.
select cron.schedule('assignation-minuit', '0 22 * * *', $$
  select net.http_post(
    url := 'https://mbikecieskoobeizixig.supabase.co/functions/v1/assignation',
    headers := jsonb_build_object('content-type','application/json','x-cron-secret','<CRON_SECRET>'),
    body := '{}'::jsonb,
    timeout_milliseconds := 280000
  );
$$);

select cron.schedule('assignation-rattrapage', '0 4 * * *', $$
  select net.http_post(
    url := 'https://mbikecieskoobeizixig.supabase.co/functions/v1/assignation',
    headers := jsonb_build_object('content-type','application/json','x-cron-secret','<CRON_SECRET>'),
    body := '{}'::jsonb,
    timeout_milliseconds := 280000
  );
$$);

-- Pour tout arrêter :
--   select cron.unschedule('extraction-soir');
--   select cron.unschedule('preparation-nuit');
--   select cron.unschedule('assignation-minuit');
--   select cron.unschedule('assignation-rattrapage');
--
-- Pour diagnostiquer :
--   select status_code, content, created from net._http_response order by created desc limit 10;
