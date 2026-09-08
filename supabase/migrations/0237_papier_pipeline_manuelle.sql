-- Récupération de schéma, pas une nouveauté.
--
-- Ces colonnes et contraintes ont été appliquées sur la base de prod le
-- 31/08/2026 (`0215_papier_pipeline_manuelle`) sans qu'aucun fichier n'atterrisse
-- dans ce dépôt : un `db push` depuis un dépôt frais reconstruisait donc une
-- base où `papier-cm` (v11 en prod) plante. Le SQL ci-dessous est relu depuis
-- `supabase_migrations.schema_migrations` et rejoué à l'identique — idempotent,
-- il ne change rien sur la base actuelle.
--
-- ⚠️ Seul le schéma est récupérable ici. Le code TypeScript du pipeline papier
-- manuel n'est pas dans ce dépôt : la fonction `papier-cm` déployée embarque
-- sept modules `_shared/papier_*` qui n'existent nulle part ici. Ne pas
-- redéployer `papier-cm` depuis ce dépôt, ce serait une régression.

alter table public.papier_masters
  add column if not exists topic_categorie text,
  add column if not exists pipeline_mode text not null default 'auto',
  add column if not exists pipeline_hold text,
  add column if not exists duree_cible_sec integer,
  add column if not exists annule boolean not null default false;

alter table public.papier_masters
  drop constraint if exists papier_masters_statut_check;

alter table public.papier_masters
  add constraint papier_masters_statut_check
  check (statut in (
    'draft', 'generating', 'ready', 'published',
    'failed', 'archived', 'stopped'
  ));

alter table public.papier_masters
  drop constraint if exists papier_masters_pipeline_mode_check;

alter table public.papier_masters
  add constraint papier_masters_pipeline_mode_check
  check (pipeline_mode in ('auto', 'manuel'));

alter table public.papier_masters
  drop constraint if exists papier_masters_pipeline_hold_check;

alter table public.papier_masters
  add constraint papier_masters_pipeline_hold_check
  check (
    pipeline_hold is null
    or pipeline_hold in ('topic', 'script')
  );
