-- Les jointures PostgREST (`select *, profiles(display_name)`) s'appuient sur
-- une clé étrangère réelle entre les tables. `poster_id` pointait vers
-- auth.users, donc aucune relation vers `profiles` n'était visible et
-- l'embedding échouait à l'exécution.
--
-- profiles.id référence déjà auth.users(id) on delete cascade, donc repointer
-- vers profiles conserve exactement la même intégrité.

alter table public.assignments
  drop constraint if exists assignments_poster_id_fkey;
alter table public.assignments
  add constraint assignments_poster_id_fkey
  foreign key (poster_id) references public.profiles (id) on delete cascade;

alter table public.slideshows
  drop constraint if exists slideshows_poster_id_fkey;
alter table public.slideshows
  add constraint slideshows_poster_id_fkey
  foreign key (poster_id) references public.profiles (id) on delete set null;
