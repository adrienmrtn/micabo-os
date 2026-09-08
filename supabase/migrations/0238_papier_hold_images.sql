-- Récupération de schéma (suite de 0237) : appliqué en prod le 01/09/2026
-- sous le nom `papier_hold_images`, sans fichier dans ce dépôt.
--
-- Hold manuel après les images (étape créative) + commentaires à jour.

alter table public.papier_masters
  drop constraint if exists papier_masters_hold_check;

alter table public.papier_masters
  drop constraint if exists papier_masters_pipeline_hold_check;

alter table public.papier_masters
  add constraint papier_masters_pipeline_hold_check
  check (pipeline_hold is null or pipeline_hold in ('topic', 'script', 'images'));

comment on column public.papier_masters.pipeline_mode is
  'auto = enchaîne tout ; manuel = validation sujet, script, puis images.';

comment on column public.papier_masters.pipeline_hold is
  'Étape en attente de validation admin (topic | script | images).';
