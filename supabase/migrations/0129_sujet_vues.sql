-- Nombre de vues du TikTok d'origine, capturé à l'extraction. Sert à trier et
-- afficher les « posts reproduisibles » (un post qui a bien marché est un bon
-- candidat à la reproduction). Null pour les sujets extraits avant cette colonne.
alter table public.sujets
  add column if not exists vues bigint;
