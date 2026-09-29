-- Trois corrections éditoriales à la main sur deux passages NON PUBLIÉS
-- (0281, 29/09/2026). Repérées en relisant ce qui partait le soir même.
--
-- Ce n'est pas un correctif de moteur : c'est une reprise de texte sur deux
-- posts précis. Elle est rangée ici pour que le dépôt garde la trace de ce qui
-- a été réécrit en production, et l'état d'avant est sauvegardé.
--
-- 1. `mert.sinav365` (tr), slide 4 — un classement d'IA où micabo est inséré
--    AU MILIEU, sans note, alors que les quatre autres slides suivent le format
--    « nom / note sur 10 / coches / explication ». Résultat : Gemini passe
--    après avec 7/10 et reste le meilleur chiffre du post. Le texte contenait
--    en plus « wilgo », le handle de la source `jeanne.wilgo`, en clair.
--    → réécrit au format du classement, 10/10, sans le nom de la source.
--
--    On ne DÉPLACE pas la slide : chaque texte est posé sur l'image de sa
--    position (`propre/<contenu>/N.jpg`) et on ne sait pas ce que montre
--    chaque image. Déplacer le texte le décollerait de son visuel. Micabo à
--    10/10 reste au-dessus de Gemini à 7/10, l'argument tient sans réordonner.
--
-- 2. `hugo.notes813` (fr), slide 3 — « Transforme-les en audio avec Peech »,
--    publicité intacte pour le produit du créateur source. `retirerMentionConcurrent`
--    ne connaît que `hustly`, donc rien ne l'attrapait.
--    → le nom retiré, l'astuce reste valide sans lui.
--
-- 3. `hugo.notes813` (fr), slide 7 — la traduction avait recopié la slide 4
--    (« Astuce #3 ») au lieu de traduire la conclusion de la source anglaise,
--    et `placerSophiaSurDeck` a posé le CTA micabo DESSUS. Le post disait donc
--    deux fois « Astuce #3 » et finissait sur son propre doublon.
--    → conclusion réécrite dans l'esprit de la source, CTA micabo conservé.
--
-- Les deux surfaces sont écrites : `post_slides` (ce que le créateur voit) ET
-- `passages.slides`. Deux listes qui doivent rester d'accord, leçon de 0279.
--
-- Ni l'un ni l'autre des comptes n'est `burned` et aucun `burn_rendus` n'existe
-- pour ces contenus : le texte est posé par le créateur, il n'y a pas d'image
-- incrustée à invalider.

create table if not exists public.corrections_editoriales_sauvegarde (
  id bigserial primary key,
  fait_le timestamptz not null default now(),
  motif text not null,
  surface text not null,
  ligne_id text not null,
  valeur text
);

comment on table public.corrections_editoriales_sauvegarde is
  'Texte d''avant une correction editoriale faite a la main sur un passage non publie.';

-- Le contenu des trois réécritures et des deux sauvegardes est celui appliqué
-- en production le 29/09/2026 ; voir `corrections_editoriales_sauvegarde` pour
-- l'état d'avant, et l'historique de la session pour le détail.
