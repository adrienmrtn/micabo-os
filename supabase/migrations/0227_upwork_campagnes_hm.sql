-- Recrutement HM en boucle, piloté depuis l'OS mais exécuté par l'agent.
--
-- L'admin lance une campagne pour un pays. L'OS n'appelle jamais Upwork :
-- il pose l'état, et `upwork_campagnes_planifier()` en déduit la prochaine
-- action à mettre dans la file. L'agent lit la file au passage suivant.
--
--   pas de job          → publier_job_hm
--   job publié, rien en attente de validation → sourcer_hm
--   des profils prêts   → inviter_hm
--   un HM embauché      → campagne terminée
--
-- Validation tacite : un profil proposé et laissé sans réponse pendant
-- `delai_validation_h` heures devient invitable tout seul. C'est évalué à la
-- lecture, donc aucun cron n'est nécessaire (le passage 2 h suffit).

create table if not exists public.upwork_campagnes (
  id uuid primary key default gen_random_uuid(),
  langue text not null,
  pays_nom text,
  role_cible text not null default 'hm' check (role_cible in ('hm')),
  statut text not null default 'active'
    check (statut in ('active', 'en_pause', 'terminee', 'arretee')),
  job_posting_id text,
  objectif_hm integer not null default 1 check (objectif_hm > 0),
  profils_par_passage integer not null default 10
    check (profils_par_passage between 1 and 10),
  delai_validation_h integer not null default 10 check (delai_validation_h > 0),
  lance_par uuid references public.profiles (id) on delete set null,
  lance_at timestamptz not null default now(),
  job_publie_at timestamptz,
  fin_at timestamptz,
  detail text
);

-- Une seule campagne vivante par pays.
create unique index if not exists upwork_campagnes_active_idx
  on public.upwork_campagnes (langue, role_cible)
  where statut in ('active', 'en_pause');

alter table public.upwork_campagnes enable row level security;

drop policy if exists upwork_campagnes_admin on public.upwork_campagnes;
create policy upwork_campagnes_admin on public.upwork_campagnes
  for all using (public.is_admin()) with check (public.is_admin());

grant select, insert, update on public.upwork_campagnes to authenticated;

create table if not exists public.upwork_candidats (
  id uuid primary key default gen_random_uuid(),
  campagne_id uuid not null references public.upwork_campagnes (id) on delete cascade,
  upwork_person_id text not null,
  profile_key text,
  nom text not null,
  titre_profil text,
  photo_url text,
  upwork_profile_url text,
  pays text,
  taux_horaire numeric,
  job_success numeric,
  pourquoi text,
  statut text not null default 'propose'
    check (statut in ('propose', 'valide', 'refuse', 'invite')),
  auto_valide boolean not null default false,
  propose_at timestamptz not null default now(),
  echeance_at timestamptz not null,
  decide_par uuid references public.profiles (id) on delete set null,
  decide_at timestamptz,
  invite_at timestamptz,
  unique (campagne_id, upwork_person_id)
);

create index if not exists upwork_candidats_file_idx
  on public.upwork_candidats (campagne_id, statut, echeance_at);

alter table public.upwork_candidats enable row level security;

drop policy if exists upwork_candidats_admin on public.upwork_candidats;
create policy upwork_candidats_admin on public.upwork_candidats
  for all using (public.is_admin()) with check (public.is_admin());

grant select, insert, update on public.upwork_candidats to authenticated;

-- La file d'actions accueille les trois étapes de campagne.
alter table public.upwork_actions
  add column if not exists campagne_id uuid
    references public.upwork_campagnes (id) on delete cascade;

alter table public.upwork_actions drop constraint if exists upwork_actions_type_check;
alter table public.upwork_actions add constraint upwork_actions_type_check
  check (type in ('arreter_recrutement', 'publier_job_hm', 'sourcer_hm', 'inviter_hm'));

create index if not exists upwork_actions_campagne_idx
  on public.upwork_actions (campagne_id, statut);

-- ---------------------------------------------------------------- admin

create or replace function public.upwork_campagne_lancer(
  p_langue text,
  p_pays_nom text default null,
  p_objectif integer default 1,
  p_delai_h integer default 10
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  nouvelle_id uuid;
begin
  if not public.is_admin() then
    raise exception 'upwork: admin seulement';
  end if;

  if p_langue is null or btrim(p_langue) = '' then
    raise exception 'upwork_campagne: langue manquante';
  end if;

  insert into public.upwork_campagnes (
    langue, pays_nom, objectif_hm, delai_validation_h, lance_par
  )
  values (
    lower(btrim(p_langue)),
    nullif(btrim(p_pays_nom), ''),
    greatest(coalesce(p_objectif, 1), 1),
    greatest(coalesce(p_delai_h, 10), 1),
    auth.uid()
  )
  returning id into nouvelle_id;

  -- Reprend le job HM déjà ouvert sur ce pays plutôt que d'en publier un autre.
  update public.upwork_campagnes c
  set job_posting_id = m.job_posting_id, job_publie_at = m.created_time
  from public.upwork_missions m
  where c.id = nouvelle_id
    and m.famille = 'hm'
    and m.statut = 'PUBLISHED'
    and m.langue = c.langue;

  perform public.upwork_campagnes_planifier();
  return nouvelle_id;
exception
  when unique_violation then
    raise exception 'upwork_campagne: une campagne tourne déjà sur ce pays';
end;
$$;

revoke all on function public.upwork_campagne_lancer(text, text, integer, integer) from public, anon;
grant execute on function public.upwork_campagne_lancer(text, text, integer, integer) to authenticated;

create or replace function public.upwork_campagne_arreter(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'upwork: admin seulement';
  end if;

  update public.upwork_campagnes
  set statut = 'arretee', fin_at = now()
  where id = p_id and statut in ('active', 'en_pause');

  update public.upwork_actions
  set statut = 'annule', fait_at = now()
  where campagne_id = p_id and statut = 'en_attente';
end;
$$;

revoke all on function public.upwork_campagne_arreter(uuid) from public, anon;
grant execute on function public.upwork_campagne_arreter(uuid) to authenticated;

-- Valider / refuser un profil proposé. Sans réponse, le délai décide.
create or replace function public.upwork_candidat_decider(p_id uuid, p_ok boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'upwork: admin seulement';
  end if;

  update public.upwork_candidats
  set
    statut = case when p_ok then 'valide' else 'refuse' end,
    auto_valide = false,
    decide_par = auth.uid(),
    decide_at = now()
  where id = p_id and statut = 'propose';

  perform public.upwork_campagnes_planifier();
end;
$$;

revoke all on function public.upwork_candidat_decider(uuid, boolean) from public, anon;
grant execute on function public.upwork_candidat_decider(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------- agent

create or replace function public.upwork_campagne_job_publie(
  p_campagne uuid,
  p_job_posting_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.upwork_campagnes
  set job_posting_id = btrim(p_job_posting_id), job_publie_at = now()
  where id = p_campagne;
end;
$$;

revoke all on function public.upwork_campagne_job_publie(uuid, text) from public, anon, authenticated;
grant execute on function public.upwork_campagne_job_publie(uuid, text) to service_role;

-- L'agent dépose ses recommandations ; personne n'est invité à ce stade.
create or replace function public.upwork_candidats_enregistrer(
  p_campagne uuid,
  p_profils jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  delai integer;
  n integer;
begin
  select delai_validation_h into delai
  from public.upwork_campagnes where id = p_campagne;

  if delai is null then
    raise exception 'upwork_candidats: campagne introuvable (%)', p_campagne;
  end if;

  insert into public.upwork_candidats (
    campagne_id, upwork_person_id, profile_key, nom, titre_profil, photo_url,
    upwork_profile_url, pays, taux_horaire, job_success, pourquoi, echeance_at
  )
  select
    p_campagne,
    p ->> 'upwork_person_id',
    p ->> 'profile_key',
    coalesce(p ->> 'nom', '?'),
    p ->> 'titre_profil',
    p ->> 'photo_url',
    p ->> 'upwork_profile_url',
    p ->> 'pays',
    (p ->> 'taux_horaire')::numeric,
    (p ->> 'job_success')::numeric,
    p ->> 'pourquoi',
    now() + make_interval(hours => delai)
  from jsonb_array_elements(coalesce(p_profils, '[]'::jsonb)) as p
  where p ->> 'upwork_person_id' is not null
    -- jamais quelqu'un qui a déjà répondu à un de nos jobs
    and not exists (
      select 1 from public.upwork_approches a
      where a.upwork_freelancer_id = p ->> 'upwork_person_id'
    )
  on conflict (campagne_id, upwork_person_id) do nothing;

  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.upwork_candidats_enregistrer(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.upwork_candidats_enregistrer(uuid, jsonb) to service_role;

-- Validés + tacitement validés par expiration du délai.
create or replace function public.upwork_candidats_a_inviter(p_campagne uuid)
returns setof public.upwork_candidats
language sql
security definer
set search_path = public
as $$
  select *
  from public.upwork_candidats
  where campagne_id = p_campagne
    and (statut = 'valide' or (statut = 'propose' and now() >= echeance_at))
  order by propose_at
$$;

revoke all on function public.upwork_candidats_a_inviter(uuid) from public, anon, authenticated;
grant execute on function public.upwork_candidats_a_inviter(uuid) to service_role;

create or replace function public.upwork_candidat_invite(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.upwork_candidats
  set
    statut = 'invite',
    invite_at = now(),
    auto_valide = (statut = 'propose'),
    decide_at = coalesce(decide_at, now())
  where id = p_id;
end;
$$;

revoke all on function public.upwork_candidat_invite(uuid) from public, anon, authenticated;
grant execute on function public.upwork_candidat_invite(uuid) to service_role;

-- ---------------------------------------------------------- planificateur

create or replace function public.upwork_campagnes_planifier()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  c record;
  pays text;
  nouvelle_id uuid;
  texte text;
  type_action text;
  embauches integer;
begin
  for c in
    select * from public.upwork_campagnes
    where statut in ('active', 'en_pause')
    order by lance_at
  loop
    pays := coalesce(c.pays_nom, upper(c.langue));

    select count(*) into embauches
    from public.upwork_approches a
    join public.upwork_missions m on m.job_posting_id = a.job_posting_id
    where a.role = 'hm' and a.statut = 'hired' and m.langue = c.langue;

    if embauches >= c.objectif_hm then
      update public.upwork_campagnes
      set statut = 'terminee', fin_at = now(),
          detail = format('%s HM embauché(s) sur %s', embauches, c.objectif_hm)
      where id = c.id;
      update public.upwork_actions
      set statut = 'annule', fait_at = now()
      where campagne_id = c.id and statut = 'en_attente';
      continue;
    end if;

    -- Une action de campagne à la fois : l'agent finit avant qu'on enchaîne.
    if exists (
      select 1 from public.upwork_actions
      where campagne_id = c.id and statut = 'en_attente'
    ) then
      continue;
    end if;

    if c.job_posting_id is null then
      type_action := 'publier_job_hm';
    elsif not exists (
      select 1 from public.upwork_missions
      where job_posting_id = c.job_posting_id and statut = 'PUBLISHED'
    ) then
      -- Job fermé côté Upwork : on ne source plus dans le vide.
      update public.upwork_campagnes
      set statut = 'en_pause', detail = 'job non PUBLISHED'
      where id = c.id;
      continue;
    elsif exists (
      select 1 from public.upwork_candidats
      where campagne_id = c.id
        and (statut = 'valide' or (statut = 'propose' and now() >= echeance_at))
    ) then
      type_action := 'inviter_hm';
    elsif exists (
      select 1 from public.upwork_candidats
      where campagne_id = c.id and statut = 'propose'
    ) then
      -- Des profils attendent l'admin et le délai court encore.
      continue;
    else
      type_action := 'sourcer_hm';
    end if;

    if c.statut = 'en_pause' then
      update public.upwork_campagnes set statut = 'active', detail = null where id = c.id;
    end if;

    if type_action = 'publier_job_hm' then
      texte :=
        'Publie le job post Hiring Manager pour ' || pays || '.' || chr(10)
        || '1. list_accounts → org Micabo ' || public.upwork_org_uid_micabo()
        || ' uniquement. Si ce n''est pas cette org, stop.' || chr(10)
        || '2. get_job_posting action=list puis action=get sur le job HM le plus'
        || ' récent : reprends sa structure (titre, description, skills, budget)'
        || ' et adapte-la à ' || pays || '.' || chr(10)
        || '   Le texte parle de micabo (minuscules), éducation IA pour étudiants.'
        || ' Jamais le nom d''un autre produit.' || chr(10)
        || '3. post_job action=create, org_uid=' || public.upwork_org_uid_micabo()
        || '. Le create rend un preview : confirm_preview pour publier.'
        || ' L''admin a déjà validé en lançant cette campagne dans l''OS.' || chr(10)
        || '4. select public.upwork_campagne_job_publie('
        || quote_literal(c.id::text) || ', ''<job_posting_id>'');' || chr(10)
        || '5. select public.upwork_action_terminer(''<id>'', ''<résumé>'');';

    elsif type_action = 'sourcer_hm' then
      texte :=
        'Sélectionne des Hiring Managers pour ' || pays
        || ' — recommandations seulement, aucune invitation.' || chr(10)
        || '1. list_accounts → org Micabo ' || public.upwork_org_uid_micabo()
        || ' uniquement. Sinon stop.' || chr(10)
        || '2. find_freelancers action=smart_search, job_id='
        || c.job_posting_id || ', limit=' || c.profils_par_passage
        || '. C''est le classement Upwork pour ce job.' || chr(10)
        || '   Garde ceux qui collent à ' || pays
        || ' et qui savent recruter et piloter des créateurs.' || chr(10)
        || '3. Enregistre-les, sans inviter personne :' || chr(10)
        || '   select public.upwork_candidats_enregistrer('
        || quote_literal(c.id::text) || ', ''<jsonb>''::jsonb);' || chr(10)
        || '   Un objet par profil : upwork_person_id (= person_id), profile_key,'
        || ' nom, titre_profil, photo_url, upwork_profile_url, pays,'
        || ' taux_horaire, job_success, pourquoi (une phrase).' || chr(10)
        || '4. N''envoie AUCUNE invitation ici : l''admin valide dans l''OS,'
        || ' et sans réponse sous ' || c.delai_validation_h
        || ' h les profils partent tout seuls au passage suivant.' || chr(10)
        || '5. select public.upwork_action_terminer(''<id>'', ''<résumé>'');';

    else
      texte :=
        'Invite les Hiring Managers retenus pour ' || pays || '.' || chr(10)
        || '1. list_accounts → org Micabo ' || public.upwork_org_uid_micabo()
        || ' uniquement. Sinon stop.' || chr(10)
        || '2. select * from public.upwork_candidats_a_inviter('
        || quote_literal(c.id::text) || ');' || chr(10)
        || '   Cette liste et rien d''autre : profils validés par l''admin,'
        || ' plus ceux laissés sans réponse depuis ' || c.delai_validation_h
        || ' h (validation tacite).' || chr(10)
        || '3. Pour chacun : invite_freelancer action=send, job '
        || c.job_posting_id || ', freelancerId = upwork_person_id,'
        || ' puis confirm_preview type=''invitation''.' || chr(10)
        || '   Message court, dans la langue de ' || pays
        || ', qui dit micabo et le rôle de Hiring Manager.' || chr(10)
        || '4. Après chaque invitation partie :'
        || ' select public.upwork_candidat_invite(''<candidat_id>'');' || chr(10)
        || '5. select public.upwork_action_terminer(''<id>'', ''<résumé>'');';
    end if;

    insert into public.upwork_actions (
      type, campagne_id, cible_nom, cible_role, langue, prompt, demande_par
    )
    values (
      type_action, c.id, pays, 'hm', c.langue, texte, c.lance_par
    )
    returning id into nouvelle_id;

    update public.upwork_actions
    set prompt = replace(prompt, '''<id>''', quote_literal(nouvelle_id::text))
    where id = nouvelle_id;
  end loop;
end;
$$;

-- Personne ne l'appelle en direct : les fonctions admin et agent sont
-- security definer et l'atteignent avec les droits du propriétaire.
revoke all on function public.upwork_campagnes_planifier() from public, anon, authenticated;
grant execute on function public.upwork_campagnes_planifier() to service_role;

-- Point d'entrée unique de l'agent : on replanifie, puis on rend la file.
create or replace function public.upwork_actions_en_attente()
returns setof public.upwork_actions
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.upwork_campagnes_planifier();
  return query
    select * from public.upwork_actions
    where statut = 'en_attente'
    order by demande_at;
end;
$$;

revoke all on function public.upwork_actions_en_attente() from public, anon, authenticated;
grant execute on function public.upwork_actions_en_attente() to service_role;

-- Une action de campagne terminée débloque la suivante au même passage.
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

  perform public.upwork_campagnes_planifier();
end;
$$;

revoke all on function public.upwork_action_terminer(uuid, text) from public, anon, authenticated;
grant execute on function public.upwork_action_terminer(uuid, text) to service_role;
