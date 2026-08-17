-- Directing manager = tous les droits HM, plus création/paramétrage de HM
-- et édition des documents d’onboarding (audience manager / all).
-- Pas d’accès créatif (pas is_admin).

create or replace function public.is_directing_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_role(auth.uid(), 'directing_manager');
$$;

grant execute on function public.is_directing_manager() to authenticated, service_role;

-- Tous les policies HM existants s’appliquent aussi au DM.
create or replace function public.is_hiring_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_role(auth.uid(), 'hiring_manager')
      or public.has_role(auth.uid(), 'directing_manager');
$$;

-- Configurer un HM créé par le DM (langues, flags) — pas les profils des autres équipes.
drop policy if exists profiles_update_directing on public.profiles;
create policy profiles_update_directing on public.profiles
  for update using (
    public.is_directing_manager()
    and (id = auth.uid() or manager_id = auth.uid())
  )
  with check (
    public.is_directing_manager()
    and (id = auth.uid() or manager_id = auth.uid())
  );

-- Labels UGC VIDEO des HM que le DM a créés (manager_id = lui).
drop policy if exists hm_ugc_video_labels_directing on public.hm_ugc_video_labels;
create policy hm_ugc_video_labels_directing on public.hm_ugc_video_labels
  for all to authenticated
  using (
    public.is_directing_manager()
    and exists (
      select 1 from public.profiles p
      where p.id = hm_ugc_video_labels.profile_id
        and (p.id = auth.uid() or p.manager_id = auth.uid())
    )
  )
  with check (
    public.is_directing_manager()
    and exists (
      select 1 from public.profiles p
      where p.id = hm_ugc_video_labels.profile_id
        and (p.id = auth.uid() or p.manager_id = auth.uid())
    )
  );

-- Documents d’onboarding / guides manager — pas les docs créateurs seuls.
drop policy if exists documents_directing_write on public.documents;
create policy documents_directing_write on public.documents
  for update using (
    public.is_directing_manager()
    and audience in ('manager', 'all')
  )
  with check (
    public.is_directing_manager()
    and audience in ('manager', 'all')
  );

-- Chatbot : le DM pose des questions comme un manager.
alter table public.chatbot_questions
  drop constraint if exists chatbot_questions_role_check;
alter table public.chatbot_questions
  add constraint chatbot_questions_role_check
  check (role in ('admin', 'poster', 'hiring_manager', 'directing_manager'));
