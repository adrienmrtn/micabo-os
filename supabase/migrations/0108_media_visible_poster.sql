-- Le poster doit pouvoir lire les médias de ses propres slides.
--
-- La règle existante n'ouvrait `media_library` que sur `compte_id`, or les
-- visuels sortis du pipeline sont rattachés au compte de RÉFÉRENCE, pas au
-- compte de publication : `compte_id` y est nul. Résultat, la jointure
-- `media_library(url)` renvoyait null et aucune photo nettoyée n'apparaissait
-- côté poster — seul le visuel d'origine, stocké en clair sur la slide,
-- s'affichait.
--
-- On ouvre donc l'accès par l'usage : un média est lisible s'il est posé sur
-- la slide d'un post assigné à ce poster. Les policies se cumulent en OU, donc
-- rien de ce qui était déjà permis ne change.
--
-- La ligne expose `compte_reference_id`, mais ce n'est qu'un UUID : la table
-- `comptes_reference` reste interdite au poster, il ne peut donc pas remonter
-- au compte source.

drop policy if exists media_select_slides on public.media_library;
create policy media_select_slides on public.media_library
  for select using (
    exists (
      select 1
      from public.post_slides ps
        join public.posts p on p.id = ps.post_id
        join public.comptes c on c.id = p.compte_id
      where ps.media_id = media_library.id
        and c.poster_id = auth.uid()
    )
  );
