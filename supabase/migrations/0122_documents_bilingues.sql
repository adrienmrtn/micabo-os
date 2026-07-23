-- Documents bilingues : `contenu`/`titre` = version FRANÇAISE (défaut),
-- `contenu_en`/`titre_en` = version ANGLAISE. Le viewer suit la langue de
-- l'interface et retombe sur le français si l'anglais n'est pas rempli.
alter table public.documents
  add column if not exists titre_en text,
  add column if not exists contenu_en text;
