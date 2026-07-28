-- Moteur v-next — Étape 4 : scoring, minuit allégé, publie_url obligatoire.
--
-- Flag pour activer le runtime v-next sans couper le legacy tant que le
-- cutover n'est pas fait. Les Edge Functions `minuit-vnext`, `scoring`,
-- `assignation-contenu` respectent ce flag (sauf forcer admin).

insert into public.reglages (cle, valeur) values
  ('moteur_vnext', '{"actif": false}'::jsonb)
on conflict (cle) do nothing;

-- Impossible de passer à « publie » sans lien TikTok (posts legacy + passages).
create or replace function public.exiger_publie_url()
returns trigger
language plpgsql
as $$
begin
  if new.statut::text = 'publie'
     and (new.publie_url is null or btrim(new.publie_url) = '') then
    raise exception 'publie_url obligatoire pour marquer comme publié';
  end if;
  return new;
end;
$$;

drop trigger if exists posts_exiger_publie_url on public.posts;
create trigger posts_exiger_publie_url
  before insert or update of statut, publie_url on public.posts
  for each row execute function public.exiger_publie_url();

drop trigger if exists passages_exiger_publie_url on public.passages;
create trigger passages_exiger_publie_url
  before insert or update of statut, publie_url on public.passages
  for each row execute function public.exiger_publie_url();

-- Crons v-next (à activer en prod avec le vrai secret — legacy inchangé) :
--
-- -- Stats + scores + assignation à minuit Paris (22h UTC été)
-- select cron.schedule('minuit-vnext', '0 22 * * *', $job$
--   select net.http_post(
--     url := 'https://<ref>.supabase.co/functions/v1/minuit-vnext',
--     headers := jsonb_build_object('content-type','application/json','x-cron-secret','<CRON_SECRET>'),
--     body := '{}'::jsonb,
--     timeout_milliseconds := 280000
--   );
-- $job$);
--
-- select cron.schedule('minuit-vnext-rattrapage', '0 4 * * *', $job$
--   select net.http_post(
--     url := 'https://<ref>.supabase.co/functions/v1/minuit-vnext',
--     headers := jsonb_build_object('content-type','application/json','x-cron-secret','<CRON_SECRET>'),
--     body := '{"etapes":["assignation"]}'::jsonb,
--     timeout_milliseconds := 280000
--   );
-- $job$);
