-- Un recharge créateur ne doit plus sortir le slideshow du pool.
-- On remet en valide ceux invalidés uniquement pour ce motif
-- (la raison Gemini a été écrasée ; on la vide plutôt que de laisser
-- un texte « Rechargé par le créateur » sur un contenu valide).

update public.contenus
set statut = 'valide',
    pertinence_raison = null
where statut = 'rejete'
  and pertinence_raison =
    'Rechargé par le créateur : slideshow buggé (texte décalé / incohérent)';

update public.sujets
set statut = 'retenu',
    pertinence_raison = null
where statut = 'rejete'
  and pertinence_raison =
    'Rechargé par le créateur : slideshow buggé (texte décalé / incohérent)';
