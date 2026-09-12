-- La bibliothèque tombait en « canceling statement due to statement timeout ».
--
-- Ce n'est pas la qualification (0253) : c'est la policy `media_select_slides`
-- que 0252 a réécrite pour que le poster voie AUSSI l'image brûlée.
--
--   exists (select 1 from post_slides ps … where
--     (ps.media_id = media_library.id or ps.burned_media_id = media_library.id)
--     and c.poster_id = auth.uid())
--
-- Deux fautes dans ces trois lignes :
--
-- 1. le `or` est DANS la condition corrélée. Un `or` entre deux colonnes
--    différentes interdit tout accès par index : Postgres ne peut plus chercher
--    « la slide qui porte ce media_id », il parcourt la table entière ;
-- 2. il n'y a jamais eu d'index sur `post_slides.media_id`. L'ancienne policy
--    balayait donc déjà les 964 slides pour CHACUN des 977 médias — un million
--    de paires de lignes, ~3 s. Le `or` a doublé la note, et 6 s passent
--    au-dessus du `statement_timeout` : la page ne rend plus rien.
--
-- Mesuré avant : 5 951 ms sur `select * from media_library where storage_path
-- like 'propre/%' limit 200`, dont 5 750 ms passés dans 977 balayages de
-- `comptes`. Le reste de l'OS suivait, parce que `media_library` est lue
-- partout.
--
-- Correctif en trois temps : les index qui manquaient, la policy coupée en deux
-- (deux policies permissives sont de toute façon OR-ées — même droit, mais
-- chaque moitié redevient une égalité indexable), et `auth.uid()` enveloppé
-- dans un `select` pour être évalué UNE fois au lieu d'une fois par ligne.
--
-- Aucun cron n'est planifié ici. Conforme à AGENTS.md.

-- ---------------------------------------------------------------------------
-- Les index qui manquaient
-- ---------------------------------------------------------------------------
create index if not exists post_slides_media_idx
  on public.post_slides (media_id)
  where media_id is not null;

create index if not exists post_slides_burned_media_idx
  on public.post_slides (burned_media_id)
  where burned_media_id is not null;

-- ---------------------------------------------------------------------------
-- La policy, coupée en deux
-- ---------------------------------------------------------------------------
drop policy if exists media_select_slides on public.media_library;

comment on table public.media_library is
  'Visuels nettoyés. RLS : ne jamais mettre de OR entre deux colonnes dans une policy corrélée — cela interdit l''index et la table se fait balayer une fois par ligne lue.';

create policy media_select_slide_propre on public.media_library
  for select using (
    exists (
      select 1
      from public.post_slides ps
        join public.posts p on p.id = ps.post_id
        join public.comptes c on c.id = p.compte_id
      where ps.media_id = media_library.id
        and c.poster_id = (select auth.uid())
    )
  );

create policy media_select_slide_burned on public.media_library
  for select using (
    exists (
      select 1
      from public.post_slides ps
        join public.posts p on p.id = ps.post_id
        join public.comptes c on c.id = p.compte_id
      where ps.burned_media_id = media_library.id
        and c.poster_id = (select auth.uid())
    )
  );

-- Même traitement pour la policy hiring : l'égalité était déjà bonne, il lui
-- manquait l'index (créé ci-dessus) et le `select` autour d'`auth.uid()`.
drop policy if exists media_select_hiring on public.media_library;
create policy media_select_hiring on public.media_library
  for select using (
    public.is_hiring_manager()
    and exists (
      select 1
      from public.post_slides ps
        join public.posts p on p.id = ps.post_id
        join public.comptes c on c.id = p.compte_id
        join public.profiles pr on pr.id = c.poster_id
      where ps.media_id = media_library.id
        and pr.manager_id = (select auth.uid())
    )
  );

analyze public.post_slides;
analyze public.media_library;
