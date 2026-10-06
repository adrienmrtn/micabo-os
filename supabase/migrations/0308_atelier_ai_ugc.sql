-- 0308 — Atelier AI UGC, premier lot (06/10/2026).
--
-- Un post AI UGC, ce sont deux vidéos et un texte : la RÉACTION d’un TikTok
-- source refaite par le persona du compte (Nano Banana pose le persona dans la
-- première image, Kling motion control lui fait refaire le mouvement), une
-- DÉMO de l’appli micabo prise dans une bibliothèque par langue, et le texte
-- de la vidéo d’origine que le créateur colle dans TikTok.
--
-- Ce premier lot est un ATELIER, isolé du moteur : on importe des modèles, on
-- rend des réactions, on les juge. Rien ici n’est lu par l’assignation, et
-- aucun `contenus` n’est créé : un modèle n’entre dans le pool qu’au lot 2,
-- quand il devient un contenu (`ugc_modeles.contenu_id`) avec ses decks par
-- langue et le label `ai-ugc`. Le label n’est PAS créé ici : né sans compte,
-- il serait le « moins utilisé » du repli de `manage-users` et partirait sur
-- le premier compte classique créé (le piège de 0277 et du 06/10).
--
-- Trois tables, rien de modifié ailleurs :
--   - `ugc_modeles` : la vidéo TikTok source, sa coupe (le segment réaction),
--     l’image de départ du rendu et les textes lus (OCR) par segment,
--   - `ugc_rendus`  : une réaction rendue pour un persona (Nano Banana puis
--     Kling), avec son coût, son statut et le jugement de l’admin,
--   - `ugc_demos`   : les démos micabo, par langue (l’appli d’une démo
--     française ne va pas sur un compte turc).
--
-- Les vidéos livrables (rendus, démos) sont des lignes `media_library`, pour
-- que le lot 2 les pose dans `post_slides.media_id` comme une image : elles
-- naissent avec `upscale_le` posé (l’upscale ne lit que des images) et sans
-- label (aucun pool de garnissage ne les voit).
--
-- Écrit sans point-virgule ni apostrophe droite dans les chaînes ni les
-- commentaires : le découpeur du MCP les compte (voir 0297). Et sans `drop`,
-- même `drop policy if exists` : le MCP le prend pour une instruction
-- destructive, attend une confirmation humaine et abandonne à 60 s (vu ici).
-- Les tables naissent dans cette migration, leurs policies aussi.

create table if not exists public.ugc_modeles (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null default public.application_id_micabo(),
  titre text not null default '',
  source_url text not null,
  tiktok_post_id text,
  auteur text,
  legende_source text,
  vues_source integer,
  musique_url text,
  musique_titre text,
  -- La vidéo TikTok entière, telle que téléchargée (pour recouper).
  source_path text,
  source_duree_ms integer,
  largeur integer,
  hauteur integer,
  -- Planche : une image toutes les ~0,5 s, URL Fal + instant, pour choisir la
  -- coupe à l’œil. Les URL Fal ne sont pas éternelles : elle sert à l’import.
  planche jsonb not null default '[]'::jsonb,
  -- Coupe proposée par le modèle de vision, puis celle retenue.
  coupe_proposee jsonb,
  reaction_debut_s numeric(7,3),
  reaction_fin_s numeric(7,3),
  -- Le segment réaction, coupé sans recodage : la vidéo de mouvement de Kling.
  reaction_path text,
  -- Première image du segment (avec texte) et la même, texte retiré.
  image_ref_path text,
  image_propre_path text,
  -- Textes lus sur la vidéo, par segment : [{segment, texte}].
  textes jsonb not null default '[]'::jsonb,
  -- `a_couper` sans `source_path` ni `erreur` : import en cours.
  statut text not null default 'a_couper'
    check (statut in ('a_couper', 'pret', 'archive')),
  erreur text,
  -- Lot 2 : le contenu né de ce modèle quand il entre dans le pool.
  contenu_id uuid unique references public.contenus(id) on delete set null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists ugc_modeles_tiktok_uidx
  on public.ugc_modeles (application_id, tiktok_post_id)
  where tiktok_post_id is not null;

comment on table public.ugc_modeles is
  'AI UGC (0308) : une vidéo TikTok réaction + démo. On garde la réaction comme modèle de mouvement, on jette la démo.';

create table if not exists public.ugc_rendus (
  id uuid primary key default gen_random_uuid(),
  modele_id uuid not null references public.ugc_modeles(id) on delete cascade,
  persona_id uuid not null references public.ugc_personas(id) on delete cascade,
  moteur text not null
    check (moteur in ('kling-v2.6-pro', 'kling-v2.6-standard', 'kling-v3-pro', 'kling-v3-standard')),
  -- persona : le persona dans SA chambre (ses images de référence).
  -- source  : le persona à la place de la personne, dans le décor d’origine.
  decor text not null default 'persona' check (decor in ('persona', 'source')),
  statut text not null default 'en_cours'
    check (statut in ('en_cours', 'a_valider', 'valide', 'rejete', 'echec')),
  etape text not null default 'image'
    check (etape in ('image', 'kling', 'fini')),
  image_persona_path text,
  fal_endpoint text,
  fal_request_id text,
  fal_status_url text,
  fal_response_url text,
  kling_soumis_at timestamptz,
  video_media_id uuid references public.media_library(id) on delete set null,
  duree_ms integer,
  cout_usd numeric(8, 3),
  erreur text,
  motif_rejet text,
  valide_at timestamptz,
  -- uuid nu, sans clé étrangère : règle de 0255.
  valide_par uuid,
  -- Lot 2 : le passage qui a consommé ce rendu.
  passage_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ugc_rendus_modele_idx on public.ugc_rendus (modele_id);
create index if not exists ugc_rendus_persona_idx on public.ugc_rendus (persona_id);
create index if not exists ugc_rendus_kling_idx on public.ugc_rendus (kling_soumis_at)
  where statut = 'en_cours' and etape = 'kling';

-- Un seul rendu vivant par modèle, persona, moteur et décor : un double clic
-- ne paie pas deux fois Kling.
create unique index if not exists ugc_rendus_vivant_uidx
  on public.ugc_rendus (modele_id, persona_id, moteur, decor)
  where statut in ('en_cours', 'a_valider', 'valide');

comment on table public.ugc_rendus is
  'AI UGC (0308) : une réaction rendue pour un persona. Nano Banana puis Kling motion control, MP4 sans métadonnées, jugé par un admin.';

create table if not exists public.ugc_demos (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null default public.application_id_micabo(),
  titre text not null default '',
  langue text not null,
  media_id uuid not null references public.media_library(id) on delete cascade,
  duree_ms integer,
  actif boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists ugc_demos_langue_idx on public.ugc_demos (langue) where actif;

comment on table public.ugc_demos is
  'AI UGC (0308) : démos de l’appli micabo, par langue de l’appli. MP4 sans métadonnées.';

alter table public.ugc_modeles enable row level security;
alter table public.ugc_rendus enable row level security;
alter table public.ugc_demos enable row level security;

create policy ugc_modeles_admin on public.ugc_modeles
  for all using (public.is_admin()) with check (public.is_admin());

create policy ugc_rendus_admin on public.ugc_rendus
  for all using (public.is_admin()) with check (public.is_admin());

create policy ugc_demos_admin on public.ugc_demos
  for all using (public.is_admin()) with check (public.is_admin());
