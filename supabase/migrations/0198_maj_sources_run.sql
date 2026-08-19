-- Séquence « Mettre à jour les sources » persistée (reglages.maj_sources_run).
-- Claim / start / cancel atomiques : deux workers drain ne doivent jamais
-- enfiler deux comptes à la fois.

create or replace function public.maj_sources_claim(p_lease_seconds integer default 480)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  run jsonb;
  lease timestamptz;
begin
  select valeur into run
    from public.reglages
   where cle = 'maj_sources_run'
   for update;

  if run is null or coalesce(run->>'statut', '') <> 'running' then
    return jsonb_build_object('action', 'idle');
  end if;

  lease := null;
  if coalesce(run->>'leaseUntil', '') <> '' then
    begin
      lease := (run->>'leaseUntil')::timestamptz;
    exception when others then
      lease := null;
    end;
  end if;

  if lease is not null and lease > now() then
    return jsonb_build_object('action', 'busy', 'etat', run);
  end if;

  run := run || jsonb_build_object(
    'leaseUntil', (now() + make_interval(secs => p_lease_seconds))
  );

  update public.reglages
     set valeur = run, updated_at = now()
   where cle = 'maj_sources_run';

  return jsonb_build_object('action', 'claimed', 'etat', run);
end;
$$;

create or replace function public.maj_sources_demarrer(p_comptes jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  run jsonb;
  nouveau jsonb;
begin
  if p_comptes is null or jsonb_typeof(p_comptes) <> 'array' or jsonb_array_length(p_comptes) = 0 then
    raise exception 'maj_sources_demarrer: liste de comptes vide';
  end if;

  select valeur into run
    from public.reglages
   where cle = 'maj_sources_run'
   for update;

  if run is not null and coalesce(run->>'statut', '') = 'running' then
    return jsonb_build_object('action', 'deja', 'etat', run);
  end if;

  nouveau := jsonb_build_object(
    'statut', 'running',
    'comptes', p_comptes,
    'index', 0,
    'faits', 0,
    'handle', null,
    'phase', 'attente',
    'restant', 0,
    'minRestant', null,
    'dernierProgresAt', null,
    'journal', jsonb_build_array(
      jsonb_build_object(
        'at', to_jsonb(now()::text),
        'niveau', 'info',
        'message', format('Séquence — un compte à la fois, file vidée entre chaque (%s source(s))', jsonb_array_length(p_comptes))
      )
    )
  );

  insert into public.reglages (cle, valeur, updated_at)
  values ('maj_sources_run', nouveau, now())
  on conflict (cle) do update
    set valeur = excluded.valeur, updated_at = excluded.updated_at;

  return jsonb_build_object('action', 'demarre', 'etat', nouveau);
end;
$$;

create or replace function public.maj_sources_annuler()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  run jsonb;
begin
  select valeur into run
    from public.reglages
   where cle = 'maj_sources_run'
   for update;

  if run is null or coalesce(run->>'statut', '') <> 'running' then
    return jsonb_build_object('action', 'idle', 'etat', run);
  end if;

  run := (run - 'leaseUntil') || jsonb_build_object(
    'statut', 'cancelled',
    'phase', null
  );
  run := jsonb_set(
    run,
    '{journal}',
    coalesce(run->'journal', '[]'::jsonb) || jsonb_build_array(
      jsonb_build_object(
        'at', to_jsonb(now()::text),
        'niveau', 'warn',
        'message', format('Arrêt demandé — %s compte(s) traité(s)', coalesce(run->>'faits', '0'))
      )
    )
  );

  update public.reglages
     set valeur = run, updated_at = now()
   where cle = 'maj_sources_run';

  return jsonb_build_object('action', 'annule', 'etat', run);
end;
$$;

revoke all on function public.maj_sources_claim(integer) from public, anon, authenticated;
revoke all on function public.maj_sources_demarrer(jsonb) from public, anon, authenticated;
revoke all on function public.maj_sources_annuler() from public, anon, authenticated;
grant execute on function public.maj_sources_claim(integer) to service_role;
grant execute on function public.maj_sources_demarrer(jsonb) to service_role;
grant execute on function public.maj_sources_annuler() to service_role;
