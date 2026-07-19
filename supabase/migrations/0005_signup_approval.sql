-- Validation des inscriptions par un admin.
--
-- L'app est destinée à être publiée : l'inscription reste ouverte, mais un
-- compte fraîchement créé n'a accès à rien tant qu'un admin ne l'a pas activé
-- depuis Admin → Utilisateurs. Sans ça, quiconque tombe sur l'URL entre.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_email constant text := 'maximilienkender@gmail.com';
  is_owner boolean;
begin
  is_owner := new.email = owner_email;

  insert into public.profiles (id, display_name, is_active)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
      split_part(new.email, '@', 1)
    ),
    -- Le propriétaire ne peut pas s'auto-valider : il est actif d'office.
    is_owner
  )
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, case when is_owner then 'admin' else 'poster' end)
  on conflict (user_id, role) do nothing;

  return new;
end;
$$;

-- Les comptes déjà en place restent actifs : la règle ne vaut que pour la suite.
update public.profiles set is_active = true where is_active is not false;
