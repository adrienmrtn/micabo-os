-- Ordre d'assignation INDÉPENDANT PAR LANGUE : { "fr": 2, "de": 1, ... }. Une même
-- source peut être n°1 pour l'allemand et n°5 pour le français. Repli sur
-- `ordre_assignation` (global) quand une langue n'a pas d'ordre propre.
alter table public.comptes_reference
  add column if not exists ordre_par_langue jsonb not null default '{}'::jsonb;
