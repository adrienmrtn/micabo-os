-- 0302 — Source @emir.study et le logo « astra AI » (02/10/2026).
--
-- Adrien ajoute @emir.study (tr, 137 slideshows), « mais attention au logo
-- astra AI sur chaque slideshow ». Ce que l'essai sur 7640954030570736917 a
-- montré :
--
-- - le logo n'est PAS un filigrane en coin. C'est un badge (pictogramme doré en
--   triple boucle, mot « astra », carré « AI », sur une pastille noire) posé sur
--   la slide qui fait la pub de l'appli — sur l'écran du portable, au milieu de
--   l'image — avec le texte « Astra AI uygulamasını kullanıyorum, ChatGPT o
--   kadar iyi çalışmıyor » ;
-- - le nettoyage de l'import (`fal-ai/image-editing/text-removal`) efface la
--   légende mais laisse le logo ENTIER : pour lui, c'est une image, pas du texte ;
-- - `nettoyage-cible` avec `depuis: "propre"` l'efface sur l'image déjà
--   nettoyée et agrandie par l'import. Il faut lui dire de ne RIEN garder autour
--   du logo : au premier essai, il avait marqué l'écran du portable « à garder »,
--   et le garde-fou du masque a abandonné la zone qui le recouvrait.
--
-- Le texte : Astra est déjà dans `concurrents` (0286), donc `sansConcurrents`
-- l'aurait remplacé à la fabrication de chaque deck. Mais la file montre le
-- deck source tel que l'OCR l'a lu. Pour qu'Adrien relise un slideshow propre,
-- la mention devient la forme de marque turque dans le deck source, le reste
-- mot pour mot (règle de 0287), et la slide est marquée comme placement.
--
-- `astra_vers_micabo_tr` : « Astra AI’ı » → « micabo’yu » d'abord (accusatif,
-- sinon il resterait « micabo’ı »), puis le nom nu → « micabo », puis
-- `micabo_avec_article` (0267) pose « uygulaması » et fait migrer le suffixe.
-- `astra_reprise_0302` garde l'avant et l'après de chaque slide réécrite.

create table if not exists public.astra_reprise_0302 (
  contenu_id uuid not null,
  langue text not null,
  position int not null,
  avant text,
  apres text,
  fait_le timestamptz not null default now(),
  primary key (contenu_id, langue, position)
);
alter table public.astra_reprise_0302 enable row level security;

create or replace function public.astra_vers_micabo_tr(t text) returns text language sql immutable as $f$
  select public.micabo_avec_article(
    regexp_replace(
      regexp_replace(t, '\mastra([ \t]?a[il])?[’'']?[ıi]\M', 'micabo’yu', 'gi'),
      '\mastra([ \t]?a[il]\M)?', 'micabo', 'gi'),
    'tr')
$f$;
