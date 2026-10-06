-- 0301 — ElibroAI entre dans `concurrents` (02/10/2026).
--
-- Vu en relisant les variantes : le parent 09c607a2 (jeena_study_tips) finit
-- sur « Try ElibroAI for smarter study support ». Au 02/10, ElibroAI est cité
-- dans 7 decks validés (6 slideshows, en / fr / de) et dans 4 posts publiés,
-- sous trois graphies : « ElibroAI », « elibroAI » et « elibro.ai ». Rien ne
-- l'attrapait : il n'était pas dans la table.
--
-- Le motif couvre les trois graphies, en mot entier comme les autres :
-- « \melibro\M » seul ne voit pas « ElibroAI » (pas de fin de mot avant « AI »).
--
-- Le moteur relit la table toutes les 10 minutes : `sansConcurrents` jugera
-- ces decks à leur prochaine fabrication (0287), le brief du matin repère les
-- posts non publiés (Q11). Aucun redéploiement.

insert into public.concurrents (nom, motif, note) values
  ('ElibroAI', '\melibro(\s?ai|\.ai)?\M',
   'appli d’étude IA (résumés, quiz) placée par jeena_study_tips, vue le 02/10 (0301)')
on conflict (nom) do nothing;
