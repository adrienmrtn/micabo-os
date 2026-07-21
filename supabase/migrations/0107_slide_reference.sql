-- Visuel d'origine conservé sur la slide.
--
-- Le poster doit voir où le texte était posé sur l'image originale pour le
-- replacer au même endroit dans TikTok. Cette image vit dans `sujets`, table
-- volontairement interdite aux posters (elle nommerait le compte source). On
-- recopie donc la seule URL utile sur la slide, sans rien exposer d'autre.

alter table public.post_slides
  add column if not exists reference_url text;

-- Reprise des posts déjà fabriqués : on rapproche par position, la seule clé
-- commune entre une slide et la structure du sujet.
update public.post_slides ps
set reference_url = s.slide->>'raw_url'
from public.posts p
  join public.sujets su on su.id = p.sujet_id
  cross join lateral jsonb_array_elements(su.structure_slides) as s(slide)
where ps.post_id = p.id
  and ps.reference_url is null
  and (s.slide->>'position')::int = ps.position;
