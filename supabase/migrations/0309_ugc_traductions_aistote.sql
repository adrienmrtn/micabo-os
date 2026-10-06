-- 0309 — AI UGC : le texte à coller par langue, et Aistote dans les concurrents (06/10/2026).
--
-- Demande d’Adrien : pour chaque vidéo, le texte de la vidéo d’origine repris
-- et traduit, prêt à partir dans chaque langue, avec une capture de l’image
-- d’origine qui montre où le poser et le lien du TikTok d’origine. La capture
-- (`image_ref_path`) et le lien (`source_url`) existent depuis 0308. Il manquait
-- les traductions : `ugc_modeles.traductions` les range, une clé par langue,
-- `{ segments: [{segment, texte}], alertes: [...] }`. Une alerte dit qu’un nom
-- de la table `concurrents` a survécu à la traduction : l’admin tranche.
--
-- La première vidéo d’Adrien (@etudiant_pass) recommande « la méthode
-- aistote », une appli d’étude par IA : un concurrent. Il entre dans la table,
-- comme Flashka avant l’import de sa source (0293), pour que la traduction le
-- remplace par micabo et que les decks du moteur et le brief du matin le
-- repèrent aussi. Motif en mot entier.
--
-- Sans point-virgule ni apostrophe droite dans les chaînes ni les
-- commentaires, et sans `drop` (pièges du MCP, 0297 et 0308).

alter table public.ugc_modeles
  add column if not exists traductions jsonb not null default '{}'::jsonb,
  add column if not exists traduit_le timestamptz;

insert into public.concurrents (nom, motif, note) values
  ('Aistote', '\maistote\M', 'appli d’étude par IA, citée dans la première vidéo AI UGC (0309)')
on conflict (nom) do nothing;
