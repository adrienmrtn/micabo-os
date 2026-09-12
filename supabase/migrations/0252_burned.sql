-- Comptes « burned » : le texte est incrusté sur les images, pas donné à part.
--
-- Pour ces comptes, le poster ne reçoit plus des images vierges accompagnées
-- d'un texte à replacer dans TikTok : il reçoit la slide finale, texte déjà
-- brûlé dessus. Le rendu est déterministe (voir `api/_burn_core.py`) et calé
-- sur le style mesuré sur l'image d'origine.
--
-- Deux caches, parce que les deux étapes coûtent cher et ne dépendent pas du
-- compte : l'analyse du style est faite UNE fois par slide d'origine, l'image
-- brûlée UNE fois par (slide, langue). Deux comptes qui publient le même
-- slideshow dans la même langue partagent le même fichier.
--
-- `texte_overlay` reste rempli : c'est le repli si le burn n'est pas prêt, et
-- la trace qui permet de relire ce qui a été incrusté.
--
-- Aucun cron n'est planifié ici. Conforme à AGENTS.md.

-- ---------------------------------------------------------------------------
-- Le drapeau, sur le compte
-- ---------------------------------------------------------------------------
alter table public.comptes
  add column if not exists burned boolean not null default false;

comment on column public.comptes.burned is
  'Le poster reçoit les slides avec le texte déjà incrusté (pas d''images vierges + texte à poser).';

-- ---------------------------------------------------------------------------
-- L'image brûlée, sur la slide
-- ---------------------------------------------------------------------------
alter table public.post_slides
  add column if not exists burned_media_id uuid
    references public.media_library (id) on delete set null,
  add column if not exists burned_at timestamptz,
  add column if not exists burn_erreur text;

comment on column public.post_slides.burned_media_id is
  'Image finale avec le texte incrusté. NULL = pas (encore) brûlée : le poster voit l''image propre + texte_overlay.';
comment on column public.post_slides.burn_erreur is
  'Dernier échec de burn pour cette slide. Le post reste livrable en classique.';

create index if not exists post_slides_a_bruler_idx
  on public.post_slides (post_id)
  where burned_media_id is null;

-- Le poster lit déjà `media_id` par l'usage ; il doit lire l'image brûlée pareil.
drop policy if exists media_select_slides on public.media_library;
create policy media_select_slides on public.media_library
  for select using (
    exists (
      select 1
      from public.post_slides ps
        join public.posts p on p.id = ps.post_id
        join public.comptes c on c.id = p.compte_id
      where (ps.media_id = media_library.id or ps.burned_media_id = media_library.id)
        and c.poster_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Cache 1 — analyse du style, une fois par slide d'origine
-- ---------------------------------------------------------------------------
create table if not exists public.burn_analyses (
  contenu_id uuid not null references public.contenus (id) on delete cascade,
  position integer not null,
  zones jsonb not null,
  modele text,
  created_at timestamptz not null default now(),
  primary key (contenu_id, position)
);

comment on table public.burn_analyses is
  'Zones de texte repérées par le LLM sur la slide d''origine (fractions 0..1, couleur, contour). Indépendant de la langue.';

alter table public.burn_analyses enable row level security;
create policy burn_analyses_admin on public.burn_analyses
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Cache 2 — image brûlée, une fois par (slide, langue)
-- ---------------------------------------------------------------------------
create table if not exists public.burn_rendus (
  contenu_id uuid not null references public.contenus (id) on delete cascade,
  position integer not null,
  langue text not null,
  media_id uuid references public.media_library (id) on delete set null,
  url text not null,
  texte text not null,
  rapport jsonb,
  created_at timestamptz not null default now(),
  primary key (contenu_id, position, langue)
);

comment on table public.burn_rendus is
  'Image finale par (slide d''origine, langue). Réutilisée telle quelle par tous les comptes qui publient ce slideshow dans cette langue.';
comment on column public.burn_rendus.rapport is
  'Réglages mesurés (taille, interlettrage, contour, interligne, coupures) — relecture QA d''un rendu.';

alter table public.burn_rendus enable row level security;
create policy burn_rendus_admin on public.burn_rendus
  for all using (public.is_admin()) with check (public.is_admin());
