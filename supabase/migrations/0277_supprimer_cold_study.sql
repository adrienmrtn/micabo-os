-- cold_study est supprimé, et sa seule existence créait des comptes sans label.
--
-- Le repli de `manage-users` (`labelMoinsUtiliseParLangue`) prend le label le
-- MOINS utilisé. Un label retiré a zéro compte, donc le repli élisait
-- `cold_study` **précisément parce qu'il était retiré**. L'insert partait
-- ensuite dans le trigger de 0273, qui le jette en silence — et le compte
-- naissait sans label, donc sans aucun post, sans une erreur nulle part.
-- Constaté le 28/09 sur `leon.lernen977` : cold_study 0 compte, classic_study 27.
--
-- Le mécanisme de retrait attirait donc le repli vers le label retiré. C'est
-- l'inverse de ce qu'il devait faire, et c'est la conséquence non vue du choix
-- de 0273 : « le trigger ignore la ligne, il ne lève pas ». Ignorer en silence
-- rend un défaut invisible, pas inoffensif.
--
-- Le code est corrigé en parallèle (`idsLabelsAssignables` écarte un label
-- retiré, 5 tests), mais tant que la ligne existe elle reste un piège pour tout
-- chemin qui oublierait le filtre. On la supprime.
--
-- **Sauvegarde d'abord.** Les FK sont en CASCADE : supprimer le label emporte
-- 58 `contenu_labels`, 287 `media_labels` et 1 `compte_reference_labels`. Les 58
-- slideshows perdent leur SEUL label — ils étaient déjà intirables, mais on
-- perdrait le moyen de les retrouver. C'est la leçon de 0262 : avant une bascule
-- irréversible, ranger l'état d'avant.

create table if not exists public.cold_study_sauvegarde (
  id bigserial primary key,
  fait_le timestamptz not null default now(),
  genre text not null,
  cible_id uuid not null,
  detail jsonb
);

comment on table public.cold_study_sauvegarde is
  'État des rattachements cold_study avant sa suppression (0277, 28/09/2026). Permet de retrouver les 58 slideshows et 287 médias de la niche.';

insert into public.cold_study_sauvegarde (genre, cible_id, detail)
select 'label', l.id, to_jsonb(l.*) from public.labels l where l.slug = 'cold-study';

insert into public.cold_study_sauvegarde (genre, cible_id, detail)
select 'contenu', cl.contenu_id,
       jsonb_build_object('titre', c.titre, 'tier', c.tier, 'statut', c.statut)
  from public.contenu_labels cl
  join public.labels l on l.id = cl.label_id
  left join public.contenus c on c.id = cl.contenu_id
 where l.slug = 'cold-study';

insert into public.cold_study_sauvegarde (genre, cible_id, detail)
select 'media', ml.media_id, null
  from public.media_labels ml
  join public.labels l on l.id = ml.label_id
 where l.slug = 'cold-study';

insert into public.cold_study_sauvegarde (genre, cible_id, detail)
select 'source', crl.compte_reference_id, null
  from public.compte_reference_labels crl
  join public.labels l on l.id = crl.label_id
 where l.slug = 'cold-study';

delete from public.labels where slug = 'cold-study';
