-- La musique est récupérée à l'extraction, sur le post source. Elle doit donc
-- être portée par le sujet avant d'atterrir sur le post composé.
alter table public.sujets
  add column if not exists musique_url text,
  add column if not exists musique_titre text,
  add column if not exists musique_plateforme text,
  -- Étape de préparation : OCR, pertinence, nettoyage des visuels.
  add column if not exists preparation_statut text not null default 'pending'
    check (preparation_statut in ('pending', 'running', 'done', 'failed')),
  add column if not exists preparation_erreur text;

create index if not exists sujets_preparation_idx
  on public.sujets (preparation_statut, created_at);
