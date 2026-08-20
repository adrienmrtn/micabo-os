-- Phase 3 : fan-out du master papier FR vers toutes les langues cibles
-- (traduction + TTS ElevenLabs Fal + mix ffmpeg + karaoke Fal).

create table if not exists public.papier_langues (
  id uuid primary key default gen_random_uuid(),
  master_id uuid not null references public.papier_masters (id) on delete cascade,
  langue text not null,
  title text,
  hook text,
  cta text,
  hashtags text,
  script jsonb,
  statut text not null default 'queued',
  etape text,
  progression numeric not null default 0,
  erreur text,
  busy boolean not null default false,
  voice text not null default 'George',
  video_mix_path text,
  video_mix_url text,
  video_path text,
  video_url text,
  journal jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint papier_langues_master_langue unique (master_id, langue),
  constraint papier_langues_statut_check
    check (statut in ('queued', 'translating', 'voice', 'mix', 'render', 'karaoke', 'ready', 'failed')),
  constraint papier_langues_progression_check
    check (progression >= 0 and progression <= 1)
);

comment on table public.papier_langues is
  'Localisation d''un master papier : script traduit, voix, vidéo finale karaoké.';

create index if not exists papier_langues_master_idx
  on public.papier_langues (master_id, langue);

create index if not exists papier_langues_statut_idx
  on public.papier_langues (statut);

create table if not exists public.papier_langue_scenes (
  id uuid primary key default gen_random_uuid(),
  langue_id uuid not null references public.papier_langues (id) on delete cascade,
  index int not null,
  narration text not null default '',
  overlay text not null default '',
  audio_path text,
  audio_url text,
  words jsonb,
  duree_sec numeric,
  mix_path text,
  mix_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint papier_langue_scenes_unique unique (langue_id, index),
  constraint papier_langue_scenes_index_check check (index >= 0)
);

comment on table public.papier_langue_scenes is
  'Plans localisés : narration, voix ElevenLabs, clip+voix mixés.';

create index if not exists papier_langue_scenes_langue_idx
  on public.papier_langue_scenes (langue_id, index);

alter table public.papier_langues enable row level security;
alter table public.papier_langue_scenes enable row level security;

drop policy if exists papier_langues_admin on public.papier_langues;
create policy papier_langues_admin on public.papier_langues
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists papier_langue_scenes_admin on public.papier_langue_scenes;
create policy papier_langue_scenes_admin on public.papier_langue_scenes
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select, insert, update, delete on public.papier_langues to authenticated;
grant select, insert, update, delete on public.papier_langue_scenes to authenticated;
grant all on public.papier_langues to service_role;
grant all on public.papier_langue_scenes to service_role;
