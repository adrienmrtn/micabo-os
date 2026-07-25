-- Le hiring manager peut voir le CONTENU des posts de SES créateurs (aperçu) :
-- les slides + les images référencées. Lecture seule, limité à ses créateurs.
create policy post_slides_select_hiring on public.post_slides
  for select using (
    is_hiring_manager() and exists (
      select 1 from public.posts p
      join public.comptes c on c.id = p.compte_id
      join public.profiles pr on pr.id = c.poster_id
      where p.id = post_slides.post_id and pr.manager_id = auth.uid()
    )
  );

create policy media_select_hiring on public.media_library
  for select using (
    is_hiring_manager() and exists (
      select 1 from public.post_slides ps
      join public.posts p on p.id = ps.post_id
      join public.comptes c on c.id = p.compte_id
      join public.profiles pr on pr.id = c.poster_id
      where ps.media_id = media_library.id and pr.manager_id = auth.uid()
    )
  );
