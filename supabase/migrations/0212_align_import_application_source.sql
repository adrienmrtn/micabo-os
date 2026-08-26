-- Rattrapage : un import de compte Micabo écrivait contenus / médias / file
-- avec le défaut Sophia. On ré-aligne sur l'application de la source.

update public.contenus c
set application_id = cr.application_id
from public.comptes_reference cr
where c.compte_reference_id = cr.id
  and c.application_id is distinct from cr.application_id
  and not exists (
    select 1 from public.contenus other
    where other.application_id = cr.application_id
      and other.source_url is not distinct from c.source_url
      and other.id <> c.id
      and other.source_url is not null
  );

update public.media_library m
set application_id = c.application_id
from public.contenus c
where m.contenu_id = c.id
  and m.application_id is distinct from c.application_id;

update public.import_file f
set application_id = cr.application_id
from public.comptes_reference cr
where f.compte_reference_id = cr.id
  and f.application_id is distinct from cr.application_id;
