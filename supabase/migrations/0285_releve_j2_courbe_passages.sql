-- 0285 — Courbe des vues du Pilotage calculée sur nos passages (01/10/2026).
--
-- Le relevé ne lit plus les profils TikTok : chaque post est mesuré une fois,
-- à J+2, par son lien (`_shared/releve_file.ts`, `apify_releve.ts`). Or
-- `vues_globales_jour` sommait le dernier scrape de profil de chaque compte
-- (`compte_metrics`), un « total » qui dépendait du nombre de posts lus : il a
-- perdu la moitié de son échelle le 01/10 (delta −4 034 699) quand 0281 a
-- réduit ce nombre, sans qu'aucune audience ne bouge. Sans scrape de profil, il
-- se serait figé — une courbe plate qui ne dirait pas pourquoi.
--
-- Nouvelle définition, sur NOS posts seulement (hors posts test) :
--   vues_delta(J)   = vues relevées des posts publiés le jour Paris J ;
--   vues_totales(J) = cumul de ces vues jusqu'à J inclus ;
--   nb_comptes(J)   = comptes qui ont publié ce jour-là.
-- Un post n'est mesuré qu'à J+2 : la fonction recalcule donc les `p_jours`
-- derniers jours à chaque passe (4 par défaut), et le jour J se complète deux
-- jours plus tard.
--
-- L'historique est recalculé avec la même définition (sauvegarde d'abord,
-- leçon de 0262) : sans ça, la courbe sauterait d'une échelle à l'autre le
-- jour de la bascule.

create or replace function public.snapshot_vues_globales(p_jour date, p_jours integer default 4)
returns table (jour date, vues_totales bigint, vues_delta bigint, nb_comptes integer)
language plpgsql
set search_path = public
as $$
#variable_conflict use_column
declare
  v_debut date := p_jour - (greatest(coalesce(p_jours, 1), 1) - 1);
begin
  with pub as (
    select (pa.publie_at at time zone 'Europe/Paris')::date as jour_pub, pa.vues, pa.compte_id
    from public.passages pa
    left join public.posts po on po.id = pa.post_id
    where pa.statut = 'publie' and pa.vues is not null and pa.publie_at is not null
      and not coalesce(po.est_test, false)
  ),
  jours as (
    select d::date as j from generate_series(v_debut, p_jour, interval '1 day') d
  )
  insert into public.vues_globales_jour as v (jour, vues_totales, vues_delta, nb_comptes)
  select jours.j,
    coalesce((select sum(pub.vues) from pub where pub.jour_pub <= jours.j), 0)::bigint,
    coalesce((select sum(pub.vues) from pub where pub.jour_pub = jours.j), 0)::bigint,
    (select count(distinct pub.compte_id) from pub where pub.jour_pub = jours.j)::integer
  from jours
  on conflict (jour) do update
    set vues_totales = excluded.vues_totales,
        vues_delta = excluded.vues_delta,
        nb_comptes = excluded.nb_comptes;

  return query
    select g.jour, g.vues_totales, g.vues_delta, g.nb_comptes
    from public.vues_globales_jour g
    where g.jour between v_debut and p_jour
    order by g.jour;
end;
$$;

revoke all on function public.snapshot_vues_globales(date, integer) from public, anon, authenticated;
grant execute on function public.snapshot_vues_globales(date, integer) to service_role;

create table if not exists public.vues_globales_jour_sauvegarde as
  select *, now() as sauve_le from public.vues_globales_jour;
alter table public.vues_globales_jour_sauvegarde enable row level security;

-- Recalcul de tout l'historique, du premier jour connu à aujourd'hui (Paris).
select public.snapshot_vues_globales(
  (now() at time zone 'Europe/Paris')::date,
  ((now() at time zone 'Europe/Paris')::date - (select min(jour) from public.vues_globales_jour) + 1)
);

notify pgrst, 'reload schema';
