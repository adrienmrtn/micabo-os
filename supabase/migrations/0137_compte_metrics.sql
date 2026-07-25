-- Métriques AU NIVEAU DU COMPTE : on scrape le profil TikTok du poster et on
-- somme les vues/likes de SES posts, indépendamment des liens qu'il a collés.
-- C'est ce qui débloque l'analytics d'un compte qui a publié sans donner de lien
-- (le rapprochement par publie_url ne pouvait alors rien mesurer).
create table if not exists public.compte_metrics (
  id uuid primary key default gen_random_uuid(),
  compte_id uuid not null references public.comptes (id) on delete cascade,
  vues bigint,
  likes bigint,
  commentaires bigint,
  partages bigint,
  nb_posts int,
  collecte_at timestamptz not null default now()
);

create index if not exists idx_compte_metrics_compte
  on public.compte_metrics (compte_id, collecte_at desc);

alter table public.compte_metrics enable row level security;
-- Écriture par le service role (fonction metriques) uniquement ; lecture via la
-- vue stats_comptes (security_invoker off), pas d'accès direct côté client.

-- La vue « par compte » privilégie désormais le total RÉEL scrapé du profil, et
-- retombe sur la somme des relevés par post (liens) s'il n'y a pas encore de
-- scrape du compte.
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
    coalesce(
      (select cm.vues from public.compte_metrics cm
        where cm.compte_id = c.id order by cm.collecte_at desc limit 1),
      sum(sp.vues), 0
    ) as vues_totales,
    coalesce(
      (select cm.likes from public.compte_metrics cm
        where cm.compte_id = c.id order by cm.collecte_at desc limit 1),
      sum(sp.likes), 0
    ) as likes_totaux,
    coalesce(round(avg(sp.vues) filter (where sp.vues is not null)), 0) as vues_moyennes
  from public.comptes c
  left join public.profiles p on p.id = c.poster_id
  left join public.stats_posts sp on sp.compte_id = c.id
  where public.is_admin() or c.poster_id = auth.uid()
  group by c.id, c.persona_nom, c.handle_tiktok, c.langue, c.is_active, p.prenom, p.nom;

grant select on public.stats_comptes to authenticated;
