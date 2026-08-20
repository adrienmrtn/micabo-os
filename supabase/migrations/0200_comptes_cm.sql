-- Phase 1 : type de compte CM + multi-comptes + identifiants TikTok.
-- Un créateur peut avoir plusieurs comptes. Un CM actif max par (poster, langue).
-- Les identifiants CM sont fournis en amont par admin / HM (pas créés par le poster).

alter table public.comptes
  add column if not exists type_compte text not null default 'perso';

alter table public.comptes
  drop constraint if exists comptes_type_compte_check;

alter table public.comptes
  add constraint comptes_type_compte_check
  check (type_compte in ('perso', 'cm'));

comment on column public.comptes.type_compte is
  'perso = TikTok du créateur (warmup, labels). cm = compte boîte, 1 par langue, identifiants fournis.';

create unique index if not exists comptes_cm_un_par_langue
  on public.comptes (poster_id, langue)
  where type_compte = 'cm' and is_active;

create index if not exists comptes_type_idx
  on public.comptes (poster_id, type_compte)
  where is_active;

-- Identifiants TikTok du compte CM (email / mot de passe / 2FA).
-- Lecture : propriétaire, admin, HM du créateur, DM de l'équipe.
-- Écriture : admin + HM/DM (pas le poster).
create table if not exists public.compte_identifiants (
  compte_id uuid primary key references public.comptes (id) on delete cascade,
  tiktok_email text not null,
  tiktok_password text not null,
  tiktok_2fa_note text,
  notes_hm text,
  renseigne_par uuid references auth.users (id) on delete set null,
  renseigne_at timestamptz not null default now(),
  vu_par_poster_at timestamptz
);

comment on table public.compte_identifiants is
  'Identifiants TikTok des comptes CM, saisis par HM/admin. RLS stricte ; jamais dans les logs.';

alter table public.compte_identifiants enable row level security;

create or replace function public.peut_voir_identifiants_compte(p_poster_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_poster_id = auth.uid()
    or public.is_admin()
    or (
      public.is_hiring_manager()
      and exists (
        select 1 from public.profiles pr
        where pr.id = p_poster_id
          and pr.manager_id = auth.uid()
      )
    )
    or (
      public.is_directing_manager()
      and public.est_createur_equipe_dm(p_poster_id)
    );
$$;

grant execute on function public.peut_voir_identifiants_compte(uuid) to authenticated, service_role;

create or replace function public.peut_ecrire_identifiants_compte(p_poster_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_admin()
    or (
      public.is_hiring_manager()
      and exists (
        select 1 from public.profiles pr
        where pr.id = p_poster_id
          and pr.manager_id = auth.uid()
      )
    )
    or (
      public.is_directing_manager()
      and public.est_createur_equipe_dm(p_poster_id)
    );
$$;

grant execute on function public.peut_ecrire_identifiants_compte(uuid) to authenticated, service_role;

drop policy if exists compte_identifiants_select on public.compte_identifiants;
create policy compte_identifiants_select on public.compte_identifiants
  for select
  using (
    exists (
      select 1 from public.comptes c
      where c.id = compte_id
        and public.peut_voir_identifiants_compte(c.poster_id)
    )
  );

drop policy if exists compte_identifiants_write on public.compte_identifiants;
create policy compte_identifiants_write on public.compte_identifiants
  for all
  using (
    exists (
      select 1 from public.comptes c
      where c.id = compte_id
        and public.peut_ecrire_identifiants_compte(c.poster_id)
    )
  )
  with check (
    exists (
      select 1 from public.comptes c
      where c.id = compte_id
        and public.peut_ecrire_identifiants_compte(c.poster_id)
    )
  );

-- Le poster met à jour le @ d'UN compte (plus tous ses comptes d'un coup).
drop function if exists public.maj_mon_handle(text);

create function public.maj_mon_handle(nouveau text, cible uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.comptes
     set handle_tiktok = nullif(trim(both from replace(nouveau, '@', '')), '')
   where poster_id = auth.uid()
     and (
       (cible is null and type_compte = 'perso')
       or id = cible
     );
end;
$$;

grant execute on function public.maj_mon_handle(text, uuid) to authenticated;

-- Vue calendrier : type de compte pour filtrer perso / CM.
drop view if exists public.posts_poster;

create view public.posts_poster
  with (security_invoker = true)
as
  select
    p.id,
    c.poster_id,
    p.compte_id,
    c.type_compte,
    c.persona_nom,
    c.handle_tiktok,
    c.langue,
    p.date_publication_prevue,
    p.type,
    p.statut,
    p.musique_url,
    p.musique_titre,
    p.musique_plateforme,
    p.publie_at,
    p.publie_url,
    p.recharges_createur,
    coalesce(s.titre, cont.titre) as sujet_titre,
    p.created_at
  from public.posts p
  join public.comptes c on c.id = p.compte_id
  left join public.sujets s on s.id = p.sujet_id
  left join public.passages pas on pas.post_id = p.id
  left join public.contenus cont on cont.id = pas.contenu_id
  where p.pipeline_statut = 'done'
    and coalesce(p.est_test, false) = false
    and (c.poster_id = auth.uid() or public.is_admin());

grant select on public.posts_poster to authenticated;
