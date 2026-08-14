-- Assistant interne : l'admin nourrit le contexte (snippets + les documents
-- guides/FAQ déjà en base). Les questions de tous les rôles (admin, HM, créateur)
-- sont stockées pour que l'admin complète le contexte là où ça manque.

create table if not exists public.chatbot_contexte (
  id uuid primary key default gen_random_uuid(),
  titre text not null,
  contenu text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chatbot_questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  role text not null check (role in ('admin', 'poster', 'hiring_manager')),
  question text not null,
  reponse text,
  created_at timestamptz not null default now()
);

create index if not exists chatbot_questions_created_at_idx
  on public.chatbot_questions (created_at desc);

alter table public.chatbot_contexte enable row level security;
alter table public.chatbot_questions enable row level security;

drop policy if exists chatbot_contexte_admin on public.chatbot_contexte;
create policy chatbot_contexte_admin on public.chatbot_contexte
  for all using (public.is_admin()) with check (public.is_admin());

-- Lecture admin seulement. L'écriture passe par l'Edge Function (service_role).
drop policy if exists chatbot_questions_admin on public.chatbot_questions;
create policy chatbot_questions_admin on public.chatbot_questions
  for select using (public.is_admin());

grant select, insert, update, delete on public.chatbot_contexte to authenticated;
grant select on public.chatbot_questions to authenticated;
