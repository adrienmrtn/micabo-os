-- File admin « valider passage du jour » : un post validé sort de la pile jusqu'à demain.

create table if not exists public.validation_jour_faits (
  post_id uuid not null references public.posts (id) on delete cascade,
  jour date not null,
  admin_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (post_id, jour)
);

create index if not exists validation_jour_faits_jour_idx
  on public.validation_jour_faits (jour);

alter table public.validation_jour_faits enable row level security;

drop policy if exists validation_jour_faits_admin on public.validation_jour_faits;
create policy validation_jour_faits_admin on public.validation_jour_faits
  for all using (public.is_admin()) with check (public.is_admin());

grant select, insert, update, delete on public.validation_jour_faits to authenticated;

notify pgrst, 'reload schema';
