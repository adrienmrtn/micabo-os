-- Cloisonnement : cet OS n'héberge que micabo.
-- Plus de fallback Sophia, plus de ligne utilisable dans applications.

create or replace function public.application_id_micabo()
returns uuid
language sql
stable
set search_path = public
as $$
  select id from public.applications where slug = 'micabo' limit 1
$$;

-- Ancien nom conservé pour le SQL déjà compilé : il renvoie micabo, jamais Sophia.
create or replace function public.application_id_sophia()
returns uuid
language sql
stable
set search_path = public
as $$
  select public.application_id_micabo()
$$;

-- Backfill vert (tables vides en greenfield ; inoffensif s'il y a déjà des lignes).
update public.comptes set application_id = public.application_id_micabo()
  where application_id is distinct from public.application_id_micabo();
update public.comptes_reference set application_id = public.application_id_micabo()
  where application_id is distinct from public.application_id_micabo();
update public.contenus set application_id = public.application_id_micabo()
  where application_id is distinct from public.application_id_micabo();
update public.labels set application_id = public.application_id_micabo()
  where application_id is distinct from public.application_id_micabo();
update public.media_library set application_id = public.application_id_micabo()
  where application_id is distinct from public.application_id_micabo();
update public.import_file set application_id = public.application_id_micabo()
  where application_id is distinct from public.application_id_micabo();
update public.ugc_personas set application_id = public.application_id_micabo()
  where application_id is distinct from public.application_id_micabo();
update public.ugc_reactions set application_id = public.application_id_micabo()
  where application_id is distinct from public.application_id_micabo();
update public.ugc_utilisations set application_id = public.application_id_micabo()
  where application_id is distinct from public.application_id_micabo();
update public.ugc_video_posts set application_id = public.application_id_micabo()
  where application_id is distinct from public.application_id_micabo();
update public.papier_masters set application_id = public.application_id_micabo()
  where application_id is distinct from public.application_id_micabo();

alter table public.comptes
  alter column application_id set default public.application_id_micabo();
alter table public.comptes_reference
  alter column application_id set default public.application_id_micabo();
alter table public.contenus
  alter column application_id set default public.application_id_micabo();
alter table public.labels
  alter column application_id set default public.application_id_micabo();
alter table public.media_library
  alter column application_id set default public.application_id_micabo();
alter table public.import_file
  alter column application_id set default public.application_id_micabo();
alter table public.ugc_personas
  alter column application_id set default public.application_id_micabo();
alter table public.ugc_reactions
  alter column application_id set default public.application_id_micabo();
alter table public.ugc_utilisations
  alter column application_id set default public.application_id_micabo();
alter table public.ugc_video_posts
  alter column application_id set default public.application_id_micabo();
alter table public.papier_masters
  alter column application_id set default public.application_id_micabo();

-- Sophia absente : plus aucune ligne, plus aucun FK.
delete from public.applications where slug = 'sophia';

insert into public.applications (id, slug, nom) values
  ('00000000-0000-4000-8000-000000000002', 'micabo', 'micabo')
on conflict (slug) do update set nom = excluded.nom;

-- Filet cron : aucun job ne doit pointer hors de ce projet, ni rester actif.
do $guard$
declare
  r record;
begin
  if to_regclass('cron.job') is null then
    return;
  end if;
  for r in
    select jobid, jobname, command
    from cron.job
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
$guard$;
