-- Voix ElevenLabs propre à chaque master FR.
alter table public.papier_masters
  add column if not exists voice text not null default 'George';

comment on column public.papier_masters.voice is
  'Voix ElevenLabs du master (FR). Les autres langues suivent, sauf surcharge dans les réglages.';

update public.papier_masters m
set voice = l.voice
from public.papier_langues l
where l.master_id = m.id
  and l.langue = 'fr'
  and l.voice is not null
  and l.voice <> ''
  and m.voice = 'George';
