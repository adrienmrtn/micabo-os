-- Le hiring manager voit (lecture seule) les posts de SES créateurs, pour la
-- visu calendrier de son espace. Limité à ses créateurs (profiles.manager_id).
create policy posts_select_hiring on public.posts
  for select
  using (
    is_hiring_manager()
    and exists (
      select 1
      from public.comptes c
      join public.profiles pr on pr.id = c.poster_id
      where c.id = posts.compte_id and pr.manager_id = auth.uid()
    )
  );
