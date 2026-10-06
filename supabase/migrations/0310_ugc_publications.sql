-- 0310 — AI UGC : la vidéo du jour d’un compte vidéo (06/10/2026).
--
-- Décision d’Adrien du 06/10 : un compte AI UGC est un compte créateur
-- classique (login, calendrier, bouton « publié » avec le lien TikTok) qui
-- reçoit UNE vidéo par jour au lieu de slideshows. La vidéo est un MP4 complet
-- (la réaction refaite par le persona, rendue par Genjutsu de Higgsfield) ;
-- quand la source a une démo de l’appli, elle arrive en second MP4. Le texte
-- de la vidéo d’origine, traduit, est collé par le créateur dans TikTok, à
-- l’endroit que montre la capture.
--
-- Une table à part, et pas `posts` :
--   - `posts` passe par le quota du jour, la recharge (`revoquer-post`
--     réassignerait un SLIDESHOW), le relevé et la qualification, qui lisent
--     tous `passages` et des slides d’images. Un post vidéo y serait un
--     intrus que chaque chemin devrait apprendre à sauter,
--   - le moteur ne lit jamais cette table : un compte vidéo n’a aucun label,
--     donc aucun slideshow ne peut lui être tiré, et son warmup reste vide,
--     donc l’assignation, le relevé et la qualification ne le voient pas.
--
-- Les URL sont recopiées (bucket public) plutôt que lues par `media_library` :
-- le créateur n’a pas à lire `media_library`, et la publication garde la
-- vidéo qu’on lui a donnée. Ni le lien du TikTok d’origine ni le compte
-- source n’y sont : la page du créateur ne les montre pas (règle de
-- `posts_poster`).
--
-- Écrit sans instruction destructive ni apostrophe droite dans les commentaires (pièges du MCP,
-- voir 0297 et 0308).

create table if not exists public.ugc_publications (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null default public.application_id_micabo(),
  compte_id uuid not null references public.comptes(id) on delete cascade,
  date_publication_prevue date not null,
  modele_id uuid references public.ugc_modeles(id) on delete set null,
  persona_id uuid references public.ugc_personas(id) on delete set null,
  -- La vidéo à publier (réaction, démo comprise quand elle est dedans).
  video_media_id uuid references public.media_library(id) on delete set null,
  video_url text not null,
  -- La démo, quand elle est un second MP4.
  demo_media_id uuid references public.media_library(id) on delete set null,
  demo_url text,
  -- Le texte à coller dans TikTok, dans la langue du compte, et la capture
  -- de la vidéo d’origine qui montre où le poser.
  texte text not null default '',
  capture_url text,
  -- La légende du post TikTok (description et hashtags).
  legende text not null default '',
  musique_url text,
  statut text not null default 'assigne'
    check (statut in ('assigne', 'publie', 'annule')),
  publie_at timestamptz,
  publie_url text,
  vues integer,
  stats_maj_at timestamptz,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Une vidéo par jour et par compte (une annulée libère le jour).
create unique index if not exists ugc_publications_compte_jour_uidx
  on public.ugc_publications (compte_id, date_publication_prevue)
  where statut <> 'annule';

create index if not exists ugc_publications_jour_idx
  on public.ugc_publications (date_publication_prevue);

comment on table public.ugc_publications is
  'AI UGC (0310) : la vidéo du jour d’un compte vidéo. Jamais lue par le moteur des slideshows.';

alter table public.ugc_publications enable row level security;

create policy ugc_publications_admin on public.ugc_publications
  for all using (public.is_admin()) with check (public.is_admin());

-- Le créateur lit les publications de SES comptes. Il n’écrit que par
-- `ugc_publication_marquer`.
create policy ugc_publications_poster_select on public.ugc_publications
  for select using (
    exists (
      select 1 from public.comptes c
      where c.id = ugc_publications.compte_id
        and c.poster_id = auth.uid()
    )
  );

-- Publié (avec le lien TikTok) ou dépublié (lien nul). Rend la ligne, ou
-- rien si elle n’est pas au créateur, si elle est annulée, ou si le lien
-- n’est pas un lien TikTok : le front le lit comme un refus.
create or replace function public.ugc_publication_marquer(p_id uuid, p_url text)
returns setof public.ugc_publications
language sql
security definer
set search_path = public
as $f$
  update public.ugc_publications p
     set statut = case when nullif(btrim(p_url), '') is null then 'assigne' else 'publie' end,
         publie_at = case when nullif(btrim(p_url), '') is null then null else coalesce(p.publie_at, now()) end,
         publie_url = nullif(btrim(p_url), ''),
         updated_at = now()
   where p.id = p_id
     and p.statut <> 'annule'
     and (
       public.is_admin()
       or exists (
         select 1 from public.comptes c
         where c.id = p.compte_id and c.poster_id = auth.uid()
       )
     )
     and (
       nullif(btrim(p_url), '') is null
       or btrim(p_url) ~* '^https://([a-z0-9-]+[.])*tiktok[.]com/'
     )
  returning p.*
$f$;

revoke execute on function public.ugc_publication_marquer(uuid, text) from public, anon;
grant execute on function public.ugc_publication_marquer(uuid, text) to authenticated;
