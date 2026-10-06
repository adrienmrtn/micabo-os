-- 0311 — AI UGC : la vidéo du jour part avec le son de la vidéo d’origine (06/10/2026).
--
-- Signalé par Adrien sur la première vidéo de @eva.learn : la page ne donnait
-- aucun son à mettre, seulement « ajoute un son tendance ». Or le modèle source
-- le connaît depuis son import (`ugc_modeles.musique_url`, la page TikTok du
-- son, lue par Apify comme pour un slideshow) et la vidéo rendue est muette :
-- le créateur doit poser CE son dans TikTok, comme la musique d’un post
-- classique.
--
-- Une publication qui naît sans son prend celui de son modèle, quel que soit le
-- chemin qui l’insère (à la main aujourd’hui, par un écran demain). Un son posé
-- à l’insertion n’est jamais écrasé.
--
-- Écrit sans instruction destructive ni apostrophe droite dans les
-- commentaires (pièges du MCP, voir 0297 et 0308) : `create or replace trigger`,
-- comme en 0302, pour ne rien supprimer avant de recréer.

create or replace function public.ugc_publication_son_du_modele()
returns trigger
language plpgsql
set search_path = public
as $f$
begin
  if new.musique_url is null and new.modele_id is not null then
    select m.musique_url into new.musique_url
      from public.ugc_modeles m
     where m.id = new.modele_id;
  end if;
  return new;
end
$f$;

create or replace trigger ugc_publications_son_du_modele
  before insert on public.ugc_publications
  for each row execute function public.ugc_publication_son_du_modele();
