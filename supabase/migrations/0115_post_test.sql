-- Post de TEST : fabriqué pour prévisualiser un TikTok (nettoyage + Sophia + QR)
-- SANS l'assigner à un créateur. Exclu du calendrier du poster et du décompte du
-- cron (il ne bloque pas l'assignation du jour).
alter table public.posts add column if not exists est_test boolean not null default false;

create or replace view public.posts_poster as
  select p.id, c.poster_id, p.compte_id, c.persona_nom, c.handle_tiktok, c.langue,
         p.date_publication_prevue, p.type, p.statut, p.musique_url, p.musique_titre,
         p.musique_plateforme, p.publie_at, p.publie_url, s.titre as sujet_titre, p.created_at
  from posts p
  join comptes c on c.id = p.compte_id
  left join sujets s on s.id = p.sujet_id
  where p.pipeline_statut = 'done'
    and coalesce(p.est_test, false) = false
    and (c.poster_id = auth.uid() or is_admin());
