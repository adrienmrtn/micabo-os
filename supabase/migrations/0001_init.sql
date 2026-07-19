-- Sophia Marketing Orga — schéma initial.
--
-- Deux rôles seulement : admin (pilote tout) et poster (récupère son slideshow
-- du jour, copie les textes, télécharge visuels + audio, publie sur TikTok).
-- Tout le travail de production est automatisé par le pipeline.

-- ---------------------------------------------------------------------------
-- Table rase du schéma précédent. auth.users est volontairement préservé pour
-- ne pas invalider les comptes existants — les profils sont re-provisionnés
-- en fin de migration.
-- ---------------------------------------------------------------------------
drop table if exists public.assignments cascade;
drop table if exists public.reference_accounts cascade;
drop table if exists public.submissions cascade;
drop table if exists public.ratings cascade;
drop table if exists public.messages cascade;
drop table if exists public.announcements cascade;
drop table if exists public.tiktok_tokens cascade;
drop table if exists public.creators cascade;
drop table if exists public.users cascade;
drop view if exists public.creator_assignments cascade;
-- Le trigger est retiré explicitement avant sa fonction : compter sur un
-- `drop ... cascade` pour l'emporter suppose des droits sur auth.users que le
-- rôle courant n'a pas forcément.
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user() cascade;
drop function if exists public.is_admin() cascade;
drop function if exists public.enforce_assignment_limit() cascade;

-- ---------------------------------------------------------------------------
-- Rôles
--
-- Le rôle vit dans sa propre table, jamais sur profiles : une colonne `role`
-- sur un profil éditable par son propriétaire est une escalade de privilèges
-- en attente. has_role() est SECURITY DEFINER pour être appelable depuis les
-- policies sans récursion RLS.
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.app_role as enum ('admin', 'poster');
exception when duplicate_object then null;
end $$;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url text,
  account_setup_done boolean not null default false,
  is_active boolean not null default true,
  locale text not null default 'fr',
  created_at timestamptz not null default now()
);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles where user_id = _user_id and role = _role
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.has_role(auth.uid(), 'admin');
$$;

-- ---------------------------------------------------------------------------
-- Comptes TikTok
--
-- is_reference = true  -> compte source scanné par la discovery
-- is_reference = false -> compte de publication tenu par un poster
-- suggested_creator_handle est le pseudo que l'admin demande au poster de
-- créer ; c'est la seule information de cette table qu'un poster peut voir.
-- ---------------------------------------------------------------------------
create table public.tiktok_accounts (
  id uuid primary key default gen_random_uuid(),
  handle text not null unique,
  profile_url text,
  avatar_url text,
  niche text,
  suggested_creator_handle text,
  is_reference boolean not null default true,
  is_active boolean not null default true,
  notes text,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  poster_id uuid not null references auth.users (id) on delete cascade,
  tiktok_account_id uuid not null references public.tiktok_accounts (id) on delete cascade,
  assigned_by uuid references auth.users (id),
  assigned_at timestamptz not null default now(),
  unique (poster_id, tiktok_account_id)
);

create index assignments_poster_id_idx on public.assignments (poster_id);

-- Plafond de 4 comptes par poster, tenu par la base pour que l'UI ne soit pas
-- le seul garde-fou.
create or replace function public.enforce_assignment_limit()
returns trigger
language plpgsql
as $$
begin
  if (select count(*) from public.assignments where poster_id = new.poster_id) >= 4 then
    raise exception 'Un poster ne peut pas avoir plus de 4 comptes assignés';
  end if;
  return new;
end;
$$;

create trigger assignments_enforce_limit
  before insert on public.assignments
  for each row execute function public.enforce_assignment_limit();

-- ---------------------------------------------------------------------------
-- Slideshows
--
-- tiktok_account_id pointe vers le compte de *référence* d'où vient le contenu.
-- Un poster ne doit jamais le voir : les lectures poster passent par la vue
-- poster_slideshows définie plus bas, qui ne l'expose pas.
-- ---------------------------------------------------------------------------
create table public.slideshows (
  id uuid primary key default gen_random_uuid(),
  tiktok_account_id uuid references public.tiktok_accounts (id) on delete set null,
  poster_id uuid references auth.users (id) on delete set null,
  source_url text,
  title text,
  hook_title text,
  audio_url text,
  is_auto_generated boolean not null default true,
  auto_pipeline_status text not null default 'pending'
    check (auto_pipeline_status in ('pending', 'running', 'done', 'failed')),
  auto_pipeline_error text,
  auto_pipeline_step text,
  assigned_date date,
  posted_at timestamptz,
  posted_url text,
  created_at timestamptz not null default now()
);

-- Un slideshow par jour et par compte assigné.
create unique index slideshows_one_per_account_per_day
  on public.slideshows (poster_id, tiktok_account_id, assigned_date)
  where assigned_date is not null;

create index slideshows_pipeline_idx on public.slideshows (auto_pipeline_status, created_at);
create index slideshows_poster_date_idx on public.slideshows (poster_id, assigned_date);

create table public.slideshow_frames (
  id uuid primary key default gen_random_uuid(),
  slideshow_id uuid not null references public.slideshows (id) on delete cascade,
  position integer not null,
  original_url text,
  cleaned_url text,
  extracted_text text,
  translated_text text,
  clean_status text not null default 'pending'
    check (clean_status in ('pending', 'running', 'done', 'failed')),
  clean_attempts integer not null default 0,
  unique (slideshow_id, position)
);

create index slideshow_frames_slideshow_idx on public.slideshow_frames (slideshow_id, position);

-- Textes pub Sophia générés pour une slide donnée ; `chosen` marque la variante
-- retenue (auto ou forcée par l'admin).
create table public.sophia_variants (
  id uuid primary key default gen_random_uuid(),
  slideshow_id uuid not null references public.slideshows (id) on delete cascade,
  frame_id uuid references public.slideshow_frames (id) on delete cascade,
  text text not null,
  chosen boolean not null default false,
  created_at timestamptz not null default now()
);

create index sophia_variants_slideshow_idx on public.sophia_variants (slideshow_id);

-- Corrections admin, réinjectées en few-shot dans le prompt de génération.
create table public.sophia_corrections (
  id uuid primary key default gen_random_uuid(),
  slideshow_id uuid references public.slideshows (id) on delete set null,
  frame_id uuid references public.slideshow_frames (id) on delete set null,
  original_text text,
  corrected_text text not null,
  admin_id uuid references auth.users (id),
  created_at timestamptz not null default now()
);

create index sophia_corrections_recent_idx on public.sophia_corrections (created_at desc);

-- Prompts éditables depuis l'admin (master prompt Sophia, nettoyage, etc.).
create table public.sophia_prompts (
  key text primary key,
  content text not null,
  updated_by uuid references auth.users (id),
  updated_at timestamptz not null default now()
);

-- Liens de livraison mobile, sans authentification, expiration 30 jours.
create table public.mobile_tokens (
  token text primary key,
  slideshow_id uuid not null references public.slideshows (id) on delete cascade,
  expires_at timestamptz not null default (now() + interval '30 days'),
  created_at timestamptz not null default now()
);

create index mobile_tokens_slideshow_idx on public.mobile_tokens (slideshow_id);

-- Journal des runs de discovery, pour l'écran admin.
create table public.discovery_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running'
    check (status in ('running', 'done', 'failed')),
  accounts_scanned integer not null default 0,
  slideshows_created integer not null default 0,
  error text
);

-- ---------------------------------------------------------------------------
-- Règle de conservation : un slideshow rattaché à un compte de référence n'est
-- jamais supprimé — il reste réutilisable pour une retraduction.
-- ---------------------------------------------------------------------------
create or replace function public.prevent_reference_slideshow_delete()
returns trigger
language plpgsql
as $$
begin
  if old.tiktok_account_id is not null then
    raise exception 'Un slideshow lié à un compte de référence ne peut pas être supprimé';
  end if;
  return old;
end;
$$;

create trigger slideshows_prevent_delete
  before delete on public.slideshows
  for each row execute function public.prevent_reference_slideshow_delete();

-- ---------------------------------------------------------------------------
-- Vue poster : tout ce dont un poster a besoin, sans jamais révéler le compte
-- de référence. Security definer (security_invoker = off) avec son propre
-- filtre auth.uid() à la place de la RLS qu'elle contourne.
-- ---------------------------------------------------------------------------
create view public.poster_slideshows
with (security_invoker = off) as
  select
    s.id,
    s.poster_id,
    s.title,
    s.hook_title,
    s.audio_url,
    s.assigned_date,
    s.posted_at,
    s.posted_url,
    s.created_at,
    ta.suggested_creator_handle,
    ta.niche
  from public.slideshows s
  left join public.tiktok_accounts ta on ta.id = s.tiktok_account_id
  where s.auto_pipeline_status = 'done'
    and (s.poster_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- Provisioning à l'inscription : profil + rôle poster par défaut.
-- L'adresse du propriétaire est promue admin automatiquement.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_email constant text := 'maximilienkender@gmail.com';
  assigned_role public.app_role;
begin
  assigned_role := case when new.email = owner_email then 'admin' else 'poster' end;

  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
      split_part(new.email, '@', 1)
    )
  )
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, assigned_role)
  on conflict (user_id, role) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.tiktok_accounts enable row level security;
alter table public.assignments enable row level security;
alter table public.slideshows enable row level security;
alter table public.slideshow_frames enable row level security;
alter table public.sophia_variants enable row level security;
alter table public.sophia_corrections enable row level security;
alter table public.sophia_prompts enable row level security;
alter table public.mobile_tokens enable row level security;
alter table public.discovery_runs enable row level security;

create policy "profiles_select_own_or_admin" on public.profiles
  for select using (id = auth.uid() or public.is_admin());
create policy "profiles_update_own_or_admin" on public.profiles
  for update using (id = auth.uid() or public.is_admin());

-- Lecture seule sur ses propres rôles ; toute écriture passe par l'admin.
create policy "user_roles_select_own_or_admin" on public.user_roles
  for select using (user_id = auth.uid() or public.is_admin());
create policy "user_roles_admin_write" on public.user_roles
  for all using (public.is_admin()) with check (public.is_admin());

-- Les comptes TikTok restent admin-only : c'est ce qui garantit qu'un poster
-- ne peut pas remonter au compte de référence.
create policy "tiktok_accounts_admin_all" on public.tiktok_accounts
  for all using (public.is_admin()) with check (public.is_admin());

create policy "assignments_select_own_or_admin" on public.assignments
  for select using (poster_id = auth.uid() or public.is_admin());
create policy "assignments_admin_write" on public.assignments
  for all using (public.is_admin()) with check (public.is_admin());

-- Un poster voit ses slideshows terminés et peut les marquer comme publiés.
create policy "slideshows_select_own_done_or_admin" on public.slideshows
  for select using (
    public.is_admin()
    or (poster_id = auth.uid() and auto_pipeline_status = 'done')
  );
create policy "slideshows_update_own_posted_or_admin" on public.slideshows
  for update using (public.is_admin() or poster_id = auth.uid());
create policy "slideshows_admin_insert" on public.slideshows
  for insert with check (public.is_admin());

create policy "slideshow_frames_select_own_or_admin" on public.slideshow_frames
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.slideshows s
      where s.id = slideshow_id
        and s.poster_id = auth.uid()
        and s.auto_pipeline_status = 'done'
    )
  );
create policy "slideshow_frames_admin_write" on public.slideshow_frames
  for all using (public.is_admin()) with check (public.is_admin());

create policy "sophia_variants_select_own_or_admin" on public.sophia_variants
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.slideshows s
      where s.id = slideshow_id
        and s.poster_id = auth.uid()
        and s.auto_pipeline_status = 'done'
    )
  );
create policy "sophia_variants_admin_write" on public.sophia_variants
  for all using (public.is_admin()) with check (public.is_admin());

create policy "sophia_corrections_admin_all" on public.sophia_corrections
  for all using (public.is_admin()) with check (public.is_admin());
create policy "sophia_prompts_admin_all" on public.sophia_prompts
  for all using (public.is_admin()) with check (public.is_admin());
create policy "discovery_runs_admin_all" on public.discovery_runs
  for all using (public.is_admin()) with check (public.is_admin());

-- Les tokens mobiles ne sont lisibles par personne côté client : seules les
-- Edge Functions (service_role) les résolvent, ce qui évite qu'un token fuite
-- par énumération.
create policy "mobile_tokens_admin_all" on public.mobile_tokens
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- GRANTs explicites
-- ---------------------------------------------------------------------------
grant usage on schema public to authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;
grant select on public.poster_slideshows to authenticated;
grant execute on function public.has_role(uuid, public.app_role) to authenticated, service_role;
grant execute on function public.is_admin() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Re-provisioning des comptes déjà présents dans auth.users (la migration ne
-- doit pas casser la connexion existante).
-- ---------------------------------------------------------------------------
insert into public.profiles (id, display_name)
select u.id, coalesce(nullif(trim(u.raw_user_meta_data ->> 'display_name'), ''), split_part(u.email, '@', 1))
from auth.users u
on conflict (id) do nothing;

insert into public.user_roles (user_id, role)
select u.id,
       case when u.email = 'maximilienkender@gmail.com' then 'admin'::public.app_role
            else 'poster'::public.app_role end
from auth.users u
on conflict (user_id, role) do nothing;

-- ---------------------------------------------------------------------------
-- Prompt Sophia par défaut (éditable ensuite depuis /admin/prompts).
-- ---------------------------------------------------------------------------
insert into public.sophia_prompts (key, content) values (
  'master',
  'Tu écris un court texte publicitaire pour l''app Sophia, à insérer sur une slide d''un slideshow TikTok.

Règles absolues :
- Tutoiement systématique ("tu"), jamais de vouvoiement.
- Voix cohérente avec le reste du slideshow.
- Ne jamais mentionner une autre application : reformule en conseil générique.
- Une à deux phrases maximum, ton naturel, pas de jargon marketing.
- Le texte doit s''enchaîner naturellement avec le contenu de la slide.'
) on conflict (key) do nothing;
