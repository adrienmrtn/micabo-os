-- Le drain d'import n'avait plus de cron du tout.
--
-- `0149_import_file_serveur.sql` posait douze jobs `import-contenu-drain-1..12`,
-- tous à la minute — « 12 workers / minute = parallélisation agressive ».
-- `0156_pause_verifyclean_crons.sql` les a désactivés pour couper les dépenses
-- continues. Depuis, ils ont disparu de `cron.job` : la discipline « après
-- db push, unscheduler TOUS les jobs » les a balayés, et
-- `crons_minuit_planifier()` ne les connaît pas — il ne repose que les cinq
-- jobs minuit / ELO. Le parallélisme n'était donc pas en panne, il n'était
-- plus branché.
--
-- Constaté le 22/09/2026 sur l'import de `jeanne.wilgo` : 139 contenus créés
-- en 16 minutes, puis ~1,3 contenu/minute franchissant une étape, soit plus de
-- six heures pour une file que douze workers vident en une demi-heure. Ce qui
-- drainait, c'était le seul auto-chaînage Edge (`kickWorkers(request, 1)`),
-- prévu comme filet, pas comme moteur.
--
-- POURQUOI PAS REJOUER 0149. Il clone la commande du job `preparation-nuit`
-- pour en hériter l'hôte et le secret ; ce job n'existe plus, donc le bloc
-- sortirait sur son `raise notice` sans rien poser. La commande est écrite ici
-- en clair, via `kick_edge_micabo` — seul détenteur de l'hôte et du secret —
-- et le corps JSON passe par `jsonb_build_object` : un `'{"…":…}'::jsonb`
-- écrit à la main ressort avec les guillemets échappés quand la migration
-- traverse un outil, et le job casse en silence au tick.
--
-- POURQUOI DOUZE ET PAS PLUS. Le worker traite UN pas de pipeline pour UN
-- contenu, puis se rechaîne à un seul successeur : le commentaire de
-- `import-contenu/index.ts` documente qu'à deux, la file se dédoublait à
-- chaque pas et saturait les Edge Functions. Douze chaînes injectées par
-- minute est linéaire, pas exponentiel, et le bail de `claimContenu`
-- (`LEASE_MS`, 8 min) borne le tout : un worker qui ne trouve rien à réclamer
-- rend `more: false` et s'éteint sans se rechaîner. La population se limite
-- donc d'elle-même au travail disponible.
--
-- Idempotent : on désenfile d'abord tout `import-contenu-drain-%` existant,
-- actif ou non, pour ne pas empiler deux générations de jobs.

do $$
declare
  i int;
  nom text;
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
    perform cron.schedule(format('import-contenu-drain-%s', i), '* * * * *', cmd);
  end loop;
end $$;
