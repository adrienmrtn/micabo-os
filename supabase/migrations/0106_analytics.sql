-- Vues d'analyse.
--
-- Les métriques arrivent par relevés successifs (un par passage du cron) : on
-- ne veut que le dernier relevé de chaque post, sinon les totaux comptent
-- plusieurs fois le même post.

drop view if exists public.stats_posts cascade;
create view public.stats_posts
with (security_invoker = off) as
  select
    p.id,
    p.compte_id,
    c.persona_nom,
    c.handle_tiktok,
    p.type,
    p.statut,
    p.date_publication_prevue,
    p.publie_at,
    p.publie_url,
    s.titre as sujet_titre,
    m.vues,
    m.likes,
    m.commentaires,
    m.partages,
    m.collecte_at
  from public.posts p
  join public.comptes c on c.id = p.compte_id
  left join public.sujets s on s.id = p.sujet_id
  left join lateral (
    select vues, likes, commentaires, partages, collecte_at
    from public.post_metrics
    where post_id = p.id
    order by collecte_at desc
    limit 1
  ) m on true
  where public.is_admin() or c.poster_id = auth.uid();

grant select on public.stats_posts to authenticated;

drop view if exists public.stats_comptes cascade;
create view public.stats_comptes
with (security_invoker = off) as
  select
    c.id as compte_id,
    c.persona_nom,
    c.handle_tiktok,
    c.langue,
    c.is_active,
    p.prenom as poster_prenom,
    p.nom as poster_nom,
    count(sp.id) as posts_total,
    count(sp.id) filter (where sp.publie_at is not null) as posts_publies,
    count(sp.id) filter (where sp.statut = 'assigne') as posts_en_attente,
    coalesce(sum(sp.vues), 0) as vues_totales,
    coalesce(sum(sp.likes), 0) as likes_totaux,
    -- Moyenne sur les seuls posts effectivement mesurés : diviser par tous les
    -- posts écraserait la moyenne avec ceux qui n'ont pas encore de relevé.
    coalesce(round(avg(sp.vues) filter (where sp.vues is not null)), 0) as vues_moyennes
  from public.comptes c
  left join public.profiles p on p.id = c.poster_id
  left join public.stats_posts sp on sp.compte_id = c.id
  where public.is_admin() or c.poster_id = auth.uid()
  group by c.id, c.persona_nom, c.handle_tiktok, c.langue, c.is_active, p.prenom, p.nom;

grant select on public.stats_comptes to authenticated;
