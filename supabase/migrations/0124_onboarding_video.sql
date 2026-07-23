-- Vidéo d'onboarding : à sa PREMIÈRE connexion, le poster voit un pop-up avec
-- une vidéo qui explique comment poster. `onboarding_vu_at` mémorise qu'il l'a
-- vue (le pop-up ne réapparaît plus ensuite).
alter table public.profiles
  add column if not exists onboarding_vu_at timestamptz;

-- Le poster marque SA propre vidéo comme vue (RPC restreinte à sa ligne).
create or replace function public.marquer_onboarding_vu()
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles set onboarding_vu_at = now() where id = auth.uid();
$$;

grant execute on function public.marquer_onboarding_vu() to authenticated;
