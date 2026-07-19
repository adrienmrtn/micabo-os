-- Bibliothèque d'images par compte.
--
-- Sert de filet quand le nettoyage IA échoue : plutôt que de livrer une slide
-- avec son texte d'origine incrusté, on substitue une image vierge de la
-- bibliothèque et le poster pose le texte lui-même dans TikTok.
--
-- Alimentée de deux façons : les uploads de l'admin, et les slides que le
-- pipeline a réussi à nettoyer, qui redeviennent des fonds réutilisables.

create table if not exists public.account_images (
  id uuid primary key default gen_random_uuid(),
  -- null = image commune, utilisable par tous les comptes
  tiktok_account_id uuid references public.tiktok_accounts (id) on delete cascade,
  storage_path text not null,
  public_url text not null,
  kind text not null default 'slide_background'
    check (kind in ('slide_background', 'profile_photo')),
  source text not null default 'upload'
    check (source in ('upload', 'cleaned_slide')),
  used_count integer not null default 0,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  unique (storage_path)
);

create index if not exists account_images_account_kind_idx
  on public.account_images (tiktok_account_id, kind, used_count);

-- D'où vient le visuel finalement livré, pour que l'admin sache lire sa file.
alter table public.slideshow_frames
  add column if not exists image_source text not null default 'original'
    check (image_source in ('original', 'cleaned', 'library'));

alter table public.account_images enable row level security;

create policy "account_images_admin_all" on public.account_images
  for all using (public.is_admin()) with check (public.is_admin());

-- Les posters lisent les photos de profil proposées pour leurs comptes
-- assignés, jamais le reste de la bibliothèque ni le compte de référence.
drop view if exists public.poster_profile_images;
create view public.poster_profile_images
with (security_invoker = off) as
  select
    i.id,
    a.poster_id,
    i.public_url
  from public.account_images i
  join public.assignments a on a.tiktok_account_id = i.tiktok_account_id
  where i.kind = 'profile_photo'
    and (a.poster_id = auth.uid() or public.is_admin());

grant select, insert, update, delete on public.account_images to authenticated;
grant all on public.account_images to service_role;
grant select on public.poster_profile_images to authenticated;
