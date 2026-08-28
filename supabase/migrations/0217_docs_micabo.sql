-- Seed documents : plus de « Bienvenue sur Sophia ».
-- Ne touche qu'au texte d'accueil du guide manager de CE projet.

update documents
set contenu = replace(contenu, 'Bienvenue sur Sophia.', 'Bienvenue sur micabo.')
where contenu like '%Bienvenue sur Sophia.%';
