-- Phase 2 : master quotidien « papier » (papercraft) — FR uniquement.
-- Un master par jour Paris. Scènes = storyboard (image Nano Banana + clip Seedance).
-- Traduction / voix / karaoke / assignation CM = phases suivantes.

create table if not exists public.papier_masters (
  id uuid primary key default gen_random_uuid(),
  date_publication date not null,
  topic text,
  kind text not null default 'culture',
  narration_style text not null default 'revelation',
  script jsonb,
  statut text not null default 'queued',
  etape text,
  progression numeric not null default 0,
  erreur text,
  busy boolean not null default false,
  journal jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint papier_masters_date_unique unique (date_publication),
  constraint papier_masters_statut_check
    check (statut in ('queued', 'scripting', 'images', 'clips', 'ready', 'failed')),
  constraint papier_masters_kind_check
    check (kind in ('faits', 'culture', 'pub')),
  constraint papier_masters_style_check
    check (narration_style in ('question', 'revelation', 'storytelling', 'listicle')),
  constraint papier_masters_progression_check
    check (progression >= 0 and progression <= 1)
);

comment on table public.papier_masters is
  'Vidéo papier quotidienne (master FR). Une ligne par jour Paris.';

create index if not exists papier_masters_date_idx
  on public.papier_masters (date_publication desc);

create index if not exists papier_masters_statut_idx
  on public.papier_masters (statut);

create table if not exists public.papier_scenes (
  id uuid primary key default gen_random_uuid(),
  master_id uuid not null references public.papier_masters (id) on delete cascade,
  index int not null,
  narration text not null default '',
  overlay text not null default '',
  image_prompt text not null default '',
  video_prompt text not null default '',
  image_path text,
  image_url text,
  clip_path text,
  clip_url text,
  clip_fal jsonb,
  duree_cible int not null default 6,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint papier_scenes_master_index unique (master_id, index),
  constraint papier_scenes_index_check check (index >= 0),
  constraint papier_scenes_duree_check check (duree_cible in (4, 6, 8))
);

comment on table public.papier_scenes is
  'Plans du master papier : narration FR, image papercraft, clip Seedance.';

create index if not exists papier_scenes_master_idx
  on public.papier_scenes (master_id, index);

alter table public.papier_masters enable row level security;
alter table public.papier_scenes enable row level security;

drop policy if exists papier_masters_admin on public.papier_masters;
create policy papier_masters_admin on public.papier_masters
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists papier_scenes_admin on public.papier_scenes;
create policy papier_scenes_admin on public.papier_scenes
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select, insert, update, delete on public.papier_masters to authenticated;
grant select, insert, update, delete on public.papier_scenes to authenticated;
grant all on public.papier_masters to service_role;
grant all on public.papier_scenes to service_role;
