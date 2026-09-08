-- Empêche 2 drains minuit d'assigner 2× le quota (ex. 4 posts au lieu de 2).
-- À 22:00, minuit-vnext et minuit-vnext-journee partent ensemble ; chaque
-- worker voyait 0 post et créait le quota. Le trigger pose un verrou compte.

create or replace function public.posts_enforce_quota_jour()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  q int;
  n int;
begin
  if coalesce(new.est_test, false) then
    return new;
  end if;
  if new.compte_id is null or new.date_publication_prevue is null then
    return new;
  end if;

  select least(3, greatest(1, coalesce(posts_par_jour, 1)))
    into q
  from public.comptes
  where id = new.compte_id
  for update;

  if q is null then
    return new;
  end if;

  select count(*) into n
  from public.posts
  where compte_id = new.compte_id
    and date_publication_prevue = new.date_publication_prevue
    and coalesce(est_test, false) = false;

  if n >= q then
    raise exception 'quota_posts_jour %/% compte=% jour=%',
      n, q, new.compte_id, new.date_publication_prevue;
  end if;
  return new;
end;
$$;

drop trigger if exists posts_enforce_quota_jour on public.posts;
create trigger posts_enforce_quota_jour
  before insert on public.posts
  for each row execute function public.posts_enforce_quota_jour();

-- Retire les posts assignés au-delà du quota (jamais un publié).
create or replace function public.purger_posts_hors_quota_jour(p_jour date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted uuid[] := '{}';
  rec record;
begin
  if p_jour is null then
    return jsonb_build_object('jour', null, 'supprimes', 0);
  end if;

  for rec in
    with cibles as (
      select
        p.id,
        p.statut,
        least(3, greatest(1, coalesce(c.posts_par_jour, 1))) as quota,
        row_number() over (
          partition by p.compte_id
          order by
            case when p.statut = 'publie' then 0 else 1 end,
            p.created_at
        ) as rn
      from public.posts p
      join public.comptes c on c.id = p.compte_id
      where p.date_publication_prevue = p_jour
        and coalesce(p.est_test, false) = false
    )
    select id from cibles
    where rn > quota
      and statut is distinct from 'publie'
  loop
    delete from public.passages where post_id = rec.id;
    delete from public.posts where id = rec.id;
    deleted := deleted || rec.id;
  end loop;

  return jsonb_build_object(
    'jour', p_jour,
    'supprimes', coalesce(array_length(deleted, 1), 0),
    'ids', to_jsonb(deleted)
  );
end;
$$;

revoke all on function public.purger_posts_hors_quota_jour(date) from public;
revoke all on function public.purger_posts_hors_quota_jour(date) from anon;
revoke all on function public.purger_posts_hors_quota_jour(date) from authenticated;

-- Filet horaire (`minuit-vnext-journee`) et 03:00 restent : le trigger
-- bloque la course. On ne fait que retirer les extras déjà créés.

-- Jour du bug + jour Paris en cours (si la migration part plus tard).
select public.purger_posts_hors_quota_jour(d)
from (
  select distinct d
  from unnest(array[
    date '2026-09-08',
    (timezone('Europe/Paris', now()))::date
  ]) as d
) s;
