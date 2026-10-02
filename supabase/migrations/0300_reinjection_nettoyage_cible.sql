-- 0300 — Réinjection de 22 slideshows rejetés, nettoyage ciblé de flashka_es,
-- essai à blanc des variantes (02/10/2026, demande d'Adrien).
--
-- Appliquée par `execute_sql` (piège du MCP, 0297). Les écritures de données
-- sont décrites ici, pas rejouables : elles lisaient le résultat d'un essai
-- `essai-pertinence` rangé dans `net._http_response`, purgé depuis.
--
-- 1. RÉINJECTION. Re-notés avec le prompt de 0299, 74 des 94 rejetés
--    `elo_insuffisant` des sources actives passaient le seuil. Adrien en a fait
--    rentrer 22 : luna.study4 (13), flashka_es (8), user5507909029330 (1) —
--    pas jeanne.wilgo (44), à trancher. État d'avant et note de l'essai dans
--    `reinjection_0300`. Chaque slideshow repart à l'étape `pertinence` avec la
--    note de l'essai (même prompt, pas de second appel), `statut = brouillon` :
--    le pipeline refait la note d'import, le tier d'entrée, le nettoyage, et
--    s'arrête dans la file. Retour arrière : recopier `etat_avant`.
--
-- 2. FLASHKA_ES. Ses slides reposent sur des VIGNETTES : le logo de l'IA notée
--    (ChatGPT, Gemini, Meta AI) et une copie notée (5/10, 4/10, 3/10 ; 10/10 et
--    100 % sur la dernière). Le texte ajouté n'est qu'une courte légende
--    (« Burlas... », « Risas... », « memes... », « Y ahora... »). Sur les 4
--    flashka déjà validés, le nettoyage de l'import avait TOUT effacé : logo,
--    note, copies. Les 8 réinjectés passent par `nettoyage-cible` : un modèle
--    sépare ce qu'il faut effacer de ce qu'il faut garder, le masque est rogné
--    hors des zones à garder, `fal-ai/bria/eraser` ne reconstruit que sous le
--    masque. Sur la dernière slide, le logo flashka est effacé, les copies
--    restent. Relu par `decrire-images` : 35 propres sur 40 au premier passage,
--    2 reprises, 2 retouches légères laissées (8b92903d #2, f772e9cb #5), et 3
--    « restes » qui sont le texte imprimé de la copie elle-même.
--    Les propres sont écrits au chemin de l'import (`propre/<id>/<pos>`) avec
--    `exclu_concurrent = true` : l'import les reprend (`trouverPropreExistant`)
--    et ils ne garnissent aucun autre slideshow. Le texte de chaque slide
--    (`texte_original`) ne porte plus que la légende ajoutée ; la dernière dit
--    « la app micabo » (+ les emojis ou « A callar » d'origine).
--
-- 3. ESSAI DES VARIANTES. `essai-variations` écrit dans `essai_variations` et
--    nulle part ailleurs.

create table if not exists public.reinjection_0300 (
  contenu_id uuid primary key,
  source text not null,
  etat_avant jsonb not null,
  pertinence_essai numeric,
  raison_essai text,
  fait_le timestamptz not null default now()
);
alter table public.reinjection_0300 enable row level security;

create table if not exists public.nettoyage_cible (
  id uuid primary key default gen_random_uuid(),
  contenu_id uuid not null,
  position int not null,
  ecrit boolean not null default false,
  resultat jsonb not null,
  fait_le timestamptz not null default now()
);
alter table public.nettoyage_cible enable row level security;

create table if not exists public.essai_variations (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null,
  n int not null,
  resultat jsonb,
  erreur text,
  cree_le timestamptz not null default now(),
  fini_le timestamptz
);
alter table public.essai_variations enable row level security;
