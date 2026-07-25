-- Comptes de référence « conjoints » : un 2e (3e…) compte SIMILAIRE rattaché à un
-- compte principal, pour élargir le stock de matière quand le principal s'épuise.
-- Le groupe = le principal (parent_id null) + ses conjoints (parent_id = principal).
-- Un poster reste attaché au PRINCIPAL ; le pipeline puise dans tout le groupe.
-- on delete set null : supprimer un principal ne supprime pas ses conjoints, ils
-- redeviennent autonomes.
alter table public.comptes_reference
  add column if not exists parent_id uuid
    references public.comptes_reference (id) on delete set null;

create index if not exists idx_comptes_reference_parent
  on public.comptes_reference (parent_id);
