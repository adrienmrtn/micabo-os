-- Reprise des decks désalignés par l'éditeur de file (0279, 29/09/2026).
--
-- Voir `_shared/deck_structure.ts` pour le mécanisme. En deux mots : supprimer
-- une slide dans `/admin/file` réécrivait `structure_slides` (N-1 images,
-- renumérotées) mais poussait les textes POSITION PAR POSITION via
-- `majTexteSlideDeck`, qui ne sait qu'écraser une position. Le tableau n'était
-- jamais raccourci, et seul le deck SOURCE était touché.
--
-- Trois slideshows sur 175 validés, 13 decks de langue. Aucun dans l'autre sens.
--
-- **Deux reprises différentes, et c'est le point de cette migration** : une
-- troncature en aveugle aurait détruit trois decks.
--
--  1. **Tronquer** quand la queue au-delà de la structure est un DOUBLON de
--     l'entrée précédente et ne porte PAS le CTA micabo. C'est la signature du
--     défaut : l'éditeur a réécrit les positions 1..N avec les textes validés
--     par l'admin, et la N+1 est restée telle quelle — donc égale à la N. Les
--     positions 1..N sont justes par construction, on coupe la queue.
--
--  2. **Vider** sinon. Sur `0b9ce977`, `placerSophiaSurDeck` a écrit le CTA
--     DANS la 9ᵉ entrée en fr et en tr, et a décalé l'outro en es. Couper à 8
--     ferait perdre le placement micabo au français et au turc. On ne devine
--     pas : `assurerDeckPourLangue` les refera depuis la source corrigée, avec
--     le prompt courant. C'est du crédit Gemini, pas du contenu perdu — la
--     règle déjà écrite au dépôt pour une bascule dont l'alignement a bougé.
--
-- Sauvegarde d'abord (leçon de 0262) : la reprise fusionne des états, l'inverse
-- ne serait qu'une reconstruction.

create table if not exists public.decks_desalignes_sauvegarde (
  id bigserial primary key,
  fait_le timestamptz not null default now(),
  surface text not null,
  ligne_id text not null,
  colonne text not null,
  valeur text
);

comment on table public.decks_desalignes_sauvegarde is
  'État d''avant la reprise 0279 des decks désalignés par l''éditeur de file.';

-- Ce que chaque deck doit devenir, décidé ligne par ligne sur les données.
-- Table ordinaire et non temporaire : rien ne garantit que la migration passe
-- en une seule transaction, et un `on commit drop` disparaîtrait au premier
-- point de commit — les étapes suivantes tomberaient sur une table absente.
drop table if exists public.reprise_0279;
create table public.reprise_0279 as
select cl.id as deck_id,
       cl.contenu_id,
       cl.langue,
       jsonb_array_length(c.structure_slides) as n_img,
       case
         when coalesce((
                select bool_and(e->>'texte_overlay'
                         is not distinct from (cl.slides -> ((ord - 2)::int) ->> 'texte_overlay'))
                  from jsonb_array_elements(cl.slides) with ordinality t(e, ord)
                 where ord > jsonb_array_length(c.structure_slides)), false)
          and not coalesce((
                select bool_or((e->>'position_sophia')::boolean)
                  from jsonb_array_elements(cl.slides) with ordinality t(e, ord)
                 where ord > jsonb_array_length(c.structure_slides)), false)
         then 'tronquer'
         else 'vider'
       end as geste
  from public.contenu_langues cl
  join public.contenus c on c.id = cl.contenu_id
 where jsonb_typeof(c.structure_slides) = 'array'
   and jsonb_array_length(cl.slides) > jsonb_array_length(c.structure_slides);

insert into public.decks_desalignes_sauvegarde (surface, ligne_id, colonne, valeur)
select 'contenu_langues', r.deck_id::text, 'slides', cl.slides::text
  from public.reprise_0279 r join public.contenu_langues cl on cl.id = r.deck_id;

-- 1 — Tronquer : garder les n_img premières entrées, renumérotées 1..n_img.
update public.contenu_langues cl
   set slides = coalesce((
         select jsonb_agg(jsonb_set(e, '{position}', to_jsonb(ord)) order by ord)
           from jsonb_array_elements(cl.slides) with ordinality t(e, ord)
          where ord <= r.n_img), '[]'::jsonb)
  from public.reprise_0279 r
 where cl.id = r.deck_id and r.geste = 'tronquer';

-- 2 — Vider : l'alignement n'est pas reconstituable sans deviner.
update public.contenu_langues cl
   set slides = '[]'::jsonb
  from public.reprise_0279 r
 where cl.id = r.deck_id and r.geste = 'vider';

-- 3 — Le passage NON PUBLIÉ déjà fabriqué depuis un deck troué part ce soir avec
-- sa slide sans visuel. On retire l'entrée en trop plutôt que le passage : le
-- créateur garde son post, et le trou disparaît. Les PUBLIÉS ne sont jamais
-- touchés — 10 posts des 27 et 28/09 gardent leur slide vide, c'est un fait.
insert into public.decks_desalignes_sauvegarde (surface, ligne_id, colonne, valeur)
select 'post_slides', ps.id::text, 'ligne',
       jsonb_build_object('post_id', ps.post_id, 'position', ps.position,
                          'texte_overlay', ps.texte_overlay)::text
  from public.post_slides ps
  join public.passages p on p.post_id = ps.post_id
  join public.contenus c on c.id = p.contenu_id
 where p.statut <> 'publie'
   and ps.media_id is null
   and ps.position > jsonb_array_length(c.structure_slides);

insert into public.decks_desalignes_sauvegarde (surface, ligne_id, colonne, valeur)
select 'passages', p.id::text, 'slides', p.slides::text
  from public.passages p
  join public.contenus c on c.id = p.contenu_id
 where p.statut <> 'publie'
   and jsonb_array_length(p.slides) > jsonb_array_length(c.structure_slides);

delete from public.post_slides ps
 using public.passages p, public.contenus c
 where p.post_id = ps.post_id
   and c.id = p.contenu_id
   and p.statut <> 'publie'
   and ps.media_id is null
   and ps.position > jsonb_array_length(c.structure_slides);

update public.passages p
   set slides = coalesce((
         select jsonb_agg(jsonb_set(e, '{position}', to_jsonb(ord)) order by ord)
           from jsonb_array_elements(p.slides) with ordinality t(e, ord)
          where ord <= jsonb_array_length(c.structure_slides)), '[]'::jsonb)
  from public.contenus c
 where c.id = p.contenu_id
   and p.statut <> 'publie'
   and jsonb_array_length(p.slides) > jsonb_array_length(c.structure_slides);

-- Les rendus brûlés sont rangés par (contenu, position) : à partir de la
-- suppression ils portent le texte d'une autre slide.
delete from public.burn_rendus b
 using public.reprise_0279 r
 where b.contenu_id = r.contenu_id;

drop table if exists public.reprise_0279;
