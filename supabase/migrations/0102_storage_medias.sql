-- Bucket unique pour tous les visuels : bruts extraits, nettoyés, générés.
-- Public en lecture (la livraison mobile se fait par lien sans authentification,
-- les chemins contiennent des identifiants non devinables). L'écriture reste au
-- service_role, donc aux Edge Functions et à l'admin.

insert into storage.buckets (id, name, public)
values ('medias', 'medias', true)
on conflict (id) do nothing;

drop policy if exists medias_lecture_publique on storage.objects;
create policy medias_lecture_publique on storage.objects
  for select using (bucket_id = 'medias');

-- L'admin peut déposer ses propres visuels dans la bibliothèque.
drop policy if exists medias_ecriture_admin on storage.objects;
create policy medias_ecriture_admin on storage.objects
  for insert to authenticated
  with check (bucket_id = 'medias' and public.is_admin());

drop policy if exists medias_suppression_admin on storage.objects;
create policy medias_suppression_admin on storage.objects
  for delete to authenticated
  using (bucket_id = 'medias' and public.is_admin());
