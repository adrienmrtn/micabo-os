-- Ordre d'assignation des comptes de référence : quand on crée un nouveau poster
-- d'une langue, on lui donne la source LIBRE (pas déjà prise dans cette langue) au
-- plus petit `ordre_assignation`. L'admin contrôle ainsi qui vient ensuite, par
-- langue (la file par langue = le sous-ensemble libre, dans cet ordre global).
alter table public.comptes_reference
  add column if not exists ordre_assignation int;

-- Initialisation : ordre = rang par date de création (principaux d'abord).
with ranked as (
  select id, row_number() over (order by created_at) as rn
  from public.comptes_reference
  where parent_id is null
)
update public.comptes_reference c
  set ordre_assignation = ranked.rn
  from ranked
  where ranked.id = c.id and c.ordre_assignation is null;

alter table public.comptes_reference
  alter column ordre_assignation set default 999;
