-- Trois sources de vérité distinctes sur une approche :
--   os_ok / tiktok_cree_ok : dérivés de l'OS (profiles, auth.users, comptes).
--   slack_ok               : payload agent (Slack MCP).
--   upwork_ajoute_ok       : coché à la main par l'admin dans l'OS.
-- Le sync efface et réécrit upwork_approches à chaque passage : les coches
-- admin vivent donc dans upwork_admin_flags, réappliquées après l'insert.
--
-- Ajoute aussi la file d'actions : l'OS écrit un prompt, l'agent le prend au
-- passage suivant et le marque fait. L'OS n'exécute rien lui-même.

alter table public.upwork_approches
  add column if not exists profile_id uuid references public.profiles (id) on delete set null,
  add column if not exists tiktok_cree_ok boolean not null default false,
  add column if not exists tiktok_handle text;

create table if not exists public.upwork_admin_flags (
  upwork_proposal_id text primary key,
  upwork_ajoute_ok boolean not null default false,
  maj_par uuid references public.profiles (id) on delete set null,
  maj_at timestamptz not null default now()
);

alter table public.upwork_admin_flags enable row level security;

drop policy if exists upwork_admin_flags_admin on public.upwork_admin_flags;
create policy upwork_admin_flags_admin on public.upwork_admin_flags
  for all using (public.is_admin()) with check (public.is_admin());

grant select, insert, update on public.upwork_admin_flags to authenticated;

create table if not exists public.upwork_actions (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('arreter_recrutement')),
  upwork_proposal_id text,
  cible_nom text not null,
  cible_role text check (cible_role in ('hm', 'createur')),
  langue text,
  prompt text not null,
  note text,
  statut text not null default 'en_attente'
    check (statut in ('en_attente', 'fait', 'annule')),
  demande_par uuid references public.profiles (id) on delete set null,
  demande_at timestamptz not null default now(),
  fait_at timestamptz,
  resultat text
);

create index if not exists upwork_actions_statut_idx
  on public.upwork_actions (statut, demande_at desc);

alter table public.upwork_actions enable row level security;

drop policy if exists upwork_actions_admin on public.upwork_actions;
create policy upwork_actions_admin on public.upwork_actions
  for all using (public.is_admin()) with check (public.is_admin());

grant select, insert, update on public.upwork_actions to authenticated;

-- Coche admin « ajoutée à mon compte Upwork » : survit au prochain sync.
create or replace function public.upwork_marquer_ajout_upwork(
  p_proposal_id text,
  p_ok boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'upwork: admin seulement';
  end if;

  insert into public.upwork_admin_flags (upwork_proposal_id, upwork_ajoute_ok, maj_par, maj_at)
  values (p_proposal_id, coalesce(p_ok, false), auth.uid(), now())
  on conflict (upwork_proposal_id) do update set
    upwork_ajoute_ok = excluded.upwork_ajoute_ok,
    maj_par = excluded.maj_par,
    maj_at = now();

  update public.upwork_approches
  set upwork_ajoute_ok = coalesce(p_ok, false)
  where upwork_proposal_id = p_proposal_id;
end;
$$;

revoke all on function public.upwork_marquer_ajout_upwork(text, boolean) from public, anon;
grant execute on function public.upwork_marquer_ajout_upwork(text, boolean) to authenticated;

-- Une action OS = un prompt figé, prêt pour le prochain passage de l'agent.
create or replace function public.upwork_action_creer(
  p_type text,
  p_proposal_id text,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  a record;
  nouvelle_id uuid;
  texte text;
begin
  if not public.is_admin() then
    raise exception 'upwork: admin seulement';
  end if;

  if p_type is distinct from 'arreter_recrutement' then
    raise exception 'upwork_action: type inconnu (%)', p_type;
  end if;

  select
    ap.nom,
    ap.role,
    ap.contract_id,
    ap.job_posting_id,
    ap.upwork_profile_url,
    ap.profile_id,
    m.langue
  into a
  from public.upwork_approches ap
  left join public.upwork_missions m on m.job_posting_id = ap.job_posting_id
  where ap.upwork_proposal_id = p_proposal_id;

  if not found then
    raise exception 'upwork_action: approche introuvable (%)', p_proposal_id;
  end if;

  if exists (
    select 1 from public.upwork_actions
    where upwork_proposal_id = p_proposal_id
      and type = p_type
      and statut = 'en_attente'
  ) then
    raise exception 'upwork_action: déjà en attente pour cette personne';
  end if;

  texte :=
    'Arrête le recrutement de ' || a.nom
    || ' (' || coalesce(a.role, '?') || coalesce(' ' || a.langue, '') || ').' || chr(10)
    || '1. Upwork — org Micabo ' || public.upwork_org_uid_micabo()
    || ' uniquement, vérifie avec list_accounts avant tout.' || chr(10)
    || '   Archive sa candidature ' || p_proposal_id
    || ' sur le job ' || a.job_posting_id || '.' || chr(10)
    || coalesce('   Contrat à clore : ' || a.contract_id || '.' || chr(10), '')
    || coalesce('   Profil : ' || a.upwork_profile_url || chr(10), '')
    || '2. OS — supprime son compte'
    || coalesce(' (profile ' || a.profile_id::text || ')', ' si elle en a un')
    || ' et ses comptes liés.' || chr(10)
    || coalesce('3. Contexte admin : ' || p_note || chr(10), '')
    || 'Quand c''est fait : select public.upwork_action_terminer(''<id>'', ''<résumé>'').' || chr(10)
    || 'Ne fais rien d''autre. Stop si l''org n''est pas Micabo.';

  insert into public.upwork_actions (
    type, upwork_proposal_id, cible_nom, cible_role, langue, prompt, note, demande_par
  )
  values (
    p_type, p_proposal_id, a.nom, a.role, a.langue, texte, nullif(btrim(p_note), ''), auth.uid()
  )
  returning id into nouvelle_id;

  update public.upwork_actions
  set prompt = replace(prompt, '''<id>''', quote_literal(nouvelle_id::text))
  where id = nouvelle_id;

  return nouvelle_id;
end;
$$;

revoke all on function public.upwork_action_creer(text, text, text) from public, anon;
grant execute on function public.upwork_action_creer(text, text, text) to authenticated;

create or replace function public.upwork_action_annuler(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'upwork: admin seulement';
  end if;
  update public.upwork_actions
  set statut = 'annule', fait_at = now()
  where id = p_id and statut = 'en_attente';
end;
$$;

revoke all on function public.upwork_action_annuler(uuid) from public, anon;
grant execute on function public.upwork_action_annuler(uuid) to authenticated;

-- Côté agent : lire la file, puis marquer fait.
create or replace function public.upwork_actions_en_attente()
returns setof public.upwork_actions
language sql
security definer
set search_path = public
as $$
  select * from public.upwork_actions
  where statut = 'en_attente'
  order by demande_at
$$;

revoke all on function public.upwork_actions_en_attente() from public, anon, authenticated;
grant execute on function public.upwork_actions_en_attente() to service_role;

create or replace function public.upwork_action_terminer(p_id uuid, p_resultat text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.upwork_actions
  set statut = 'fait', fait_at = now(), resultat = nullif(btrim(p_resultat), '')
  where id = p_id and statut = 'en_attente';
end;
$$;

revoke all on function public.upwork_action_terminer(uuid, text) from public, anon, authenticated;
grant execute on function public.upwork_action_terminer(uuid, text) to service_role;

-- Rattache chaque approche à son profil OS, puis dérive OS + TikTok.
create or replace function public.upwork_approches_relier_os()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.upwork_approches a
  set profile_id = coalesce(
    (
      select uc.profile_id
      from public.upwork_contrats uc
      where uc.contract_id = a.contract_id
        and uc.profile_id is not null
    ),
    (
      select p.id
      from public.profiles p
      where lower(btrim(concat_ws(' ', p.prenom, p.nom))) = lower(btrim(a.nom))
      order by p.created_at
      limit 1
    )
  );

  -- Rejoint l'OS = compte créé et au moins une connexion.
  update public.upwork_approches a
  set os_ok = (u.last_sign_in_at is not null)
  from public.profiles p
  left join auth.users u on u.id = p.id
  where a.profile_id = p.id;

  update public.upwork_approches a
  set os_ok = false
  where a.profile_id is null;

  -- Compte TikTok créé = handle renseigné sur un compte du créateur.
  update public.upwork_approches a
  set
    tiktok_handle = c.handle_tiktok,
    tiktok_cree_ok = true
  from public.comptes c
  where c.poster_id = a.profile_id
    and c.handle_tiktok is not null
    and btrim(c.handle_tiktok) <> '';

  update public.upwork_approches a
  set tiktok_cree_ok = false, tiktok_handle = null
  where a.tiktok_handle is null;

  -- Les coches admin repassent devant le payload.
  update public.upwork_approches a
  set upwork_ajoute_ok = f.upwork_ajoute_ok
  from public.upwork_admin_flags f
  where f.upwork_proposal_id = a.upwork_proposal_id;
end;
$$;

revoke all on function public.upwork_approches_relier_os() from public, anon, authenticated;
grant execute on function public.upwork_approches_relier_os() to service_role;

create or replace function public.upwork_approches_relier_os_trig()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.upwork_approches_relier_os();
  return null;
end;
$$;

drop trigger if exists upwork_approches_relier_os on public.upwork_approches;
create trigger upwork_approches_relier_os
  after insert on public.upwork_approches
  for each statement
  execute function public.upwork_approches_relier_os_trig();

select public.upwork_approches_relier_os();
