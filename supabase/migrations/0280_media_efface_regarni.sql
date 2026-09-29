-- Un `media_id` effacé bloquait le garnissage au lieu de le déclencher
-- (0280, 29/09/2026).
--
-- Deuxième cause des slides sans image, distincte du désalignement de 0279 :
-- ici les deux listes ont la même longueur, c'est la CIBLE qui a disparu.
-- `structure_slides` porte un `media_id` dont la ligne `media_library` n'existe
-- plus.
--
-- `resoudreVisuelsAssignation` sait pourtant garnir une slide vide depuis la
-- bibliothèque du label — 740 images disponibles sur `classic-study`. Mais son
-- test était `if (s.media_id)` : il faisait confiance à l'identifiant sans
-- vérifier la ligne. Une référence pendue passait donc pour « image stockée
-- (pinned ou import) », court-circuitait le garnissage, et le `left join` de
-- `creer_publication_atomique` écrivait NULL. **Le mécanisme de secours existait
-- et était désarmé par le cas même qu'il aurait dû couvrir.**
--
-- Le correctif est dans `visuels_assignation.ts` : les ids de la structure sont
-- relus en une requête, et un id absent tombe dans le garnissage avec un motif
-- distinct (« média effacé remplacé — … ») pour que ça se voie dans
-- `passages.visuels_resolution`.
--
-- **Ce n'est pas la pré-vérification d'existence retirée par 0265.** Celle-là
-- gardait une ÉCRITURE et ouvrait une fenêtre où une FK violée passait. Ici on
-- est dans le résolveur, dont le métier est de choisir un média et qui lit déjà
-- la biblio du label. Si la ligne disparaît entre la lecture et l'écriture, le
-- `left join` écrit NULL comme aujourd'hui : aucune garantie perdue.
--
-- Cette migration fait les deux reprises que le code ne peut pas faire seul.

create table if not exists public.media_efface_sauvegarde (
  id bigserial primary key,
  fait_le timestamptz not null default now(),
  surface text not null,
  ligne_id text not null,
  colonne text not null,
  valeur text
);

comment on table public.media_efface_sauvegarde is
  'Etat d''avant la reprise 0280 des references media pendues.';

-- 1 — Nettoyer les identifiants pendus de `structure_slides`.
--
-- Le résolveur les gère désormais, mais les laisser en base reste un piège pour
-- tout chemin qui lirait la structure sans repasser par lui — et l'éditeur de
-- file affiche une slide « pourvue » qui ne l'est pas. `media_id = null` dit la
-- vérité : cette slide est à garnir. Même geste que 0277 avec `cold-study` —
-- on ne laisse pas traîner la référence qui a causé le défaut.
insert into public.media_efface_sauvegarde (surface, ligne_id, colonne, valeur)
select 'contenus', c.id::text, 'structure_slides', c.structure_slides::text
  from public.contenus c
 where jsonb_typeof(c.structure_slides) = 'array'
   and exists (
     select 1 from jsonb_array_elements(c.structure_slides) e
      where e->>'media_id' is not null
        and not exists (select 1 from public.media_library m where m.id = (e->>'media_id')::uuid));

update public.contenus c
   set structure_slides = (
     select jsonb_agg(
              case when e->>'media_id' is not null
                    and not exists (select 1 from public.media_library m
                                     where m.id = (e->>'media_id')::uuid)
                   then e - 'media_id'
                   else e
              end
              order by ord)
       from jsonb_array_elements(c.structure_slides) with ordinality t(e, ord))
 where jsonb_typeof(c.structure_slides) = 'array'
   and exists (
     select 1 from jsonb_array_elements(c.structure_slides) e
      where e->>'media_id' is not null
        and not exists (select 1 from public.media_library m where m.id = (e->>'media_id')::uuid));

-- 2 — Boucher les trous des posts NON PUBLIÉS déjà fabriqués.
--
-- Le correctif ne vaut que pour les assignations à venir ; ces deux-là sont
-- déjà en base, dont une qui part ce soir. On tire dans la biblio du label du
-- slideshow — hook pour la position 1, pool sinon, jamais un média déjà présent
-- dans le même post : exactement le repli de `tirerMediaParCritere`.
--
-- On remplit plutôt que de supprimer le passage : le créateur garde son post,
-- et le vieux passage du 12/09 appartient à un cycle qu'on ne rouvre pas.
-- Les PUBLIÉS ne sont jamais touchés.
insert into public.media_efface_sauvegarde (surface, ligne_id, colonne, valeur)
select 'post_slides', ps.id::text, 'media_id', null
  from public.post_slides ps
  join public.passages p on p.post_id = ps.post_id
 where p.statut <> 'publie' and ps.media_id is null;

with trous as (
  select ps.id as slide_id, ps.post_id, ps.position, p.contenu_id
    from public.post_slides ps
    join public.passages p on p.post_id = ps.post_id
   where p.statut <> 'publie' and ps.media_id is null
),
choix as (
  select t.slide_id,
         (select m.id
            from public.contenu_labels cl
            join public.media_labels ml on ml.label_id = cl.label_id
            join public.media_library m on m.id = ml.media_id
           where cl.contenu_id = t.contenu_id
             and m.storage_path like 'propre/%'
             and m.texte_restant = false
             and m.est_hook = (t.position = 1)
             and not exists (select 1 from public.post_slides d
                              where d.post_id = t.post_id and d.media_id = m.id)
           order by random()
           limit 1) as media_id
    from trous t
)
update public.post_slides ps
   set media_id = c.media_id
  from choix c
 where ps.id = c.slide_id and c.media_id is not null;
