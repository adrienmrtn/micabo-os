-- Le DM suit le recrutement de SES hiring managers : il doit voir les
-- créateurs rattachés à ces HM (manager_id = HM, et HM.manager_id = DM)
-- ainsi que leurs comptes (warmup, @ TikTok). Lecture seule.

create or replace function public.est_createur_equipe_dm(profil_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles createur
    join public.profiles hm on hm.id = createur.manager_id
    where createur.id = profil_id
      and hm.manager_id = auth.uid()
  );
$$;

grant execute on function public.est_createur_equipe_dm(uuid) to authenticated, service_role;

drop policy if exists profiles_select_directing_equipe on public.profiles;
create policy profiles_select_directing_equipe on public.profiles
  for select using (
    public.is_directing_manager()
    and public.est_createur_equipe_dm(id)
  );

drop policy if exists comptes_select_directing_equipe on public.comptes;
create policy comptes_select_directing_equipe on public.comptes
  for select using (
    public.is_directing_manager()
    and public.est_createur_equipe_dm(poster_id)
  );
