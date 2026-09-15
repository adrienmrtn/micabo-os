-- Avant de rejouer la bascule : on garde l'avant.
--
-- Les deux premiers aller-retours (0260 puis 0261) ont perdu de l'information,
-- parce que la réécriture fusionne deux formes en une : « le site micabo.app »
-- et « micabo.app » nu donnent tous deux « micabo ». Le retour ne pouvait alors
-- être qu'une reconstruction canonique, pas une restitution.
--
-- Avec cette table, le prochain retour est exact : on relit la valeur d'avant.

create table if not exists public.micabo_marque_sauvegarde (
  id          bigserial primary key,
  fait_le     timestamptz not null default now(),
  etiquette   text not null,
  surface     text not null,
  ligne_id    text not null,
  colonne     text not null,
  valeur      text not null
);

comment on table public.micabo_marque_sauvegarde is
  'Texte de marque avant une réécriture micabo <-> micabo.app. Sert à restituer l''octet exact, ce qu''une réécriture inverse ne peut pas faire : elle fusionne « le site micabo.app » et « micabo.app » nu en un seul « micabo ».';

create index if not exists micabo_marque_sauvegarde_etiquette_idx
  on public.micabo_marque_sauvegarde (etiquette, surface);

-- Table d'exploitation : RLS active et aucune policy, donc lisible par le seul
-- service_role. Rien côté front n'en a besoin.
alter table public.micabo_marque_sauvegarde enable row level security;

insert into public.micabo_marque_sauvegarde (etiquette, surface, ligne_id, colonne, valeur)
select 'avant_micabo_nu_2026_09_15', 'prompts', cle, 'contenu', contenu
from public.prompts where contenu ilike '%micabo%';

insert into public.micabo_marque_sauvegarde (etiquette, surface, ligne_id, colonne, valeur)
select 'avant_micabo_nu_2026_09_15', 'documents', titre, 'contenu', contenu
from public.documents where contenu ilike '%micabo%';

insert into public.micabo_marque_sauvegarde (etiquette, surface, ligne_id, colonne, valeur)
select 'avant_micabo_nu_2026_09_15', 'contenu_langues', id::text, 'slides', slides::text
from public.contenu_langues where slides::text ilike '%micabo%';

insert into public.micabo_marque_sauvegarde (etiquette, surface, ligne_id, colonne, valeur)
select 'avant_micabo_nu_2026_09_15', 'post_slides', ps.id::text, 'texte_overlay', ps.texte_overlay
from public.post_slides ps
join public.posts p on p.id = ps.post_id
where p.statut = 'assigne' and ps.texte_overlay ilike '%micabo%';

insert into public.micabo_marque_sauvegarde (etiquette, surface, ligne_id, colonne, valeur)
select 'avant_micabo_nu_2026_09_15', 'passages', id::text, 'slides', slides::text
from public.passages where statut = 'assigne' and slides::text ilike '%micabo%';
