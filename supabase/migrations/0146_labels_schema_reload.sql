-- PostgREST ne voyait pas toujours les tables labels après 0141
-- (PGRST205 / liste vide côté UI). On force le reload + on ajoute
-- une lecture authentifiée sur les ponts M2M pour que le picker
-- puisse charger les assignations sans ambiguïté.

notify pgrst, 'reload schema';

-- Lecture des assignations : tout user connecté (écriture reste admin).
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'contenu_labels'
      and policyname = 'contenu_labels_read'
  ) then
    create policy contenu_labels_read on public.contenu_labels
      for select to authenticated using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'compte_reference_labels'
      and policyname = 'compte_reference_labels_read'
  ) then
    create policy compte_reference_labels_read on public.compte_reference_labels
      for select to authenticated using (true);
  end if;
end $$;
