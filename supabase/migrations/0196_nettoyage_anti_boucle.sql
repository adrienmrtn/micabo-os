-- Fix : une slide relançait le nettoyage à l'infini (même slide, même diaporama).
--
-- Le compteur `tentatives` n'était écrit qu'APRÈS Fal/Replicate/SeedVR/C2PA.
-- Un passage tué au mur Edge (~150 s) ou une exception après l'upload ne
-- laissaient donc aucune trace : MAX_TENTATIVES n'était jamais atteint, le
-- repli sur le brut ne partait jamais, et le diaporama restait en tête de file
-- pour tous les workers — les autres comptes importés n'avançaient plus.
--
-- 1) RPC d'incrément atomique, appelée AVANT l'appel provider (write-ahead).
-- 2) Index de file : les contenus qui échouent passent derrière les frais.
-- 3) Réparation : rattache les propres orphelins et libère les leases en cours.

create or replace function public.bump_contenu_slide_tentative(
  p_contenu_id uuid,
  p_position integer
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  slides jsonb;
  i integer;
  n integer;
  courant integer;
begin
  if p_contenu_id is null or p_position is null then
    return 0;
  end if;

  select structure_slides into slides
  from public.contenus
  where id = p_contenu_id
  for update;

  if slides is null or jsonb_typeof(slides) <> 'array' then
    return 0;
  end if;

  n := jsonb_array_length(slides);
  for i in 0 .. n - 1 loop
    if ((slides -> i) ->> 'position')::integer = p_position then
      courant := coalesce(((slides -> i) ->> 'tentatives')::integer, 0) + 1;
      slides := jsonb_set(slides, array[i::text, 'tentatives'], to_jsonb(courant), true);
      update public.contenus
      set structure_slides = slides
      where id = p_contenu_id;
      return courant;
    end if;
  end loop;

  return 0;
end;
$$;

revoke all on function public.bump_contenu_slide_tentative(uuid, integer) from public;
grant execute on function public.bump_contenu_slide_tentative(uuid, integer) to authenticated;
grant execute on function public.bump_contenu_slide_tentative(uuid, integer) to service_role;

-- File d'import : `import_tentatives` d'abord (priorité inverse), pour qu'un
-- diaporama récalcitrant laisse passer les imports des autres comptes.
create index if not exists contenus_import_file_idx
  on public.contenus (import_tentatives, pertinence_score nulls first, created_at)
  where import_statut in ('pending', 'running', 'failed');

-- Réparation : un propre existe en storage mais la slide pointe encore ailleurs
-- (même logique que 0159, rejouée pour les imports bloqués depuis).
do $$
declare
  r record;
  slides jsonb;
  i integer;
  n integer;
  pos integer;
  mid text;
  propre_id uuid;
  cur_path text;
  changed boolean;
begin
  for r in
    select c.id, c.structure_slides
    from public.contenus c
    where c.import_statut in ('pending', 'running', 'failed')
      and c.structure_slides is not null
      and jsonb_typeof(c.structure_slides) = 'array'
  loop
    slides := r.structure_slides;
    n := jsonb_array_length(slides);
    changed := false;
    for i in 0 .. n - 1 loop
      pos := ((slides -> i) ->> 'position')::integer;
      mid := nullif(btrim((slides -> i) ->> 'media_id'), '');

      select m.id into propre_id
      from public.media_library m
      where m.contenu_id = r.id
        and m.storage_path like 'propre/' || r.id::text || '/' || pos || '.%'
        and coalesce(m.texte_restant, false) = false
      order by m.verifie_le desc nulls last
      limit 1;

      if propre_id is null then
        continue;
      end if;

      cur_path := null;
      if mid is not null then
        select m.storage_path into cur_path
        from public.media_library m
        where m.id = mid::uuid;
      end if;

      if cur_path is not null
         and cur_path like 'propre/' || r.id::text || '/' || pos || '.%' then
        continue;
      end if;

      slides := jsonb_set(slides, array[i::text, 'media_id'], to_jsonb(propre_id::text), true);
      slides := slides #- array[i::text, 'tentatives'];
      changed := true;
    end loop;

    if changed then
      update public.contenus set structure_slides = slides where id = r.id;
    end if;
  end loop;
end $$;

-- Libère les leases des workers morts pendant le nettoyage : sans ça, les
-- contenus bloqués attendent l'expiration (8 min) avant d'être repris.
update public.contenus
set import_lease_until = null
where import_statut in ('pending', 'running', 'failed')
  and import_lease_until is not null;

notify pgrst, 'reload schema';
