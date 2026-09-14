-- File de validation des slideshows, formats, et bibliothèque de blocs PNG
-- (14/09/2026).
--
-- ## La file
--
-- L'import garde exactement le même pipeline automatique (OCR, pertinence,
-- note /100 et tier d'entrée, nettoyage, format, caption). Ce qui change est
-- sa PORTE DE SORTIE : au lieu de passer `statut = 'valide'` — donc d'entrer
-- direct dans le pool d'assignation — il s'arrête sur `statut = 'brouillon'`
-- avec `import_statut = 'done'`. Cette paire, et elle seule, veut dire
-- « en file, en attente d'un admin ».
--
-- Pas de nouvelle valeur d'enum : `contenu_statut` reste
-- (brouillon, valide, rejete), et `assignation_contenu.ts` filtre déjà sur
-- `statut = 'valide'`. Rien ne fuit dans le pool sans validation.
--
-- Un slideshow validé reste réouvrable : `remettre_en_file` le repasse en
-- brouillon. Les passages déjà créés ne bougent pas — un créateur qui a un
-- post pour aujourd'hui le garde, même si son slideshow repart en file.
--
-- Le refus est une SUPPRESSION DURE, à la main, jamais une échéance
-- automatique : `supprimer_contenu` existe déjà côté front et cascade sur les
-- passages et les posts.
--
-- ## Les formats
--
-- Liste globale, éditée dans les Réglages. Un slideshow porte au plus un
-- format, facultatif, et ce format **ne joue sur rien** dans l'assignation :
-- ni filtre, ni équilibrage, ni départage. Il n'existe que pour croiser
-- label × format dans les statistiques.
--
-- ## Les blocs PNG
--
-- Bibliothèque globale de calques qu'un admin pose sur une image dans la file.
-- Le fichier vit dans le bucket `medias`, sous `blocs/<id>.<ext>`.

-- ---------------------------------------------------------------------------
-- 1. Formats
-- ---------------------------------------------------------------------------
create table if not exists public.formats (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  slug text not null unique,
  couleur text,
  description text,
  actif boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.formats is
  'Formats éditoriaux d''un slideshow. Purement descriptif : aucune influence sur l''assignation, seulement sur les statistiques (croisement label × format).';

alter table public.contenus
  add column if not exists format_id uuid references public.formats (id) on delete set null;

comment on column public.contenus.format_id is
  'Format éditorial, facultatif, posé dans la file de validation. Reclassable après coup. Ne joue sur rien dans l''assignation.';

create index if not exists contenus_format_idx on public.contenus (format_id)
  where format_id is not null;

alter table public.formats enable row level security;

drop policy if exists formats_admin on public.formats;
create policy formats_admin on public.formats
  for all using (public.is_admin()) with check (public.is_admin());

-- Les stats croisées sont lues par l'admin seulement, mais un créateur peut
-- voir le nom du format de son propre post : lecture ouverte aux connectés.
drop policy if exists formats_lecture on public.formats;
create policy formats_lecture on public.formats
  for select using (auth.uid() is not null);

-- ---------------------------------------------------------------------------
-- 2. Bibliothèque de blocs PNG
-- ---------------------------------------------------------------------------
create table if not exists public.blocs_png (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  storage_path text not null unique,
  url text not null,
  largeur integer,
  hauteur integer,
  created_at timestamptz not null default now()
);

comment on table public.blocs_png is
  'Calques PNG pré-enregistrés, posés sur une image depuis la file de validation. Bibliothèque globale (pas par label, pas par format).';

create index if not exists blocs_png_recents_idx on public.blocs_png (created_at desc);

alter table public.blocs_png enable row level security;

drop policy if exists blocs_png_admin on public.blocs_png;
create policy blocs_png_admin on public.blocs_png
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- 3. Traces de validation sur le contenu
--
-- `valide_par` est un uuid NU, sans clé étrangère vers `profiles` : une
-- deuxième FK vers la même cible casse l'embed PostgREST de TOUT l'écran
-- (0255, 12/09/2026).
-- ---------------------------------------------------------------------------
alter table public.contenus
  add column if not exists valide_at timestamptz,
  add column if not exists valide_par uuid,
  add column if not exists file_note text;

comment on column public.contenus.valide_at is
  'Sortie de file : quand un admin a validé ce slideshow.';
comment on column public.contenus.valide_par is
  'Admin qui a validé. uuid nu, sans FK (voir 0255).';
comment on column public.contenus.file_note is
  'Note libre d''un admin pendant le passage en file.';

-- File = pipeline fini, pas encore validé. Index partiel : la file est petite
-- devant le stock.
create index if not exists contenus_file_validation_idx
  on public.contenus (created_at desc)
  where statut = 'brouillon' and import_statut = 'done';

-- ---------------------------------------------------------------------------
-- 4. Reprise du stock : tout le validé repart en file
--
-- Les 165 slideshows validés retournent en attente. Rien ne change pour les
-- créateurs : les passages et les posts déjà créés portent leur propre copie
-- des slides, et ne lisent jamais `contenus.statut`. Seul le POOL des
-- prochaines assignations se vide, le temps du tri.
--
-- Les rejetés (`statut = 'rejete'`) restent rejetés : ils ont déjà été jugés.
-- ---------------------------------------------------------------------------
update public.contenus
set statut = 'brouillon'
where statut = 'valide'
  and import_statut = 'done';

notify pgrst, 'reload schema';
