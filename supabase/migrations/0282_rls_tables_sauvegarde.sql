-- Onze tables de sauvegarde étaient lisibles ET EFFAÇABLES par `anon`
-- (0282, 29/09/2026). Alerte Supabase `rls_disabled_in_public`, niveau ERROR.
--
-- Toutes ont été créées à la main pendant des reprises de données, par
-- `create table` direct, sans RLS. Or Supabase accorde par défaut
-- SELECT/INSERT/UPDATE/DELETE à `anon` et `authenticated` sur toute nouvelle
-- table du schéma `public`. Et la clé `anon` vit dans le bundle du front, donc
-- elle est publique par construction.
--
-- Vérifié avant correction : `has_table_privilege('anon', …)` rendait true pour
-- SELECT, INSERT **et DELETE** sur les onze.
--
-- **Ce qui était exposé, exactement** : des identifiants techniques (uuid), des
-- URLs de médias et du texte de slides. Aucun identifiant TikTok, aucun mot de
-- passe, aucune donnée personnelle de créateur. Le risque réel n'était donc pas
-- une fuite mais une **destruction** : n'importe qui pouvait vider les
-- sauvegardes qui servent précisément de filet aux reprises de données.
--
-- Trois de ces tables datent du 29/09 (0279, 0280, 0281) : la leçon est que
-- `create table` dans une migration de reprise doit être suivi de
-- `enable row level security` + `revoke`, sinon on ouvre une porte à chaque
-- sauvegarde qu'on croit prudente.
--
-- **RLS sans policy = refus pour tout le monde**, et c'est exactement ce qu'on
-- veut ici : `service_role` contourne RLS, donc le moteur continue d'écrire ses
-- sauvegardes. Vérifié qu'aucune de ces tables n'est lue par le front ni par
-- une Edge Function avant d'appliquer.
--
-- Le `revoke` double le verrou : RLS seul suffirait, mais un privilège
-- explicitement retiré se lit dans `has_table_privilege` et ne dépend pas
-- d'une policy qu'un futur `create policy` trop large viendrait ouvrir.

alter table public.cold_study_sauvegarde              enable row level security;
alter table public.corrections_editoriales_sauvegarde enable row level security;
alter table public.decks_desalignes_sauvegarde        enable row level security;
alter table public.doublons_sauvegarde                enable row level security;
alter table public.hustly_bannies                     enable row level security;
alter table public.hustly_propres_verifiees           enable row level security;
alter table public.media_efface_sauvegarde            enable row level security;
alter table public.reassignation_17_09_snapshot       enable row level security;
alter table public.remplacement_hustly                enable row level security;
alter table public.remplacement_hustly_v2             enable row level security;
alter table public.remplacement_hustly_orphelins      enable row level security;

-- Les trois dernières avaient déjà RLS mais gardaient les privilèges par défaut.
revoke all on public.cold_study_sauvegarde              from anon, authenticated;
revoke all on public.corrections_editoriales_sauvegarde from anon, authenticated;
revoke all on public.decks_desalignes_sauvegarde        from anon, authenticated;
revoke all on public.doublons_sauvegarde                from anon, authenticated;
revoke all on public.hustly_bannies                     from anon, authenticated;
revoke all on public.hustly_propres_verifiees           from anon, authenticated;
revoke all on public.media_efface_sauvegarde            from anon, authenticated;
revoke all on public.reassignation_17_09_snapshot       from anon, authenticated;
revoke all on public.remplacement_hustly                from anon, authenticated;
revoke all on public.remplacement_hustly_v2             from anon, authenticated;
revoke all on public.remplacement_hustly_orphelins      from anon, authenticated;
revoke all on public.micabo_marque_sauvegarde           from anon, authenticated;
revoke all on public.file_wilgo_sauvegarde_22_09        from anon, authenticated;
revoke all on public.purge_file_sauvegarde              from anon, authenticated;
revoke all on public.compte_metrics                     from anon, authenticated;
