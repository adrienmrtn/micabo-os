-- Le trigger d'inscription échouait sur un défaut de typage : le `case ... end`
-- produit du text, que Postgres ne convertit pas implicitement vers l'enum
-- app_role dans un INSERT plpgsql. Toute création de compte partait donc en 500.
--
-- Le bug était latent : les deux comptes existants avaient été insérés par du
-- SQL explicitement casté, jamais par ce chemin.

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  owner_email constant text := 'maximilienkender@gmail.com';
  is_owner boolean;
  role_attribue public.app_role;
begin
  is_owner := new.email = owner_email;
  role_attribue := case when is_owner then 'admin' else 'poster' end::public.app_role;

  insert into public.profiles (id, email, prenom, is_active, must_change_password)
  values (
    new.id,
    new.email,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'prenom'), ''), split_part(new.email, '@', 1)),
    -- Le propriétaire est actif d'office ; un compte créé par l'admin est
    -- activé juste après par la fonction manage-users.
    is_owner,
    not is_owner
  )
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, role_attribue)
  on conflict (user_id, role) do nothing;

  return new;
end;
$$;
