-- Rôle « hiring manager » : un recruteur dont le SEUL pouvoir est de créer des
-- posters. Il choisit la langue du poster ; le reste (compte de référence,
-- persona nom/bio/avatar) est automatisé par l'IA dans la fonction manage-users.
--
-- NB : `alter type ... add value` doit être committé AVANT toute utilisation de
-- la valeur. On l'exécute donc en premier, isolément (voir la note de
-- déploiement). Le reste de ce fichier suppose la valeur déjà présente.

alter type public.app_role add value if not exists 'hiring_manager';

-- Nationalité du hiring manager (posée par l'admin à l'attribution du rôle).
-- Sert de langue par défaut à la création d'un poster. Colonne inoffensive pour
-- les autres profils.
alter table public.profiles add column if not exists nationalite text;

-- Vrai si l'utilisateur courant est hiring manager. `security definer` pour
-- lire user_roles sans buter sur la RLS de la table (même schéma que is_admin).
create or replace function public.is_hiring_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_role(auth.uid(), 'hiring_manager');
$$;

grant execute on function public.is_hiring_manager() to authenticated, service_role;

-- Le hiring manager voit les profils et les rôles (pour lister les posters
-- qu'il gère) et les comptes de référence (pour proposer les langues
-- disponibles). Lecture seule : il n'écrit rien directement — la création passe
-- par l'Edge Function manage-users, en service_role.
create policy profiles_select_hiring on public.profiles
  for select using (public.is_hiring_manager());

create policy roles_select_hiring on public.user_roles
  for select using (public.is_hiring_manager());

create policy reference_select_hiring on public.comptes_reference
  for select using (public.is_hiring_manager());
