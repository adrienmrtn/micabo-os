-- Le hiring manager voit l'IDENTITÉ TikTok (pseudo, nom, bio, avatar) des comptes
-- de SES créateurs — il les a recrutés, il doit pouvoir la vérifier. En lecture
-- seule et limité à ses propres créateurs (profiles.manager_id = lui). Les autres
-- policies (poster: le sien ; admin: tout) restent inchangées.
create policy comptes_select_hiring on public.comptes
  for select
  using (
    is_hiring_manager()
    and exists (
      select 1 from public.profiles pr
      where pr.id = comptes.poster_id
        and pr.manager_id = auth.uid()
    )
  );
