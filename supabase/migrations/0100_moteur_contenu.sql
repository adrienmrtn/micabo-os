-- Sophia Culture Générale — Moteur de contenu TikTok
--
-- Remplace le schéma précédent (slideshows) par le modèle du brief : un poster
-- tient un ou plusieurs comptes de publication, chaque compte tire sa matière
-- d'un compte de référence appartenant à l'entreprise, et produit des posts
-- recyclés / remaniés / nouveaux selon des ratios configurables.

-- ---------------------------------------------------------------------------
-- Table rase. auth.users est préservé : les connexions existantes restent
-- valides, les profils sont re-provisionnés en fin de migration.
-- ---------------------------------------------------------------------------
drop trigger if exists on_auth_user_created on auth.users;
drop view if exists public.poster_slideshows cascade;
drop view if exists public.poster_accounts cascade;
drop table if exists public.sophia_variants cascade;
drop table if exists public.sophia_corrections cascade;
drop table if exists public.slideshow_frames cascade;
drop table if exists public.slideshows cascade;
drop table if exists public.account_images cascade;
drop table if exists public.assignments cascade;
drop table if exists public.tiktok_accounts cascade;
drop table if exists public.discovery_runs cascade;
drop table if exists public.mobile_tokens cascade;
drop table if exists public.sophia_prompts cascade;
drop table if exists public.profiles cascade;
drop table if exists public.user_roles cascade;
drop function if exists public.handle_new_user() cascade;
drop function if exists public.is_admin() cascade;
drop function if exists public.has_role(uuid, public.app_role) cascade;
drop function if exists public.enforce_assignment_limit() cascade;
drop function if exists public.prevent_reference_slideshow_delete() cascade;

-- ---------------------------------------------------------------------------
-- Rôles : inchangé côté principe (jamais de rôle sur un profil éditable).
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.app_role as enum ('admin', 'poster');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.post_type as enum ('recycle', 'remanie', 'nouveau');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.post_statut as enum ('brouillon', 'assigne', 'valide_par_poster', 'publie');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.media_source as enum (
    'nettoye_reference', 'stock_libre_de_droits', 'genere_ia', 'fourni_par_freelance'
  );
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- Posters
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  prenom text,
  nom text,
  email text,
  langues text[] not null default '{fr}',
  is_active boolean not null default true,
  -- Un compte créé par l'admin arrive avec un mot de passe généré ; on force
  -- son changement à la première connexion.
  must_change_password boolean not null default false,
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
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role);
$$;

create or replace function public.is_admin()
returns boolean language sql security definer stable set search_path = public as $$
  select public.has_role(auth.uid(), 'admin');
$$;

-- ---------------------------------------------------------------------------
-- Comptes de référence : comptes TikTok de l'entreprise servant de source.
-- Leur handle n'est jamais exposé aux posters.
-- ---------------------------------------------------------------------------
create table public.comptes_reference (
  id uuid primary key default gen_random_uuid(),
  handle_tiktok text not null unique,
  niche text,
  langue text not null default 'fr',
  is_active boolean not null default true,
  dernier_scrape_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Comptes de publication tenus par les posters.
-- ---------------------------------------------------------------------------
create table public.comptes (
  id uuid primary key default gen_random_uuid(),
  poster_id uuid not null references auth.users (id) on delete cascade,
  compte_reference_id uuid references public.comptes_reference (id) on delete set null,
  langue text not null default 'fr',
  -- Persona générée à la création, modifiable par l'admin.
  persona_nom text,
  persona_bio text,
  avatar_url text,
  avatar_source text,
  handle_tiktok text,
  -- Prompt de ton/voix propre au compte, injecté à la traduction.
  style_profile text,
  -- Sert à appliquer la règle « semaine 1 » (100 % recyclé, 2 posts/jour).
  demarre_le date not null default current_date,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index comptes_poster_idx on public.comptes (poster_id);

-- ---------------------------------------------------------------------------
-- Bibliothèque de médias, par compte. Alimentée par le nettoyage des posts de
-- référence, par du stock libre de droits, de la génération IA, ou le freelance.
-- ---------------------------------------------------------------------------
create table public.media_library (
  id uuid primary key default gen_random_uuid(),
  compte_id uuid references public.comptes (id) on delete cascade,
  compte_reference_id uuid references public.comptes_reference (id) on delete set null,
  storage_path text not null unique,
  url text not null,
  source public.media_source not null default 'nettoye_reference',
  tags text[] not null default '{}',
  langue text,
  -- Un visage identifiable interdit l'usage en photo de profil (RGPD).
  visage_identifiable boolean,
  used_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index media_library_compte_idx on public.media_library (compte_id, used_count);

-- ---------------------------------------------------------------------------
-- Sujets : angles proposés par l'IA à partir des posts de référence nettoyés.
-- ---------------------------------------------------------------------------
create table public.sujets (
  id uuid primary key default gen_random_uuid(),
  titre text not null,
  structure_slides jsonb not null default '[]',
  compte_reference_id uuid references public.comptes_reference (id) on delete set null,
  langue text not null default 'fr',
  -- Trace du post d'origine, pour ne pas re-proposer deux fois le même angle.
  source_url text unique,
  pertinence_score integer,
  pertinence_raison text,
  statut text not null default 'propose'
    check (statut in ('propose', 'retenu', 'rejete', 'utilise')),
  created_at timestamptz not null default now()
);

create index sujets_statut_idx on public.sujets (statut, pertinence_score desc);

-- ---------------------------------------------------------------------------
-- Posts : l'unité que le poster publie.
-- ---------------------------------------------------------------------------
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  compte_id uuid not null references public.comptes (id) on delete cascade,
  sujet_id uuid references public.sujets (id) on delete set null,
  date_publication_prevue date,
  type public.post_type not null default 'nouveau',
  statut public.post_statut not null default 'brouillon',
  -- Filiation pour les recyclés et remaniés.
  source_post_id uuid references public.posts (id) on delete set null,
  musique_url text,
  musique_titre text,
  musique_plateforme text,
  publie_at timestamptz,
  publie_url text,
  -- Suivi du traitement IA.
  pipeline_statut text not null default 'pending'
    check (pipeline_statut in ('pending', 'running', 'done', 'failed')),
  pipeline_etape text,
  pipeline_erreur text,
  created_at timestamptz not null default now()
);

-- Un créneau par compte et par jour ; le second post du jour prend le créneau 2.
create table public.post_slides (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  position integer not null,
  media_id uuid references public.media_library (id) on delete set null,
  texte_overlay text,
  position_sophia boolean not null default false,
  unique (post_id, position)
);

create index posts_compte_date_idx on public.posts (compte_id, date_publication_prevue);
create index posts_pipeline_idx on public.posts (pipeline_statut, created_at);
create index post_slides_post_idx on public.post_slides (post_id, position);

-- Métriques des posts publiés, récoltées sur les comptes des posters.
-- C'est ce qui permet de recycler « les meilleures perfs du compte ».
create table public.post_metrics (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  vues integer,
  likes integer,
  commentaires integer,
  partages integer,
  collecte_at timestamptz not null default now()
);

create index post_metrics_post_idx on public.post_metrics (post_id, collecte_at desc);

-- ---------------------------------------------------------------------------
-- Configuration : ratios, fréquence, règles. Rien de figé dans le code.
-- ---------------------------------------------------------------------------
create table public.reglages (
  cle text primary key,
  valeur jsonb not null,
  updated_by uuid references auth.users (id),
  updated_at timestamptz not null default now()
);

insert into public.reglages (cle, valeur) values
  ('repartition', '{"recycle": 60, "remanie": 20, "nouveau": 20}'),
  ('frequence', '{"posts_par_jour": 2}'),
  ('semaine1', '{"actif": true, "jours": 7, "posts_par_jour": 2, "tout_recycle": true}')
on conflict (cle) do nothing;

-- Prompts éditables (placement Sophia, traduction, pertinence).
create table public.prompts (
  cle text primary key,
  contenu text not null,
  updated_by uuid references auth.users (id),
  updated_at timestamptz not null default now()
);

-- Corrections admin, réinjectées en few-shot.
create table public.corrections (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references public.posts (id) on delete set null,
  texte_origine text,
  texte_corrige text not null,
  admin_id uuid references auth.users (id),
  created_at timestamptz not null default now()
);

create index corrections_recent_idx on public.corrections (created_at desc);

-- Journal des extractions Apify.
create table public.extractions (
  id uuid primary key default gen_random_uuid(),
  compte_reference_id uuid references public.comptes_reference (id) on delete set null,
  demarre_at timestamptz not null default now(),
  termine_at timestamptz,
  statut text not null default 'running' check (statut in ('running', 'done', 'failed')),
  posts_recuperes integer not null default 0,
  medias_stockes integer not null default 0,
  erreur text
);

-- Liens de livraison mobile (QR code), sans authentification.
create table public.mobile_tokens (
  token text primary key,
  post_id uuid not null references public.posts (id) on delete cascade,
  expires_at timestamptz not null default (now() + interval '30 days'),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Provisioning à l'inscription.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  owner_email constant text := 'maximilienkender@gmail.com';
  is_owner boolean;
begin
  is_owner := new.email = owner_email;

  insert into public.profiles (id, email, prenom, is_active, must_change_password)
  values (
    new.id,
    new.email,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'prenom'), ''), split_part(new.email, '@', 1)),
    is_owner,
    not is_owner
  )
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, case when is_owner then 'admin' else 'poster' end)
  on conflict (user_id, role) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Vue poster : tout ce dont le poster a besoin, sans jamais révéler le compte
-- de référence dont vient la matière.
-- ---------------------------------------------------------------------------
create view public.posts_poster
with (security_invoker = off) as
  select
    p.id,
    c.poster_id,
    p.compte_id,
    c.persona_nom,
    c.handle_tiktok,
    c.langue,
    p.date_publication_prevue,
    p.type,
    p.statut,
    p.musique_url,
    p.musique_titre,
    p.musique_plateforme,
    p.publie_at,
    p.publie_url,
    s.titre as sujet_titre,
    p.created_at
  from public.posts p
  join public.comptes c on c.id = p.compte_id
  left join public.sujets s on s.id = p.sujet_id
  where p.pipeline_statut = 'done'
    and (c.poster_id = auth.uid() or public.is_admin());

grant select on public.posts_poster to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.comptes_reference enable row level security;
alter table public.comptes enable row level security;
alter table public.media_library enable row level security;
alter table public.sujets enable row level security;
alter table public.posts enable row level security;
alter table public.post_slides enable row level security;
alter table public.post_metrics enable row level security;
alter table public.reglages enable row level security;
alter table public.prompts enable row level security;
alter table public.corrections enable row level security;
alter table public.extractions enable row level security;
alter table public.mobile_tokens enable row level security;

create policy profiles_select on public.profiles
  for select using (id = auth.uid() or public.is_admin());
create policy profiles_update on public.profiles
  for update using (id = auth.uid() or public.is_admin());

create policy roles_select on public.user_roles
  for select using (user_id = auth.uid() or public.is_admin());
create policy roles_admin on public.user_roles
  for all using (public.is_admin()) with check (public.is_admin());

-- Les comptes de référence restent strictement admin : c'est ce qui garantit
-- qu'un poster ne remonte jamais à la source de sa matière.
create policy reference_admin on public.comptes_reference
  for all using (public.is_admin()) with check (public.is_admin());

create policy comptes_select on public.comptes
  for select using (poster_id = auth.uid() or public.is_admin());
create policy comptes_admin on public.comptes
  for all using (public.is_admin()) with check (public.is_admin());

create policy media_select on public.media_library
  for select using (
    public.is_admin()
    or exists (select 1 from public.comptes c where c.id = compte_id and c.poster_id = auth.uid())
  );
create policy media_admin on public.media_library
  for all using (public.is_admin()) with check (public.is_admin());

create policy sujets_admin on public.sujets
  for all using (public.is_admin()) with check (public.is_admin());

create policy posts_select on public.posts
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.comptes c
      where c.id = compte_id and c.poster_id = auth.uid() and posts.pipeline_statut = 'done'
    )
  );
-- Le poster valide et marque comme publié ; l'admin peut tout.
create policy posts_update on public.posts
  for update using (
    public.is_admin()
    or exists (select 1 from public.comptes c where c.id = compte_id and c.poster_id = auth.uid())
  );
create policy posts_admin_write on public.posts
  for all using (public.is_admin()) with check (public.is_admin());

create policy slides_select on public.post_slides
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.posts p join public.comptes c on c.id = p.compte_id
      where p.id = post_id and c.poster_id = auth.uid() and p.pipeline_statut = 'done'
    )
  );
-- Le poster peut réordonner ses slides avant validation.
create policy slides_update on public.post_slides
  for update using (
    public.is_admin()
    or exists (
      select 1 from public.posts p join public.comptes c on c.id = p.compte_id
      where p.id = post_id and c.poster_id = auth.uid()
    )
  );
create policy slides_admin on public.post_slides
  for all using (public.is_admin()) with check (public.is_admin());

create policy metrics_select on public.post_metrics
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.posts p join public.comptes c on c.id = p.compte_id
      where p.id = post_id and c.poster_id = auth.uid()
    )
  );
create policy metrics_admin on public.post_metrics
  for all using (public.is_admin()) with check (public.is_admin());

-- Réglages et prompts : lecture pour tous les connectés (le pipeline en a
-- besoin), écriture réservée à l'admin.
create policy reglages_read on public.reglages for select using (true);
create policy reglages_admin on public.reglages
  for all using (public.is_admin()) with check (public.is_admin());
create policy prompts_read on public.prompts for select using (true);
create policy prompts_admin on public.prompts
  for all using (public.is_admin()) with check (public.is_admin());

create policy corrections_admin on public.corrections
  for all using (public.is_admin()) with check (public.is_admin());
create policy extractions_admin on public.extractions
  for all using (public.is_admin()) with check (public.is_admin());
-- Les tokens mobiles ne sont résolus que par les Edge Functions (service_role).
create policy tokens_admin on public.mobile_tokens
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- GRANTs
-- ---------------------------------------------------------------------------
grant usage on schema public to authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;
grant execute on function public.has_role(uuid, public.app_role) to authenticated, service_role;
grant execute on function public.is_admin() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Re-provisioning des comptes déjà présents.
-- ---------------------------------------------------------------------------
insert into public.profiles (id, email, prenom, is_active)
select u.id, u.email, split_part(u.email, '@', 1), true
from auth.users u
on conflict (id) do nothing;

insert into public.user_roles (user_id, role)
select u.id,
       case when u.email = 'maximilienkender@gmail.com' then 'admin'::public.app_role
            else 'poster'::public.app_role end
from auth.users u
on conflict (user_id, role) do nothing;
