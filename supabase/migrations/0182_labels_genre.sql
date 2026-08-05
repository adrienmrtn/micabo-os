-- Genre explicite sur chaque label → prénoms / noms TikTok des posters.
-- La marque système `ugc-ai-video` n'est PAS un label thématique (checkmark compte/HM).

alter table public.labels
  add column if not exists genre text;

alter table public.labels
  drop constraint if exists labels_genre_check;

alter table public.labels
  add constraint labels_genre_check
  check (genre is null or genre in ('homme', 'femme'));

comment on column public.labels.genre is
  'Genre imposé pour l’identité TikTok (prénoms) des créateurs portant ce label.';

-- Backfill heuristique (même logique que label_theme.genreDuLabel).
update public.labels
set genre = case
  when slug ~* '(alpha|male|homme)' and slug !~* '(girl|femme|woman)' then 'homme'
  when nom ~* '(alpha|male|homme)' and nom !~* '(girl|femme|woman|fille)' then 'homme'
  when slug ~* '(girl|femme|woman|clean|smart)' then 'femme'
  when nom ~* '(girl|femme|woman|fille|clean|smart)' then 'femme'
  else null
end
where genre is null
  and slug is distinct from 'ugc-ai-video';

-- Défaut femme pour les labels thématiques encore sans genre.
update public.labels
set genre = 'femme'
where genre is null
  and slug is distinct from 'ugc-ai-video';

-- Retirer la marque système des compte_labels (le checkmark = comptes.ugc_ai_video).
delete from public.compte_labels cl
using public.labels l
where cl.label_id = l.id
  and l.slug = 'ugc-ai-video';

notify pgrst, 'reload schema';
