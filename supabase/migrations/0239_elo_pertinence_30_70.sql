-- ELO import : pertinence 30 % / vues source 70 % (au lieu de 10/90).
--
-- ⚠️ Contrairement à `0154_elo_spread_vues.sql`, on NE recalcule PAS les
-- `contenu_langues` déjà en base. Le stock importé garde les scores obtenus
-- en 10/90 ; seuls les TikToks importés après ce push passent en 30/70.
-- C'est déjà le comportement du code : `assurerLanguesAuDessusSeuilElo` rend
-- la main dès qu'un contenu a des lignes de langue, et le drain ELO
-- (`rattrapage_elo.ts`) ne lit pas `elo_poids_vues` — il fait évoluer les
-- scores sur les vues mesurées des posts, pas sur la formule d'import.
--
-- Réversible depuis l'OS : /admin/réglages → Scoring → poids des vues.

update public.reglages
set valeur = coalesce(valeur, '{}'::jsonb) || jsonb_build_object('elo_poids_vues', 0.7),
    updated_at = now()
where cle = 'scoring';
