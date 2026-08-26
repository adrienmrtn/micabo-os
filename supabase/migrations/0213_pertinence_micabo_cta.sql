-- Pertinence micabo : ne garder que les posts où un CTA flashcards / cours IA convertit.
-- Le prompt reste éditable dans Settings → Prompts (`pertinence_micabo`).

update public.prompts
set contenu = $p$micabo est une application et un site d'éducation IA pour les étudiants : tu déposes tes cours, tes notes ou un PDF, et micabo génère automatiquement les flashcards, puis te fait réviser 10 minutes par jour au bon moment.

Note de 0 à 100 la pertinence de ce slideshow pour PROMOUVOIR micabo avec un CTA utilisable et convertible (pas une pub plaquée).

Question décisive : « Est-ce qu'on peut glisser naturellement : transforme tes cours / notes en flashcards et révise 10 min par jour — micabo le fait pour toi » sans que ça sonne faux ?

Notes hautes (75-100) — OUI, CTA convertible :
- méthodes de révision, prise de notes, fiches, quiz, active recall, spaced repetition
- organisation scolaire, rentrée, examens (bac, SAT, partiels), devenir 1er de la classe
- apprendre une matière / une langue / du vocabulaire
- motivation étudiante liée au travail scolaire (pas au lifestyle)

Notes moyennes (40-74) — studytok esthétique ou motivation vague, CTA possible mais faible.

Notes basses (0-39) — refuse :
- drama, rivalités, « gloomy coquette », internat esthétique sans méthode
- beauté, séduction, fitness, argent, productivité corporate
- tout post où parler de flashcards / cours IA sonnerait plaqué ou hors-sujet
- culture générale Sophia (curiosité, éloquence) SANS angle révision / notes / examens

Ne note jamais comme si c'était Sophia (culture générale). micabo = progrès en cours, pas culture générale.$p$,
    updated_at = now()
where cle = 'pertinence_micabo';
