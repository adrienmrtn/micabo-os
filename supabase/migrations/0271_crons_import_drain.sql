-- Le drain d'import n'avait plus de cron — et le lui rendre ne l'accélère pas.
--
-- `0149_import_file_serveur.sql` posait douze jobs `import-contenu-drain-1..12`
-- à la minute, `0156_pause_verifyclean_crons.sql` les a désactivés, puis le
-- désenfilage général d'un `db push` les a fait disparaître de `cron.job` :
-- `crons_minuit_planifier()` ne repose que les cinq jobs minuit / ELO.
--
-- Cette migration les RECRÉE, mais **désactivés**. Elle existe pour qu'ils
-- soient là, nommés et prêts, et pour que la leçon ci-dessous soit écrite à
-- côté d'eux. Les activer demande d'abord un correctif de code.
--
-- CE QUI S'EST PASSÉ LE 22/09/2026, en les activant sur l'import de
-- `jeanne.wilgo` (139 contenus). Débit mesuré sur l'étape `pertinence` :
--
--     0 job (auto-chaînage seul) ....... 1,33 contenu/min
--     12 jobs .......................... 2,50 puis 0,64
--     4 jobs ........................... 0,21
--     0 job ............................ 0,00  (arrêt complet)
--
-- Deux défauts se combinent, et aucun n'est dans le cron.
--
-- 1. LA POPULATION DE WORKERS EST CONSERVÉE, PAS BORNÉE. `continuer()` rend
--    `more: await hasMoreWork()` — « il reste du travail en file », et NON
--    « j'ai réussi à réclamer quelque chose ». Chaque worker se rechaîne donc
--    à un successeur même bredouille : la population ne décroît jamais tant
--    que la file n'est pas vide, et chaque tick de cron l'augmente
--    définitivement. Une chaîne n'est pas « un worker par minute » : c'est une
--    boucle de ~2 s, soit ~25 boots/min à elle seule. On est monté à ~120
--    boots/min. `rattrapage-elo` ne connaît pas ce problème parce qu'il a un
--    verrou `busy` explicite (`eloDrainEstVerrouille`) ; `import-contenu` n'en
--    a aucun.
--
-- 2. LA FENÊTRE DE CLAIM EST ÉTROITE ET DÉTERMINISTE. `claimContenu` lit les
--    8 mêmes candidats pour tout le monde (`import_tentatives`,
--    `pertinence_score`, `created_at`), puis chacun tente un `update`
--    conditionnel dessus. À 120 workers, Postgres sérialise les verrous sur
--    ces 8 lignes et les isolats meurent au timeout avant d'aboutir.
--
-- ET LE VRAI BLOCAGE, ANTÉRIEUR AU CRON : des lignes empoisonnées. 24 contenus
-- arrêtés à `elo` / `format`, aux `pertinence_score` les plus bas, donc en tête
-- du tri. Réclamées, elles tuent l'isolat (timeout Edge 150 s, `shutdown` sans
-- aucune ligne de log), donc `relacherContenuApresPas` n'est jamais atteint,
-- donc `import_tentatives` n'est **jamais incrémenté** — et elles reviennent en
-- tête au bail suivant. Les 62 contenus à `pertinence` n'étaient jamais
-- atteignables. Le code prévoit pourtant le cas : « `import_tentatives` en
-- premier critère : un diaporama qui enchaîne les passages stériles passe
-- derrière les imports frais au lieu d'aspirer tous les workers ». Le
-- mécanisme existe, il ne se déclenche pas.
--
-- Reprise manuelle du 22/09 : `import_tentatives + 1` sur ces 24 lignes. Le
-- travail a repris dans la minute (0 → 129 lignes de log applicatif par
-- minute), sans toucher au cron.
--
-- AVANT DE LES ACTIVER, il faut donc dans `import-contenu` :
--   * un verrou de concurrence, sur le modèle de `eloDrainEstVerrouille` ;
--   * `more` qui reflète le claim et pas la file, ou un plafond de chaînes ;
--   * `import_tentatives` incrémenté AVANT le pas, pas après, pour qu'un pas
--     qui tue le process compte quand même son essai.
-- Tant que ces trois points ne sont pas faits, laisser `active = false` : le
-- seul auto-chaînage Edge draine plus vite que douze jobs.

do $$
declare
  i int;
  nom text;
  jid bigint;
  cmd constant text :=
    $cmd$select public.kick_edge_micabo('import-contenu', jsonb_build_object('worker', true));$cmd$;
begin
  for nom in
    select j.jobname from cron.job j where j.jobname like 'import-contenu-drain-%'
  loop
    begin
      perform cron.unschedule(nom);
    exception when others then
      null;
    end;
  end loop;

  for i in 1..12 loop
    nom := format('import-contenu-drain-%s', i);
    jid := cron.schedule(nom, '* * * * *', cmd);
    -- Posés éteints : voir l'en-tête. Les activer sans le correctif de code
    -- ralentit l'import au lieu de l'accélérer, et finit par l'arrêter.
    perform cron.alter_job(jid, active := false);
  end loop;
end $$;
