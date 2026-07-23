-- Documents éditables par l'admin, lus par les managers et/ou les posters :
-- guides (« Guide du manager », « Comment onboarder des créateurs ? ») et FAQ,
-- avec un contenu différent selon l'audience.
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  cle text not null unique,
  titre text not null,
  contenu text not null default '',
  audience text not null default 'manager' check (audience in ('manager','poster','all')),
  ordre int not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.documents enable row level security;

drop policy if exists documents_admin on public.documents;
create policy documents_admin on public.documents
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists documents_read_manager on public.documents;
create policy documents_read_manager on public.documents
  for select using (audience in ('manager','all') and public.is_hiring_manager());

drop policy if exists documents_read_poster on public.documents;
create policy documents_read_poster on public.documents
  for select using (
    audience in ('poster','all')
    and exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role = 'poster')
  );

grant select on public.documents to authenticated;
grant insert, update, delete on public.documents to authenticated;

-- Documents de départ (contenu à compléter par l'admin).
insert into public.documents (cle, titre, audience, ordre, contenu) values
  ('guide_manager', 'Guide du manager', 'manager', 1,
   'Bienvenue sur Sophia. Ce guide explique ton espace de manager. (À compléter par l''admin.)'),
  ('onboarding', 'Comment onboarder des créateurs ?', 'manager', 2,
   'Étapes pour recruter et lancer un nouveau créateur. (À compléter par l''admin.)'),
  ('faq_manager', 'FAQ manager', 'manager', 3,
   'Questions fréquentes des managers. (À compléter par l''admin.)'),
  ('guide_poster', 'Guide du créateur', 'poster', 1,
   'Bienvenue ! Ce guide explique comment poster ton contenu du jour. (À compléter par l''admin.)'),
  ('faq_poster', 'FAQ créateur', 'poster', 2,
   'Questions fréquentes des créateurs. (À compléter par l''admin.)')
on conflict (cle) do nothing;
