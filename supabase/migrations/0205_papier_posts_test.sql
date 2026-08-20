-- Assignation papier de test : invisible sur les calendriers, rollbackable.
-- Une ligne réelle + une ligne test peuvent coexister le même jour.

alter table public.papier_posts
  add column if not exists est_test boolean not null default false;

comment on column public.papier_posts.est_test is
  'true = assignation admin de test, hors calendriers créateur / HM.';

alter table public.papier_posts
  drop constraint if exists papier_posts_compte_jour;

alter table public.papier_posts
  add constraint papier_posts_compte_jour
  unique (compte_id, date_publication_prevue, est_test);

create index if not exists papier_posts_test_idx
  on public.papier_posts (compte_id, date_publication_prevue)
  where est_test;
