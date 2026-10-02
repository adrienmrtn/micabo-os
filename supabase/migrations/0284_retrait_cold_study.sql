-- 0284 — Les slideshows cold-study sortent du pool (01/10/2026).
--
-- Le label `cold-study` a été retiré le 24/09 puis supprimé par 0277 (état
-- rangé dans `cold_study_sauvegarde`). Ses 58 slideshows y avaient perdu leur
-- SEUL label : 50 étaient encore `valide` et devaient des passages qu'aucun
-- compte ne pouvait tirer — les « dus intirables » du brief, qui gonflaient
-- tous les comptages sans jamais sortir. Décision d'Adrien : les retirer.
--
-- Rejet, pas suppression. Les FK `passages`, `reposts_bonus` et
-- `contenu_tier_historique` sont en CASCADE : supprimer ces 50 contenus
-- effacerait 146 passages PUBLIÉS, avec leurs vues, que la qualification des
-- créateurs et l'historique des cycles lisent encore. `rejete` sort un
-- slideshow de l'assignation (elle ne lit que `valide`), ne repasse jamais par
-- la file de validation, et laisse l'historique intact.
--
-- La source `studylapses` (niche cold_study) est désactivée avec : sans quoi un
-- prochain import ramènerait des slideshows nés sans label.

create table if not exists public.cold_study_retrait_sauvegarde (
  genre text not null,
  cible_id uuid not null,
  statut_avant text,
  actif_avant boolean,
  sauve_le timestamptz not null default now()
);
alter table public.cold_study_retrait_sauvegarde enable row level security;

insert into public.cold_study_retrait_sauvegarde (genre, cible_id, statut_avant)
select 'contenu', c.id, c.statut::text
from public.contenus c
where c.id in (select cible_id from public.cold_study_sauvegarde where genre = 'contenu')
  and c.statut = 'valide';

insert into public.cold_study_retrait_sauvegarde (genre, cible_id, actif_avant)
select 'source', r.id, r.is_active
from public.comptes_reference r
where r.id in (select cible_id from public.cold_study_sauvegarde where genre = 'source')
  and r.is_active;

update public.contenus c
set statut = 'rejete'
where c.id in (select cible_id from public.cold_study_sauvegarde where genre = 'contenu')
  and c.statut = 'valide'
  -- Garde : un slideshow relabellisé depuis 0277 reste dans le pool.
  and not exists (
    select 1 from public.contenu_labels x
    join public.labels l on l.id = x.label_id
    where x.contenu_id = c.id and l.retire_le is null
  );

update public.comptes_reference r
set is_active = false
where r.id in (select cible_id from public.cold_study_sauvegarde where genre = 'source')
  and r.is_active;
