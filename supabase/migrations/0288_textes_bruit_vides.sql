-- 0288 — Des slides portaient l'OCR brut d'une capture d'écran (01/10/2026).
--
-- Vu en relisant les slideshows de 0287 : sur `8e88d77c` (« Ces 4 méthodes qui
-- ont changé ma vie en tant que lycéenne »), le texte des slides 6 à 8 était
-- l'OCR intégral de l'image — une fiche de figures de style photographiée et
-- tronquée (« chion », « phores »), un agenda Google en portugais avec un
-- clavier entier (« Esc F1 F2… », 163 lignes), des notes de maths en russe
-- (188 lignes). Posé en texte superposé, c'est un mur illisible ; la
-- traduction allemande l'avait recopié sur les slides 6 et 7.
--
-- Décision d'Adrien : vider ces textes. La slide part avec son image, sans
-- texte superposé — l'image porte déjà le contenu.
--
-- Repérage : plus de 40 lignes ou 900 caractères sur un deck validé. Il a
-- ramassé 4 slides sur 123 slideshows, dont une à garder : `e7422935` slide 2
-- (« 5 techniques infaillibles pour réviser efficacement ») est un vrai texte,
-- seulement long. Ce n'est donc pas une règle à appliquer à l'aveugle : chaque
-- slide a été lue. Les CTA micabo (`de` p8, `es` p6) ne sont pas touchés, et
-- aucun post non publié ne portait ces textes.
--
-- Sauvegarde dans `textes_bruit_sauvegarde` (5 lignes). Gardes : slide hors
-- CTA et de plus de 30 lignes, sinon rien n'est écrit.
create table if not exists public.textes_bruit_sauvegarde (
  id bigserial primary key,
  contenu_langue_id uuid not null,
  contenu_id uuid not null,
  langue text not null,
  position integer not null,
  texte text,
  sauve_le timestamptz not null default now()
);
alter table public.textes_bruit_sauvegarde enable row level security;

insert into public.textes_bruit_sauvegarde (contenu_langue_id, contenu_id, langue, position, texte)
select cl.id, cl.contenu_id, cl.langue, (e->>'position')::int, e->>'texte_overlay'
from public.contenu_langues cl
cross join lateral jsonb_array_elements(cl.slides) e
where cl.contenu_id = '8e88d77c-fa89-4a92-bd83-94cc672ea6cb'
  and jsonb_typeof(cl.slides) = 'array'
  and (cl.langue, (e->>'position')::int) in (('fr', 6), ('fr', 7), ('fr', 8), ('de', 6), ('de', 7))
  and not coalesce((e->>'position_sophia')::boolean, false)
  and array_length(string_to_array(coalesce(e->>'texte_overlay', ''), E'\n'), 1) > 30;

update public.contenu_langues cl
set slides = (
  select jsonb_agg(
    case when (cl.langue, (e->>'position')::int) in (('fr', 6), ('fr', 7), ('fr', 8), ('de', 6), ('de', 7))
              and not coalesce((e->>'position_sophia')::boolean, false)
              and array_length(string_to_array(coalesce(e->>'texte_overlay', ''), E'\n'), 1) > 30
         then jsonb_set(e, '{texte_overlay}', to_jsonb(''::text))
         else e end
    order by o)
  from jsonb_array_elements(cl.slides) with ordinality as t(e, o))
where cl.contenu_id = '8e88d77c-fa89-4a92-bd83-94cc672ea6cb'
  and cl.langue in ('fr', 'de')
  and jsonb_typeof(cl.slides) = 'array';
