-- Stockage des visuels et audio de slideshows.
--
-- Bucket public en lecture : la livraison mobile se fait via des liens sans
-- authentification (m/:token), et les URLs contiennent un uuid non devinable.
-- L'écriture reste réservée au service_role, donc aux Edge Functions du
-- pipeline — aucun client ne peut y déposer quoi que ce soit.

insert into storage.buckets (id, name, public)
values ('slideshow-media', 'slideshow-media', true)
on conflict (id) do nothing;

drop policy if exists "slideshow_media_public_read" on storage.objects;
create policy "slideshow_media_public_read" on storage.objects
  for select
  using (bucket_id = 'slideshow-media');
