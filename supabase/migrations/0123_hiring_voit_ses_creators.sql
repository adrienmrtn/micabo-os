-- Un hiring manager ne doit voir QUE les créateurs qui lui sont assignés
-- (profiles.manager_id = lui) et son propre profil — pas tout le monde.
drop policy if exists profiles_select_hiring on public.profiles;
create policy profiles_select_hiring on public.profiles
  for select using (
    public.is_hiring_manager() and (id = auth.uid() or manager_id = auth.uid())
  );
