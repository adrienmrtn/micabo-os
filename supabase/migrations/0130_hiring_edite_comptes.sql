-- Le hiring manager peut MODIFIER l'identité TikTok des comptes de SES créateurs
-- (pseudo, nom, bio, avatar) — il les a recrutés, il doit pouvoir ajuster. En
-- écriture, limité à ses propres créateurs (profiles.manager_id = lui). L'UI HM
-- n'expose que les champs d'identité ; la source/les ratios restent côté admin.
create policy comptes_update_hiring on public.comptes
  for update
  using (
    is_hiring_manager()
    and exists (
      select 1 from public.profiles pr
      where pr.id = comptes.poster_id and pr.manager_id = auth.uid()
    )
  )
  with check (
    is_hiring_manager()
    and exists (
      select 1 from public.profiles pr
      where pr.id = comptes.poster_id and pr.manager_id = auth.uid()
    )
  );
