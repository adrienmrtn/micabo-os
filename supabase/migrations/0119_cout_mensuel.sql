-- Coût mensuel d'un créateur ou d'un recruteur (ce qu'il coûte par mois, en €),
-- saisi par l'admin, affiché sur la page Posters. Purement informatif.
alter table public.profiles
  add column if not exists cout_mensuel numeric;
