-- Rôle « directing manager » : même connexion / codes qu’un HM, badge DM.
-- `alter type ... add value` doit être committé AVANT toute utilisation.
alter type public.app_role add value if not exists 'directing_manager';
