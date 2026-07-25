-- Un compte peut avoir des posts marqués « publié » sans que le poster ait collé
-- le lien TikTok (`publie_url` null). Le relevé de métriques matche par ce lien :
-- sans lien, ces posts restent à 0 vue — pas un bug, une donnée manquante. On
-- expose leur nombre pour transformer un « 0 » mystérieux en « X publiés sans lien ».
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
    count(sp.id) filter (where sp.publie_at is not null and sp.publie_url is null)
      as posts_sans_lien,
    count(sp.id) filter (where sp.statut = 'assigne') as posts_en_attente,
    coalesce(sum(sp.vues), 0) as vues_totales,
    coalesce(sum(sp.likes), 0) as likes_totaux,
    coalesce(round(avg(sp.vues) filter (where sp.vues is not null)), 0) as vues_moyennes
  from public.comptes c
  left join public.profiles p on p.id = c.poster_id
  left join public.stats_posts sp on sp.compte_id = c.id
  where public.is_admin() or c.poster_id = auth.uid()
  group by c.id, c.persona_nom, c.handle_tiktok, c.langue, c.is_active, p.prenom, p.nom;

grant select on public.stats_comptes to authenticated;
