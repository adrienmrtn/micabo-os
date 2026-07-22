-- Recruteur (hiring manager) qui possède ce poster : renseigné automatiquement
-- quand un recruteur crée un poster, pour grouper les créateurs par recruteur
-- dans la vue admin (façon Calyra). Null = créé par l'admin, sans recruteur.
alter table public.profiles
  add column if not exists manager_id uuid references auth.users(id) on delete set null;
create index if not exists profiles_manager_id_idx on public.profiles(manager_id);
