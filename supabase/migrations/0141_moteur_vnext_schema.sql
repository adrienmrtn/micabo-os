-- Moteur v-next — Étape 1 : schéma à côté de l'existant.
--
-- Nouvelles tables (labels, contenus, contenu_langues, passages) + score compte
-- + réglages scoring/paiement. Aucune table actuelle n'est droppée : le moteur
-- legacy (sujets / posts / ratios / compte_reference_id) continue de tourner
-- jusqu'au cutover. La migration de données est l'étape 2.

-- ---------------------------------------------------------------------------
-- Labels (niches éditoriales) — pont many-to-many sourcing ↔ assignation
-- ---------------------------------------------------------------------------
create table if not exists public.labels (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  slug text not null unique,
  couleur text,
  created_at timestamptz not null default now()
);

create table if not exists public.contenu_labels (
  contenu_id uuid not null, -- FK ajoutée après create contenus
  label_id uuid not null references public.labels (id) on delete cascade,
  primary key (contenu_id, label_id)
);

create table if not exists public.compte_labels (
  compte_id uuid not null references public.comptes (id) on delete cascade,
  label_id uuid not null references public.labels (id) on delete cascade,
  primary key (compte_id, label_id)
);

create table if not exists public.compte_reference_labels (
  compte_reference_id uuid not null references public.comptes_reference (id) on delete cascade,
  label_id uuid not null references public.labels (id) on delete cascade,
  primary key (compte_reference_id, label_id)
);

create index if not exists compte_labels_label_idx on public.compte_labels (label_id);
create index if not exists compte_reference_labels_label_idx
  on public.compte_reference_labels (label_id);

-- ---------------------------------------------------------------------------
-- Contenu : la matière publiable (visuels partagés, language-agnostique)
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.contenu_statut as enum ('brouillon', 'valide', 'rejete');
exception when duplicate_object then null;
end $$;

create table if not exists public.contenus (
  id uuid primary key default gen_random_uuid(),
  titre text not null default '',
  -- Visuels nettoyés + refs brutes (langue-agnostique).
  -- [{ position, media_id, raw_url, reference_url }]
  structure_slides jsonb not null default '[]',
  compte_reference_id uuid references public.comptes_reference (id) on delete set null,
  -- Trace migration étape 2 (sujets → contenus) ; nullable ensuite.
  sujet_id uuid references public.sujets (id) on delete set null,
  source_url text,
  langue_source text not null default 'fr',
  musique_url text,
  musique_titre text,
  musique_plateforme text,
  -- Stats brutes de la source (cold-start scoring).
  vues_source integer,
  pertinence_score integer,
  pertinence_raison text,
  statut public.contenu_statut not null default 'brouillon',
  -- Pipeline d'import pré-calculé (à froid).
  import_statut text not null default 'pending'
    check (import_statut in ('pending', 'running', 'done', 'failed')),
  import_etape text,
  import_erreur text,
  -- Variations : lignée + profondeur (0 = original, max réglable, défaut 2).
  parent_id uuid references public.contenus (id) on delete set null,
  profondeur integer not null default 0 check (profondeur >= 0),
  created_at timestamptz not null default now()
);

create unique index if not exists contenus_source_url_uidx
  on public.contenus (source_url) where source_url is not null;
create unique index if not exists contenus_sujet_id_uidx
  on public.contenus (sujet_id) where sujet_id is not null;
create index if not exists contenus_statut_idx on public.contenus (statut, created_at desc);
create index if not exists contenus_parent_idx on public.contenus (parent_id);
create index if not exists contenus_reference_idx on public.contenus (compte_reference_id);

-- FK différée : contenu_labels → contenus
do $$ begin
  alter table public.contenu_labels
    add constraint contenu_labels_contenu_id_fkey
    foreign key (contenu_id) references public.contenus (id) on delete cascade;
exception when duplicate_object then null;
end $$;

create index if not exists contenu_labels_label_idx on public.contenu_labels (label_id);

-- ---------------------------------------------------------------------------
-- Contenu × langue : texte traduit, placement Sophia, score
-- ---------------------------------------------------------------------------
create table if not exists public.contenu_langues (
  id uuid primary key default gen_random_uuid(),
  contenu_id uuid not null references public.contenus (id) on delete cascade,
  langue text not null,
  -- Deck traduit + flags Sophia.
  -- [{ position, texte_overlay, position_sophia }]
  slides jsonb not null default '[]',
  -- Score régularisé 0..100 (cold-start puis MAJ par passages).
  score double precision not null default 50,
  nb_passages integer not null default 0,
  score_maj_at timestamptz,
  created_at timestamptz not null default now(),
  unique (contenu_id, langue)
);

create index if not exists contenu_langues_score_idx
  on public.contenu_langues (langue, score desc);

-- ---------------------------------------------------------------------------
-- Passages : historique d'assignation / publication (alimente le scoring)
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.passage_statut as enum (
    'brouillon', 'assigne', 'valide_par_poster', 'publie'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.passages (
  id uuid primary key default gen_random_uuid(),
  contenu_id uuid not null references public.contenus (id) on delete cascade,
  compte_id uuid not null references public.comptes (id) on delete cascade,
  langue text not null,
  date_publication_prevue date,
  statut public.passage_statut not null default 'brouillon',
  -- Snapshot au moment de l'assignation (le contenu peut évoluer ensuite).
  slides jsonb not null default '[]',
  musique_url text,
  musique_titre text,
  musique_plateforme text,
  hashtags text,
  publie_at timestamptz,
  publie_url text,
  -- Dernières stats connues (relevé Apify / lien collé).
  vues integer,
  likes integer,
  commentaires integer,
  partages integer,
  stats_maj_at timestamptz,
  -- Trace migration étape 2 (posts → passages).
  post_id uuid references public.posts (id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index if not exists passages_post_id_uidx
  on public.passages (post_id) where post_id is not null;
create index if not exists passages_compte_date_idx
  on public.passages (compte_id, date_publication_prevue);
create index if not exists passages_contenu_idx on public.passages (contenu_id, langue);
create index if not exists passages_statut_idx on public.passages (statut, date_publication_prevue);
-- Éligibilité « jamais posté » = requête runtime ; le fallback autorise
-- de republier le moins récent, donc pas d'unicité compte×contenu.
create index if not exists passages_compte_contenu_idx
  on public.passages (compte_id, contenu_id);

-- ---------------------------------------------------------------------------
-- Score de compte (EWMA de la « forme »)
-- ---------------------------------------------------------------------------
alter table public.comptes
  add column if not exists score double precision not null default 50,
  add column if not exists score_maj_at timestamptz;

-- ---------------------------------------------------------------------------
-- Lien optionnel media → contenu (biblio partagée, sans casser l'existant)
-- ---------------------------------------------------------------------------
alter table public.media_library
  add column if not exists contenu_id uuid references public.contenus (id) on delete set null;

create index if not exists media_library_contenu_idx
  on public.media_library (contenu_id)
  where contenu_id is not null;

-- ---------------------------------------------------------------------------
-- Réglages v-next : scoring + paiement (éditables Pilotage / Réglages)
-- ---------------------------------------------------------------------------
insert into public.reglages (cle, valeur) values
  ('scoring', '{
    "ewma_alpha": 0.3,
    "regularisation_k": 5,
    "transfert_inter_langue": 0.15,
    "top_k": 5,
    "temperature": 0.7,
    "saturation_jours": 7,
    "saturation_penalite": 0.2,
    "variation_seuil_score": 80,
    "variation_min_passages": 3,
    "variation_age_jours": 5,
    "variation_profondeur_max": 2,
    "score_prior": 50,
    "pertinence_seuil": 50
  }'::jsonb),
  ('paiement', '{
    "tarif_base_mensuel": 0,
    "tarif_par_post_jour": 0
  }'::jsonb)
on conflict (cle) do nothing;

-- ---------------------------------------------------------------------------
-- RLS — même esprit que sujets/posts : pool admin-only ; passages visibles
-- par le poster propriétaire du compte.
-- ---------------------------------------------------------------------------
alter table public.labels enable row level security;
alter table public.contenu_labels enable row level security;
alter table public.compte_labels enable row level security;
alter table public.compte_reference_labels enable row level security;
alter table public.contenus enable row level security;
alter table public.contenu_langues enable row level security;
alter table public.passages enable row level security;

-- Labels : lecture authentifiée (UI poster pourra filtrer plus tard), écriture admin.
create policy labels_read on public.labels
  for select to authenticated using (true);
create policy labels_admin on public.labels
  for all using (public.is_admin()) with check (public.is_admin());

create policy contenu_labels_admin on public.contenu_labels
  for all using (public.is_admin()) with check (public.is_admin());

create policy compte_reference_labels_admin on public.compte_reference_labels
  for all using (public.is_admin()) with check (public.is_admin());

-- Labels d'un compte : le poster voit les siens ; admin tout.
create policy compte_labels_select on public.compte_labels
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.comptes c
      where c.id = compte_id and c.poster_id = auth.uid()
    )
  );
create policy compte_labels_admin on public.compte_labels
  for all using (public.is_admin()) with check (public.is_admin());

-- Contenu / scores : admin only (ne pas exposer la source aux posters).
create policy contenus_admin on public.contenus
  for all using (public.is_admin()) with check (public.is_admin());
create policy contenu_langues_admin on public.contenu_langues
  for all using (public.is_admin()) with check (public.is_admin());

-- Passages : miroir des posts (lecture/maj poster sur son compte).
create policy passages_select on public.passages
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.comptes c
      where c.id = compte_id and c.poster_id = auth.uid()
    )
  );
create policy passages_update on public.passages
  for update using (
    public.is_admin()
    or exists (
      select 1 from public.comptes c
      where c.id = compte_id and c.poster_id = auth.uid()
    )
  );
create policy passages_admin on public.passages
  for all using (public.is_admin()) with check (public.is_admin());

grant select, insert, update, delete on public.labels to authenticated;
grant select, insert, update, delete on public.contenu_labels to authenticated;
grant select, insert, update, delete on public.compte_labels to authenticated;
grant select, insert, update, delete on public.compte_reference_labels to authenticated;
grant select, insert, update, delete on public.contenus to authenticated;
grant select, insert, update, delete on public.contenu_langues to authenticated;
grant select, insert, update, delete on public.passages to authenticated;

grant all on public.labels to service_role;
grant all on public.contenu_labels to service_role;
grant all on public.compte_labels to service_role;
grant all on public.compte_reference_labels to service_role;
grant all on public.contenus to service_role;
grant all on public.contenu_langues to service_role;
grant all on public.passages to service_role;
