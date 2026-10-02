-- 0293 — Flashka entre dans `concurrents` (02/10/2026).
--
-- Adrien ajoute la source @flashka_es (es). Flashka est une appli de flashcards
-- IA faite à partir des notes et des PDF (quiz, examens blancs, tuteur IA
-- « Professor Ka ») : le même pitch que micabo, donc un concurrent direct. Ses
-- slideshows sont la pub de sa propre appli.
--
-- Le texte sera repris à la main dans la file (`/admin/file`), comme les images.
-- La table reste le filet derrière la file, et c'est elle qui couvre ce que la
-- file ne voit pas :
-- - une mention oubliée dans le deck source : `sansConcurrents` la juge à la
--   fabrication de CHAQUE deck de langue (0287), traductions comprises ;
-- - les hashtags (`#flashka`, `#flashkaapp`) : `retirerHashtagsConcurrents` ;
-- - le brief du matin (Q10, Q11, `mentions_concurrents`) : il ne repère que
--   les noms de la table.
-- Sans elle, on rejoue jeanne.wilgo (0286 : 76 decks, 43 posts).
--
-- Motif en mot entier, comme les autres. « Professor Ka » n'y est pas : seul,
-- le nom de la mascotte ne dit pas l'appli, et le remplacer par micabo
-- prêterait à micabo un tuteur IA.
--
-- Le moteur relit la table toutes les 10 minutes : aucun redéploiement.

insert into public.concurrents (nom, motif, note) values
  ('Flashka', '\mflashka\M', 'appli de flashcards IA, source @flashka_es ajoutée le 02/10 (0293)')
on conflict (nom) do nothing;
