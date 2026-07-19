-- Sélection des slideshows et intégration native de Sophia.
--
-- Deux changements de fond :
--
-- 1. Tous les slideshows d'un compte ne méritent pas d'être copiés. On les
--    note avant de payer nettoyage et traduction, et les recalés partent en
--    'rejected' — visibles dans l'admin, rattrapables à la main.
--
-- 2. Sophia ne s'ajoute plus en fin de slideshow : elle remplace l'un des
--    conseils existants. On garde le texte d'origine pour pouvoir revenir en
--    arrière et pour que l'admin voie ce qui a été substitué.

alter table public.slideshows
  drop constraint if exists slideshows_auto_pipeline_status_check;

alter table public.slideshows
  add constraint slideshows_auto_pipeline_status_check
  check (auto_pipeline_status in ('pending', 'running', 'done', 'failed', 'rejected'));

alter table public.slideshows
  add column if not exists relevance_score integer,
  add column if not exists relevance_reason text;

-- Marque la slide dont le conseil a été remplacé par Sophia.
alter table public.slideshow_frames
  add column if not exists is_sophia_slide boolean not null default false;

-- Le texte d'avant substitution, pour l'affichage admin et le retour arrière.
alter table public.sophia_variants
  add column if not exists original_text text;

create index if not exists slideshows_relevance_idx
  on public.slideshows (auto_pipeline_status, relevance_score desc);
