-- Phase 3 : un créateur y passe au premier post publié.
-- L'OS calcule le flag et les stats (rythme 10 j., vues, ELO).

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

  update public.upwork_approches a
  set os_ok = (u.last_sign_in_at is not null)
  from public.profiles p
  left join auth.users u on u.id = p.id
  where a.profile_id = p.id;

  update public.upwork_approches a
  set os_ok = false
  where a.profile_id is null;

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

  update public.upwork_approches a
  set warmup_actif = exists (
    select 1 from public.comptes c
    where c.poster_id = a.profile_id
      and c.warmup_started_at is not null
  );

  update public.upwork_approches a
  set premier_post_ok = exists (
    select 1
    from public.comptes c
    join public.passages p on p.compte_id = c.id
    where c.poster_id = a.profile_id
      and p.statut = 'publie'
  );

  update public.upwork_approches a
  set contrat_envoye_ok =
    a.statut in ('offered', 'hired')
    or a.contract_id is not null
    or exists (
      select 1 from public.upwork_admin_flags f
      where f.upwork_proposal_id = a.upwork_proposal_id
        and f.contrat_envoye_ok
    );

  update public.upwork_approches a
  set
    upwork_ajoute_ok = coalesce(f.upwork_ajoute_ok, a.upwork_ajoute_ok),
    slack_envoye_ok = a.slack_envoye_ok or coalesce(f.slack_envoye_ok, false),
    email_demande_ok = a.email_demande_ok or coalesce(f.email_demande_ok, false),
    codes_ok = a.codes_ok or coalesce(f.codes_ok, false)
  from public.upwork_admin_flags f
  where f.upwork_proposal_id = a.upwork_proposal_id;
end;
$$;

create or replace function public.upwork_surveillance()
returns table (
  compte_id uuid,
  poster_id uuid,
  manager_id uuid,
  nom text,
  handle text,
  posts_par_jour integer,
  posts_10j integer,
  prevus_10j integer,
  vues_10 integer,
  posts_mesures integer,
  elo numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  auj date := (now() at time zone 'Europe/Paris')::date;
begin
  if not public.is_admin() then
    raise exception 'upwork: admin seulement';
  end if;

  return query
  select
    c.id,
    c.poster_id,
    pr.manager_id,
    nullif(btrim(concat_ws(' ', pr.prenom, pr.nom)), ''),
    nullif(btrim(c.handle_tiktok), ''),
    greatest(coalesce(c.posts_par_jour, 1), 1),
    (
      select count(*)::int
      from public.passages p
      where p.compte_id = c.id
        and p.statut = 'publie'
        and coalesce(
          (p.publie_at at time zone 'Europe/Paris')::date,
          p.date_publication_prevue
        ) between auj - 9 and auj
    ),
    10 * greatest(coalesce(c.posts_par_jour, 1), 1),
    coalesce((
      select sum(coalesce(p.vues, 0))::int
      from (
        select p.vues
        from public.passages p
        where p.compte_id = c.id
          and p.statut = 'publie'
        order by coalesce(p.publie_at, p.date_publication_prevue::timestamptz) desc nulls last
        limit 10
      ) p
    ), 0),
    (
      select count(*)::int
      from (
        select 1
        from public.passages p
        where p.compte_id = c.id
          and p.statut = 'publie'
        order by coalesce(p.publie_at, p.date_publication_prevue::timestamptz) desc nulls last
        limit 10
      ) p
    ),
    coalesce(c.score, 50)::numeric
  from public.comptes c
  join public.profiles pr on pr.id = c.poster_id
  where exists (
    select 1 from public.passages p
    where p.compte_id = c.id
      and p.statut = 'publie'
  );
end;
$$;

revoke all on function public.upwork_surveillance() from public, anon;
grant execute on function public.upwork_surveillance() to authenticated;

select public.upwork_approches_relier_os();
