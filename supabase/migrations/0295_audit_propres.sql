-- 0295 — Audit des images « propres » : reste-t-il du texte incrusté ? (02/10/2026)
--
-- Le 02/10, `85379b9e` est parti en allemand avec du texte FRANÇAIS sur ses
-- slides : le deck `de` était troué (0294), et le texte d'origine était encore
-- dans l'image « propre ». La légende Florence de `propre/85379b9e…/3.jpg` lit
-- « Dermatologie 9/10 ».
--
-- `media_library.texte_restant` ne dit rien : l'import écrit `false` après
-- chaque nettoyage, sans rien vérifier (`import_contenu.ts`, stockage du
-- propre). Les 1 208 images propres sont toutes marquées « sans texte ».
--
-- La fonction `audit-propres` relit chaque image avec le modèle de vision et
-- range ici son verdict. Elle n'écrit nulle part ailleurs : aucune image, aucun
-- drapeau `texte_restant` ne bouge tant qu'Adrien n'a pas vu le résultat.
--
-- RLS active, aucune policy : seul le `service_role` lit et écrit.

create table if not exists public.audit_propres_0295 (
  media_id uuid primary key,
  contenu_id uuid,
  position integer,
  reste text not null,          -- 'aucun' | 'partiel' | 'complet' | 'erreur'
  extrait text,                 -- le texte incrusté encore lisible, tel quel
  reference text,               -- le texte du deck source à cette position
  modele text,
  erreur text,
  fait_le timestamptz not null default now()
);
alter table public.audit_propres_0295 enable row level security;
