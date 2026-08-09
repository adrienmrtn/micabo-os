-- Interdit le quota 0 (introduit en 0183 pour « pool mince »).
-- Un compte actif doit TOUJOURS viser au moins 1 post/jour.

update public.comptes
set posts_par_jour = 1
where posts_par_jour is null
   or posts_par_jour < 1;

alter table public.comptes
  drop constraint if exists comptes_posts_par_jour_check;

alter table public.comptes
  add constraint comptes_posts_par_jour_check
  check (posts_par_jour >= 1 and posts_par_jour <= 3);

alter table public.comptes
  alter column posts_par_jour set default 1;

alter table public.comptes
  alter column posts_par_jour set not null;
