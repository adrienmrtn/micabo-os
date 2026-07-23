-- Audit des images « propres » : certaines, nettoyées avant l'ajout de la
-- vérification, portent encore du texte tout en étant rangées dans propre/.
--  - verifie_le : quand l'image a été contrôlée (au stockage ou par l'audit).
--  - texte_restant : l'audit a vu du texte -> l'image est écartée du pipeline
--    et affichée « texte présent » dans la bibliothèque, à re-nettoyer.
alter table public.media_library
  add column if not exists verifie_le timestamptz,
  add column if not exists texte_restant boolean not null default false;
