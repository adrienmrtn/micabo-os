-- Vue d'onboarding poster.
--
-- Un poster doit connaître le pseudo TikTok qu'on lui demande de créer et la
-- niche visée, mais jamais le compte de référence associé. tiktok_accounts
-- reste admin-only ; cette vue en extrait uniquement les colonnes sûres.

drop view if exists public.poster_accounts;
create view public.poster_accounts
with (security_invoker = off) as
  select
    a.id as assignment_id,
    a.poster_id,
    ta.suggested_creator_handle,
    ta.niche,
    a.assigned_at
  from public.assignments a
  join public.tiktok_accounts ta on ta.id = a.tiktok_account_id
  where a.poster_id = auth.uid() or public.is_admin();

grant select on public.poster_accounts to authenticated;
