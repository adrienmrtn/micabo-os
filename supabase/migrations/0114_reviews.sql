-- Reviews : un retour écrit par l'admin à un poster, montré en POP-UP à la
-- prochaine connexion du poster. `seen_at` passe à now() quand il l'a vu.
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  poster_id uuid not null references auth.users(id) on delete cascade,
  admin_id uuid references auth.users(id) on delete set null,
  body text not null,
  note int,
  created_at timestamptz not null default now(),
  seen_at timestamptz
);
create index if not exists reviews_poster_idx on public.reviews(poster_id, seen_at);

alter table public.reviews enable row level security;

-- Le poster lit ses propres reviews ; l'admin lit tout.
create policy reviews_select on public.reviews
  for select using (poster_id = auth.uid() or public.is_admin());
-- Le poster peut marquer sa review comme vue (update seen_at).
create policy reviews_poster_update on public.reviews
  for update using (poster_id = auth.uid()) with check (poster_id = auth.uid());
-- L'admin écrit et gère tout.
create policy reviews_admin_all on public.reviews
  for all using (public.is_admin()) with check (public.is_admin());
