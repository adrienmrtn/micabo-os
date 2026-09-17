-- Un interrupteur par source : ses imports sautent-ils la file de validation ?
--
-- La file est une porte de qualité, et elle a son coût : au 17/09/2026, sur une
-- bibliothèque de 163 slideshows, 68 dormaient en `brouillon` avec un tier et un
-- cycle ouvert — invisibles au tireur, qui exige `statut = 'valide'`. Le moteur
-- ne voyait que 60 slideshows, et n'en tirait réellement que 17.
--
-- Pour une source déjà éprouvée, relire chaque import ne rapporte rien et
-- retient tout. `skip_validation` laisse choisir source par source.
--
-- Le drapeau est lu à la PORTE DU TIER (`import_contenu.ts`), pas à la création
-- du contenu : c'est le moment où le slideshow vient d'être jugé importable.
-- Aucun risque qu'il parte inachevé — le tireur exige aussi
-- `import_statut = 'done'`, qui n'arrive qu'au bout du pipeline. Un `rejete`
-- n'est jamais repassé en `valide`.
--
-- Défaut `false` : les sources existantes continuent de passer par la file.

alter table public.comptes_reference
  add column if not exists skip_validation boolean not null default false;

comment on column public.comptes_reference.skip_validation is
  'true = les slideshows importes de cette source sont valides d office a la porte du tier, sans passer par la file de validation.';

notify pgrst, 'reload schema';
