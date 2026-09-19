-- Un média peut montrer la marque d'un concurrent (logo, écran d'appli) sans
-- qu'aucun texte ne la mentionne : le nettoyage texte (0269) ne l'attrape pas.
-- On marque ces visuels pour que la repioche biblio ne les ramène jamais.
--
-- Sans ce garde-fou, retirer une image bannie d'une slide la rend PLUS
-- probable au tirage suivant : `mediaPropreMemeLabel` ordonne par `used_count`
-- croissant, donc une image qu'on vient de libérer remonte en tête.

alter table media_library
  add column if not exists exclu_concurrent boolean not null default false;

comment on column media_library.exclu_concurrent is
  'Visuel écarté de la repioche biblio : montre la marque d''un concurrent.';

create index if not exists media_library_exclu_concurrent_idx
  on media_library (exclu_concurrent)
  where exclu_concurrent;

-- Les visuels identifiés visuellement le 17/09/2026 (balayage des 662 images
-- placées dans des contenus validés + les 14 repérées par la piste texte).
update media_library m
set exclu_concurrent = true
from hustly_bannies b
where b.media_id = m.id and m.exclu_concurrent is distinct from true;
