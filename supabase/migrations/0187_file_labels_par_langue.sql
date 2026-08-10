-- File des prochains comptes : files prioritaires par langue.
-- Shape `reglages.file_labels_comptes` :
--   {
--     "items": [{ "label_id", "ugc" }, ...],          -- file générale (fallback)
--     "par_langue": { "fr": [...], "de": [...] }      -- prioritaire si non vide
--   }
-- Priorité à la création d’un poster :
--   1) par_langue[langue]  2) items  3) label least-used dans la langue.
-- Pas de rewrite obligatoire : l’ancien { items } / { label_ids } reste lu.

update public.reglages
set valeur = coalesce(valeur, '{}'::jsonb) || jsonb_build_object(
  'par_langue',
  coalesce(valeur->'par_langue', '{}'::jsonb)
)
where cle = 'file_labels_comptes'
  and (valeur->'par_langue') is null;
