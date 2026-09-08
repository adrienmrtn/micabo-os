-- Reviews du jour : une review liée à un slideshow posté + skip de file.
-- Les reviews classiques (sans post_id) restent inchangées.

alter table public.reviews
  add column if not exists post_id uuid references public.posts (id) on delete set null,
  add column if not exists passage_id uuid references public.passages (id) on delete set null,
  add column if not exists publie_url text,
  add column if not exists source_url text,
  add column if not exists handle_tiktok text;

create unique index if not exists reviews_post_uidx
  on public.reviews (post_id)
  where post_id is not null;

comment on column public.reviews.post_id is
  'Slideshow posté visé (file QA du jour). Null = review libre, page Reviews.';
comment on column public.reviews.publie_url is
  'Snapshot du TikTok du créateur au moment de l''envoi (pop-up).';
comment on column public.reviews.source_url is
  'Snapshot du TikTok d''origine au moment de l''envoi.';

create table if not exists public.review_quotidienne_skips (
  post_id uuid not null references public.posts (id) on delete cascade,
  jour date not null,
  admin_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (post_id, jour)
);

create index if not exists review_quotidienne_skips_jour_idx
  on public.review_quotidienne_skips (jour);

alter table public.review_quotidienne_skips enable row level security;

drop policy if exists review_quotidienne_skips_admin on public.review_quotidienne_skips;
create policy review_quotidienne_skips_admin on public.review_quotidienne_skips
  for all using (public.is_admin()) with check (public.is_admin());

insert into public.reglages (cle, valeur) values
  ('review_quotidienne_remarques', '[
    "Hook trop petit, on le lit trop tard",
    "Texte mal calé sur l''image",
    "Rythme trop lent vs l''original",
    "Les slides ne suivent pas l''original",
    "Musique trop basse ou coupée",
    "Bien calé — continue comme ça"
  ]'::jsonb)
on conflict (cle) do nothing;

notify pgrst, 'reload schema';
