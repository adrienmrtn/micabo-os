-- Placement micabo écrit à la main (14/09/2026).
--
-- Jusqu'ici, le CTA micabo était TOUJOURS posé par un modèle
-- (`integrateSophia`), langue par langue, à l'assignation. Quand l'admin écrit
-- lui-même le texte dans la file de validation et y glisse micabo.app où il
-- veut, refaire ce travail est au mieux inutile, au pire destructeur : le
-- modèle déplacerait le CTA ou réécrirait la slide.
--
-- D'où ce drapeau, posé sur le CONTENU depuis le deck source :
--
--   placement_manuel = true
--     → `assurerDeckPourLangue` ne lance JAMAIS `integrateSophia`, dans aucune
--       langue. La langue source part telle quelle. Les autres langues sont
--       une simple TRADUCTION du deck source : le CTA voyage avec le texte,
--       reste sur la même slide, et `micabo.app` n'est pas traduit.
--
--   placement_manuel = false (défaut)
--     → comportement d'avant : le modèle choisit la slide et la formule, avec
--       `placementParDefaut` en repli si l'appel échoue.
--
-- `contenu_langues.position_sophia` continue de dire QUELLE slide porte le CTA.
-- En manuel, c'est l'admin qui coche la slide ; en auto, c'est le modèle.

alter table public.contenus
  add column if not exists placement_manuel boolean not null default false;

comment on column public.contenus.placement_manuel is
  'Le CTA micabo est écrit à la main dans le deck source : aucun placement automatique, dans aucune langue. Les traductions le portent tel quel.';

notify pgrst, 'reload schema';
