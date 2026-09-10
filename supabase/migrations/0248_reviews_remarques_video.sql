-- Retours génériques illustrés par une courte vidéo.
--
-- Les puces vivent dans le réglage `review_quotidienne_remarques` et portent
-- désormais un `id` stable plus une `video_url`. La review, elle, garde une
-- COPIE des puces employées : figer évite qu'un retour déjà parti change de
-- sens (ou pointe une vidéo supprimée) parce qu'on a retouché la puce depuis.
-- Même raison que `publie_url` / `source_url`, déjà des snapshots.

alter table public.reviews
  add column if not exists remarques jsonb not null default '[]'::jsonb;

comment on column public.reviews.remarques is
  'Copie des puces génériques employées : [{id, titre, corps, video_url}]. Figée à l''envoi.';

notify pgrst, 'reload schema';
