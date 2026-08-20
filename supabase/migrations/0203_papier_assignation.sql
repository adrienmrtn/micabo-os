-- Phase 4 : assignation de la vidéo papier localisée aux comptes CM.
-- Une même vidéo par langue, pour tous les CM actifs de cette langue.
-- Table dédiée (pas posts/passages) : le moteur slideshow / ELO reste intact.

create table if not exists public.papier_posts (
  id uuid primary key default gen_random_uuid(),
  compte_id uuid not null references public.comptes (id) on delete cascade,
  date_publication_prevue date not null,
  master_id uuid not null references public.papier_masters (id) on delete cascade,
  langue_id uuid not null references public.papier_langues (id) on delete cascade,
  langue text not null,
  title text,
  caption text,
  hashtags text,
  video_url text not null,
  video_path text,
  statut text not null default 'assigne',
  publie_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint papier_posts_compte_jour unique (compte_id, date_publication_prevue),
  constraint papier_posts_statut_check
    check (statut in ('assigne', 'publie'))
);

comment on table public.papier_posts is
  'Vidéo papier du jour assignée à un compte CM. Même langue = même vidéo.';

create index if not exists papier_posts_compte_jour_idx
  on public.papier_posts (compte_id, date_publication_prevue);

create index if not exists papier_posts_master_idx
  on public.papier_posts (master_id, langue);

create index if not exists papier_posts_langue_idx
  on public.papier_posts (langue_id);

alter table public.papier_posts enable row level security;

drop policy if exists papier_posts_admin on public.papier_posts;
create policy papier_posts_admin on public.papier_posts
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Créateur, HM de l'équipe et DM : lecture seule (calendrier / téléchargement).
drop policy if exists papier_posts_select_equipe on public.papier_posts;
create policy papier_posts_select_equipe on public.papier_posts
  for select to authenticated
  using (
    exists (
      select 1 from public.comptes c
      where c.id = papier_posts.compte_id
        and public.peut_voir_identifiants_compte(c.poster_id)
    )
  );

grant select, insert, update, delete on public.papier_posts to authenticated;
grant all on public.papier_posts to service_role;
