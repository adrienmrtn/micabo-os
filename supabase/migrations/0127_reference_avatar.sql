-- Photo de profil PRÉPARÉE À L'AVANCE pour chaque compte de référence.
--
-- Choisir l'avatar au moment de la création d'un poster imposait un appel Gemini
-- de détection de visage à la volée (lent, sujet aux 429) et pouvait échouer si
-- la source n'avait encore aucune image nettoyée. On prépare donc, la nuit, une
-- image sans visage identifiable par source ; la création se contente de la
-- copier. `avatar_media_id` garde la trace du visuel choisi (comptage d'usage).
alter table public.comptes_reference
  add column if not exists avatar_url text,
  add column if not exists avatar_media_id uuid references public.media_library(id) on delete set null;
