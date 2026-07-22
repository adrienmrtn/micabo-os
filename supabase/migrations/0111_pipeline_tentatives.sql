-- Compteur de tentatives du pipeline sur un post. Sert à re-tenter une étape
-- fragile (placement Sophia) au passage suivant du cron plutôt que d'abandonner
-- au premier échec passager de Gemini — tout en bornant les reprises pour ne pas
-- boucler indéfiniment si l'échec est réel.
alter table public.posts
  add column if not exists pipeline_tentatives integer not null default 0;
