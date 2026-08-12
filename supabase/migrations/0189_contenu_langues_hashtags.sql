-- Hashtags (légende TikTok) produits avec la traduction du deck, par langue.
-- Avant : jeu localisé statique à l'assignation. Maintenant : adaptés au sujet
-- via translateSlideshow, stockés ici pour réutilisation aux passages suivants.
alter table public.contenu_langues
  add column if not exists hashtags text;

comment on column public.contenu_langues.hashtags is
  'Légende TikTok (≈3 hashtags) générée/adaptée avec la traduction du deck.';
