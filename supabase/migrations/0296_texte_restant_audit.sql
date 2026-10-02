-- 0296 — Les images propres où l'audit (0295) lit encore du texte sortent des
-- pools (02/10/2026, OK d'Adrien).
--
-- `texte_restant = true` sur les 82 images où le modèle lit des mots ou le
-- filigrane Xiaohongshu (`小红书号`). Pas les 47 où il ne reste qu'un numéro ou
-- un emoji, pas les 8 calques « Micabo Education » posés dans la file.
--
-- Ce que ça change :
-- - `chargerBiblioLabel` (garnissage d'une slide sans image) ne les tire plus.
--   44 d'entre elles n'y étaient que par là, y compris des images de
--   slideshows REJETÉS, avec du français entier dessus ;
-- - les autres pools (`variations`, `media_labels`, avatars) non plus ;
-- - elles apparaissent dans « échecs de nettoyage » côté admin.
--
-- Ce que ça NE change pas : les posts de leur propre slideshow, qui lisent
-- `structure_slides` sans regarder ce drapeau (`resoudreVisuelsAssignation`).
-- Ceux-là passent par `renettoyer-contenu` (même chemin de stockage, même ligne
-- `media_library`, drapeau remis à false si le nettoyage aboutit).
--
-- `texte_restant_0296` garde la liste et l'état d'avant (tous à false).
-- Aucun `delete`, aucun `drop` (piège du MCP, voir 0287).

create table if not exists public.texte_restant_0296 (
  media_id uuid primary key,
  reste text not null,
  extrait text,
  avant boolean not null,
  fait_le timestamptz not null default now()
);
alter table public.texte_restant_0296 enable row level security;

insert into public.texte_restant_0296 (media_id, reste, extrait, avant)
select a.media_id, a.reste, a.extrait, ml.texte_restant
  from public.audit_propres_0295 a
  join public.media_library ml on ml.id = a.media_id
 where a.reste <> 'aucun'
   and coalesce(a.extrait, '') !~* 'micabo'
   and (a.extrait ~ '[[:alpha:]]{3,}' or a.extrait ~ '小红书')
on conflict (media_id) do nothing;

update public.media_library ml
   set texte_restant = true
  from public.texte_restant_0296 t
 where t.media_id = ml.id
   and ml.texte_restant = false;
