-- Deux correctifs sur la séquence « Mettre à jour les sources ».
--
-- 1) maxFaits dans l'état : le reste-à-faire seul ne peut pas servir de preuve
--    d'avancement. Un scrape qui finit retire une ligne d'import_file et crée
--    un contenus en attente — le total est donc CONSTANT pendant toute la
--    phase de scrape. Le 19/08 il est resté pile à 239 alors que le serveur
--    abattait jusqu'à 43 scrapes/minute, et la séquence s'est crue bloquée.
--
-- 2) Reprise : relancer après un arrêt repartait du compte 1 et re-listait
--    pour rien les comptes déjà traités (un appel Apify chacun).

create or replace function public.maj_sources_demarrer(p_comptes jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  run jsonb;
  nouveau jsonb;
  depart int := 0;
  reprise boolean := false;
  ligne jsonb;
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

  -- Même liste de comptes, arrêt en cours de route : on repart où on en était.
  if run is not null
     and coalesce(run->>'statut', '') in ('bloquee', 'cancelled')
     and run->'comptes' = p_comptes
  then
    depart := coalesce((run->>'index')::int, 0);
    if depart > 0 and depart < jsonb_array_length(p_comptes) then
      reprise := true;
    else
      depart := 0;
    end if;
  end if;

  if reprise then
    ligne := jsonb_build_object(
      'at', now(),
      'niveau', 'info',
      'message', format(
        'Reprise au compte %s/%s — les précédents sont déjà passés',
        depart + 1,
        jsonb_array_length(p_comptes)
      )
    );
  else
    ligne := jsonb_build_object(
      'at', now(),
      'niveau', 'info',
      'message', format(
        'Séquence — un compte à la fois, file vidée entre chaque (%s source(s))',
        jsonb_array_length(p_comptes)
      )
    );
  end if;

  nouveau := jsonb_build_object(
    'statut', 'running',
    'comptes', p_comptes,
    'index', depart,
    'faits', depart,
    'handle', null,
    'phase', 'attente',
    'restant', 0,
    'minRestant', null,
    'maxFaits', null,
    'dernierProgresAt', null,
    'journal', case
      when reprise then coalesce(run->'journal', '[]'::jsonb) || jsonb_build_array(ligne)
      else jsonb_build_array(ligne)
    end
  );

  insert into public.reglages (cle, valeur, updated_at)
  values ('maj_sources_run', nouveau, now())
  on conflict (cle) do update
    set valeur = excluded.valeur, updated_at = excluded.updated_at;

  return jsonb_build_object('action', case when reprise then 'reprise' else 'demarre' end, 'etat', nouveau);
end;
$$;

revoke all on function public.maj_sources_demarrer(jsonb) from public, anon, authenticated;
grant execute on function public.maj_sources_demarrer(jsonb) to service_role;
