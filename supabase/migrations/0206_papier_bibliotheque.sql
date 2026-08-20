-- Bibliothèque de masters FR complets.
-- Plus un master unique par jour : on en prépare plusieurs à l'avance.
-- La voix / vidéo des autres langues se crée à l'assignation (minuit), pas au pipeline.

alter table public.papier_masters
  drop constraint if exists papier_masters_date_unique;

alter table public.papier_masters
  add column if not exists video_url text;

alter table public.papier_masters
  add column if not exists video_path text;

comment on table public.papier_masters is
  'Bibliothèque de masters papier FR complets (script, clips, voix, karaoké). Localisation à l''assignation.';

comment on column public.papier_masters.date_publication is
  'Date de création (Paris). Plus unique : plusieurs masters le même jour.';

comment on column public.papier_masters.video_url is
  'Vidéo FR complète (voix + karaoké). Remplie quand le master entre en bibliothèque.';

create index if not exists papier_masters_created_idx
  on public.papier_masters (created_at desc);

create index if not exists papier_posts_master_langue_reel_idx
  on public.papier_posts (master_id, langue)
  where not est_test;

-- Masters déjà localisés en FR : ils rejoignent la bibliothèque.
update public.papier_masters m
set
  video_url = l.video_url,
  video_path = l.video_path,
  statut = 'ready',
  etape = 'ready',
  progression = 1
from public.papier_langues l
where l.master_id = m.id
  and l.langue = 'fr'
  and l.statut = 'ready'
  and l.video_url is not null
  and (m.video_url is null or m.statut <> 'ready');
