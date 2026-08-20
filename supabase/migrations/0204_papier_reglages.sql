-- Phase 5 : réglages papier (durée, voix, pause, quota Fal / jour Paris).

insert into public.reglages (cle, valeur)
values (
  'papier',
  jsonb_build_object(
    'actif', true,
    'duree_cible_sec', 48,
    'duree_clip', 'auto',
    'voix', 'George',
    'voix_par_langue', '{}'::jsonb,
    'fal_quota_jour', 300
  )
)
on conflict (cle) do nothing;

insert into public.reglages (cle, valeur)
values (
  'papier_fal_usage',
  jsonb_build_object('date', null, 'appels', 0)
)
on conflict (cle) do nothing;
