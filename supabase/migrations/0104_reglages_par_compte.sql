-- Réglages par compte et consignes par type de post.
--
-- Deux besoins : qu'un compte donné puisse ne faire que du recopiage sans
-- toucher aux réglages globaux, et que chaque type de post ait ses propres
-- consignes de rédaction.

-- null = on suit le réglage global. C'est ce qui permet de n'en surcharger
-- qu'un seul sans figer les autres.
alter table public.comptes
  add column if not exists repartition jsonb,
  add column if not exists posts_par_jour integer;

-- Trace de l'usage d'un visuel par un compte : deux comptes tirant de la même
-- source ne doivent pas publier les mêmes images.
create table if not exists public.media_usages (
  id uuid primary key default gen_random_uuid(),
  media_id uuid not null references public.media_library (id) on delete cascade,
  compte_id uuid not null references public.comptes (id) on delete cascade,
  post_id uuid references public.posts (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (media_id, compte_id)
);

create index if not exists media_usages_compte_idx on public.media_usages (compte_id);

alter table public.media_usages enable row level security;

create policy media_usages_admin on public.media_usages
  for all using (public.is_admin()) with check (public.is_admin());

grant select, insert, update, delete on public.media_usages to authenticated;
grant all on public.media_usages to service_role;

-- Consignes propres à chaque type de post, éditables depuis l'admin.
insert into public.prompts (cle, contenu) values
('composition_recycle',
'Ce post reprend un contenu qui a déjà bien marché sur ce compte.
Garde la structure et les idées telles quelles. Le texte doit rester très
proche de l''original : on rejoue ce qui a fonctionné, on ne le réinvente pas.'
),
('composition_nouveau',
'Ce post est inédit sur ce compte.
Tu as toute latitude sur la formulation, tant que le ton reste celui du compte.
Cherche l''accroche la plus directe possible dès la première slide.'
),
('composition_remanie',
'Ce post reprend un sujet déjà publié sur ce compte, mais avec des visuels
différents.
Reformule entièrement le texte : mêmes idées et même ordre, tournures et
exemples différents. Un lecteur qui aurait vu les deux ne doit pas avoir
l''impression de relire le même post.'
)
on conflict (cle) do nothing;
