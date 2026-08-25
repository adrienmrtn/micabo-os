-- Multi-applications : Sophia (existant) + micabo (nouveau).
-- Tout le contenu (comptes, sources, slideshows, labels, biblio, UGC, papier)
-- est désormais rattaché à une application. L'existant est backfillé sur Sophia.

-- ---------------------------------------------------------------------------
-- Catalogue d'applications
-- ---------------------------------------------------------------------------
create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique
    constraint applications_slug_format check (slug ~ '^[a-z][a-z0-9_-]{1,31}$'),
  nom text not null,
  created_at timestamptz not null default now()
);

insert into public.applications (id, slug, nom) values
  ('00000000-0000-4000-8000-000000000001', 'sophia', 'Sophia'),
  ('00000000-0000-4000-8000-000000000002', 'micabo', 'micabo')
on conflict (slug) do nothing;

alter table public.applications enable row level security;

drop policy if exists applications_read on public.applications;
create policy applications_read on public.applications
  for select to authenticated using (true);

drop policy if exists applications_admin on public.applications;
create policy applications_admin on public.applications
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select on public.applications to authenticated;
grant all on public.applications to service_role;

create or replace function public.application_id_sophia()
returns uuid language sql stable as $$
  select id from public.applications where slug = 'sophia' limit 1
$$;

-- ---------------------------------------------------------------------------
-- Colonnes application_id (défaut Sophia pour l'existant + le code legacy)
-- ---------------------------------------------------------------------------
alter table public.comptes
  add column if not exists application_id uuid references public.applications (id);

alter table public.comptes_reference
  add column if not exists application_id uuid references public.applications (id);

alter table public.contenus
  add column if not exists application_id uuid references public.applications (id);

alter table public.labels
  add column if not exists application_id uuid references public.applications (id);

alter table public.media_library
  add column if not exists application_id uuid references public.applications (id);

alter table public.import_file
  add column if not exists application_id uuid references public.applications (id);

alter table public.ugc_personas
  add column if not exists application_id uuid references public.applications (id);

alter table public.ugc_reactions
  add column if not exists application_id uuid references public.applications (id);

alter table public.ugc_utilisations
  add column if not exists application_id uuid references public.applications (id);

alter table public.ugc_video_posts
  add column if not exists application_id uuid references public.applications (id);

alter table public.papier_masters
  add column if not exists application_id uuid references public.applications (id);

update public.comptes set application_id = public.application_id_sophia()
  where application_id is null;
update public.comptes_reference set application_id = public.application_id_sophia()
  where application_id is null;
update public.contenus set application_id = public.application_id_sophia()
  where application_id is null;
update public.labels set application_id = public.application_id_sophia()
  where application_id is null;
update public.media_library set application_id = public.application_id_sophia()
  where application_id is null;
update public.import_file set application_id = public.application_id_sophia()
  where application_id is null;
update public.ugc_personas set application_id = public.application_id_sophia()
  where application_id is null;
update public.ugc_reactions set application_id = public.application_id_sophia()
  where application_id is null;
update public.ugc_utilisations set application_id = public.application_id_sophia()
  where application_id is null;
update public.ugc_video_posts set application_id = public.application_id_sophia()
  where application_id is null;
update public.papier_masters set application_id = public.application_id_sophia()
  where application_id is null;

alter table public.comptes
  alter column application_id set default public.application_id_sophia(),
  alter column application_id set not null;
alter table public.comptes_reference
  alter column application_id set default public.application_id_sophia(),
  alter column application_id set not null;
alter table public.contenus
  alter column application_id set default public.application_id_sophia(),
  alter column application_id set not null;
alter table public.labels
  alter column application_id set default public.application_id_sophia(),
  alter column application_id set not null;
alter table public.media_library
  alter column application_id set default public.application_id_sophia(),
  alter column application_id set not null;
alter table public.import_file
  alter column application_id set default public.application_id_sophia(),
  alter column application_id set not null;
alter table public.ugc_personas
  alter column application_id set default public.application_id_sophia(),
  alter column application_id set not null;
alter table public.ugc_reactions
  alter column application_id set default public.application_id_sophia(),
  alter column application_id set not null;
alter table public.ugc_utilisations
  alter column application_id set default public.application_id_sophia(),
  alter column application_id set not null;
alter table public.ugc_video_posts
  alter column application_id set default public.application_id_sophia(),
  alter column application_id set not null;
alter table public.papier_masters
  alter column application_id set default public.application_id_sophia(),
  alter column application_id set not null;

create index if not exists comptes_application_idx on public.comptes (application_id);
create index if not exists comptes_reference_application_idx
  on public.comptes_reference (application_id);
create index if not exists contenus_application_idx on public.contenus (application_id);
create index if not exists labels_application_idx on public.labels (application_id);
create index if not exists media_library_application_idx
  on public.media_library (application_id);
create index if not exists import_file_application_idx
  on public.import_file (application_id);
create index if not exists ugc_personas_application_idx
  on public.ugc_personas (application_id);
create index if not exists ugc_reactions_application_idx
  on public.ugc_reactions (application_id);
create index if not exists ugc_utilisations_application_idx
  on public.ugc_utilisations (application_id);
create index if not exists papier_masters_application_idx
  on public.papier_masters (application_id);

-- ---------------------------------------------------------------------------
-- Unicités désormais scopées par application
-- ---------------------------------------------------------------------------
alter table public.labels drop constraint if exists labels_slug_key;
drop index if exists labels_slug_key;
create unique index if not exists labels_slug_application_uidx
  on public.labels (application_id, slug);

alter table public.comptes_reference drop constraint if exists comptes_reference_handle_tiktok_key;
drop index if exists comptes_reference_handle_tiktok_key;
create unique index if not exists comptes_reference_handle_application_uidx
  on public.comptes_reference (application_id, handle_tiktok);

drop index if exists contenus_source_url_uidx;
create unique index if not exists contenus_source_url_application_uidx
  on public.contenus (application_id, source_url)
  where source_url is not null;

drop index if exists import_file_pending_url_uidx;
create unique index if not exists import_file_pending_url_application_uidx
  on public.import_file (application_id, post_url)
  where statut in ('pending', 'running');

drop index if exists ugc_reactions_source_url_uidx;
create unique index if not exists ugc_reactions_source_url_application_uidx
  on public.ugc_reactions (application_id, source_url);

-- ---------------------------------------------------------------------------
-- Labels système micabo (hook + marque UGC) — copies de Sophia
-- ---------------------------------------------------------------------------
insert into public.labels (nom, slug, couleur, genre, ugc_ai_video, application_id)
select l.nom, l.slug, l.couleur, l.genre, coalesce(l.ugc_ai_video, false),
       a.id
from public.labels l
cross join public.applications a
where a.slug = 'micabo'
  and l.slug in ('hook', 'ugc-ai-video')
  and l.application_id = public.application_id_sophia()
on conflict (application_id, slug) do nothing;

-- ---------------------------------------------------------------------------
-- Prompts micabo (pertinence + placement)
-- ---------------------------------------------------------------------------
insert into public.prompts (cle, contenu) values
('pertinence_micabo', $p$micabo est une application d'éducation IA pour les étudiants : tu déposes tes cours, tes notes ou un PDF, et micabo génère automatiquement les flashcards, puis te fait réviser au bon moment.

Note de 0 à 100 la pertinence de ce slideshow pour y glisser naturellement un conseil menant à micabo.

Notes hautes (70-100) : tout contenu utilisable pour promouvoir une appli d'éducation IA / flashcards auprès d'étudiants. Exemples (liste non exhaustive) :
- conseils d'études, méthodes de révision, prise de notes, concentration
- comment anticiper la rentrée, s'organiser, gérer son emploi du temps
- comment devenir numéro un de sa classe, réussir un examen, le SAT, le bac
- comment apprendre une nouvelle langue, du vocabulaire, une matière
- mémoire, active recall, fiches, quiz, flashcards, répétition
- motivation étudiante, habitudes de travail, productivité scolaire

Notes moyennes (40-69) : culture générale, curiosité, lecture, éloquence — intégrable si on peut basculer vers « se tester / retenir ».

Notes basses (0-39) : fitness, beauté, séduction, argent, crypto, productivité corporate pure, ou tout sujet où parler d'une appli de flashcards pour étudiants sonnerait plaqué.$p$),
('placement_micabo', $p$PROMPT — Placement publicitaire natif de micabo
0. CE QUE CE PROMPT DOIT PRODUIRE, EN UNE PHRASE

Une slide qui parle de micabo sans jamais avoir l'air d'une pub, écrite EXACTEMENT dans le même moule que les slides autour d'elle — même mode grammatical, même niveau de simplicité, comme si c'était la même personne qui avait écrit tout le slideshow d'une traite.

1. RÔLE ET CONTEXTE

Tu prépares le placement publicitaire de micabo dans un slideshow TikTok éducatif / listicle déjà traduit en français. micabo est une plateforme de flashcards qui utilise l'IA : tu déposes tes cours, tes notes ou un PDF, et micabo génère automatiquement les flashcards, puis te fait réviser au bon moment pour que ça rentre vraiment. Positionnement : "arrête de relire tes cours, teste-toi et retiens vraiment". Ton : sérieux mais accessible, curieux, adulte, jamais scolaire, jamais infantilisant, et surtout jamais writer-y ou philosophique.

3. RÈGLE N°0 — PRIORITÉ ABSOLUE : LE PLACEMENT DOIT TOUJOURS EXISTER

Peu importe le sujet du slideshow, tu dois TOUJOURS produire un vrai placement pour micabo, intégrable dans une slide existante ou en remplacement d'une slide. Ce n'est jamais optionnel.

4. VUE D'ENSEMBLE DU PROCESSUS

Étape 1 : cherche une slide concurrente. Étape 2 : si trouvée, remplace-la entièrement. Étape 3 : sinon, cherche une slide thématiquement compatible et intègre micabo dedans. Étape 4 : si rien ne colle, applique la règle de repli. Une fois la slide choisie, passe à l'étape la plus importante de tout ce prompt : la section 9 (mode grammatical), AVANT d'écrire le moindre mot.

5. ÉTAPE 1 — DÉTECTION D'UNE SLIDE CONCURRENTE

DÉFINITION LARGE : toute app/site/outil qui sert à mémoriser ou réviser (Anki, Quizlet, Memrise, RemNote, StudySmarter, Brainscape), à générer des fiches ou des quiz à partir de cours, à apprendre du contenu (Duolingo, Babbel, Actualize), à s'entraîner à une compétence (Elqo), ou à organiser ses cours pour les réviser (Notion "spécial révisions", GoodNotes présenté comme méthode de révision, ChatGPT présenté comme outil pour réviser). CONCURRENT PRIORITAIRE : dès qu'une slide parle de flashcards, de fiches de révision, de quiz, de répétition espacée ou d'active recall, c'est le meilleur emplacement possible, même si aucune marque n'est citée. NE COMPTE PAS comme concurrent : recommandations de livres, podcasts, comptes, chaînes, ou apps sans rapport avec l'apprentissage (stretching, méditation, gestion du temps pure). TEST RAPIDE : "cette app promet-elle d'apprendre / réviser / mémoriser / s'entraîner ?" Si oui → concurrent.

6. ÉTAPE 2 — SI CONCURRENT : REMPLACEMENT COMPLET, SUJET LIBRE

micabo remplace intégralement la slide. Tu n'es pas obligé·e de garder le sujet exact de la slide d'origine (ex. "révise avec Anki" peut devenir "transforme tes cours en flashcards avec micabo") tant que la transition reste fluide.

7. ÉTAPE 3 — SI PAS DE CONCURRENT : INTÉGRATION NATURELLE

Si le slideshow parle de méthode de travail, de révisions, d'examens, de mémoire, de prise de notes, de concentration, d'organisation des cours, d'apprentissage d'une langue ou de culture générale, transforme cette idée en habitude qui mène à micabo. Départage entre plusieurs candidates : 1) sujet le plus proche de "réviser / retenir / se tester" en priorité, 2) seconde moitié du slideshow, 3) jamais la toute dernière slide si elle est un pur CTA.

8. ÉTAPE 4 — SI RIEN NE COLLE : REPLI

Seconde moitié du slideshow, jamais la slide de couverture (index 0).

9. RÈGLE ABSOLUE ET PRIORITAIRE — ADAPTE LE MODE GRAMMATICAL AU RESTE DU SLIDESHOW

C'est la règle la plus importante de ce prompt. Avant d'écrire un seul mot de tes variantes, regarde comment sont écrites AU MOINS 2 autres slides du slideshow et identifie leur mode :

Mode INSTRUCTIF (tu/impératif) — la majorité des slideshows sont dans ce mode. Signes : "regarde des cours...", "écoute des podcasts...", "fais du journaling.", "révise le soir avant de dormir...". La slide s'adresse directement au spectateur, lui donne un ordre ou un conseil direct.

Mode CONFESSION (je) — plus rare, réservé aux slideshows "les habitudes que j'ai adoptées" où CHAQUE slide parle à la première personne. Signes : "je ne regarde pas mon téléphone avant...", "je garde une note qui s'appelle...".

Une fois le mode identifié, tes 3 variantes DOIVENT être dans ce mode, et seulement celui-là. Ne bascule JAMAIS en "je" confessionnel si le reste du deck est à l'impératif. À l'inverse, ne mets jamais un "utilise..." sec et impersonnel dans un deck 100% "je". Si le slideshow mélange les deux modes sans dominante claire, pars sur le mode INSTRUCTIF par défaut.

10. RÈGLES DE TON — LISTES NOIRES ÉTENDUES

INTERDIT — formules publicitaires : "télécharge micabo", "essaie micabo", "abonne-toi", "clique ici", "ne rate pas", "profite de", "révolutionnaire", "incontournable", "la meilleure appli", "n'attends plus".

INTERDIT — hype IA : "propulsé par l'IA", "boosté par l'IA", "l'IA qui change tout", "intelligence artificielle de pointe", "algorithme intelligent", "génère en un clic". L'IA se mentionne au maximum une fois, et seulement si ça décrit une action concrète ("micabo transforme ton cours en flashcards tout seul"). Le mot qui accroche, c'est "flashcards", pas "IA".

INTERDIT — tournures philosophiques et aphorismes : toute construction du type "X n'est pas Y, c'est Z" (ex. "réviser c'est pas relire, c'est se tester"). Ça sonne comme une citation LinkedIn ou une punchline de coach, jamais comme un vrai TikTok. Une slide décrit une ACTION concrète, jamais une définition abstraite.

INTERDIT — vocabulaire abstrait : "répétition espacée", "active recall", "courbe de l'oubli", "écosystème", "paradigme", "dynamique", "démarche", "processus cognitif", ou tout mot qu'on n'utiliserait jamais à l'oral avec un pote. Si l'idée de la répétition espacée est utile, dis-la simplement : "micabo te remontre les cartes que t'as ratées". En cas d'hésitation, prends toujours le mot simple.

RÈGLES POSITIVES :

Écris TOUJOURS "micabo", en minuscules, même en début de phrase. Jamais "Micabo", jamais "MICABO", jamais d'abréviation ou de surnom.
Ne dis jamais "la plateforme micabo" (trop corporate). Dis "micabo" seul, ou "l'appli micabo" si la slide a besoin de préciser que c'est une appli.
En mode instructif, formule type : "micabo est top / parfait pour ça" ou "utilise micabo pour ça". En mode confession : "j'utilise micabo pour...", "ma préférée c'est micabo".
Même format visuel que les slides voisines (numérotation, parenthèses, ponctuation).
Court : maximum 2 lignes, environ 120 caractères.
11. LE TIRET CADRATIN

Le tiret "—" ou "--" n'est jamais toléré, même une seule fois, même au milieu d'une phrase. C'est LE signal n°1 qui trahit un texte généré par IA. Relis caractère par caractère. Si tu en trouves un, réécris la phrase en 2 phrases courtes séparées par un point.

12. TEST DE SIMPLICITÉ

Relis chaque variante à voix haute. Si tu bafouilles, ou si la phrase contient un mot que tu n'emploierais jamais avec un pote, réécris plus simple. Une slide micabo doit être une des plus simples du slideshow, jamais la plus compliquée.

13. LES 3 VARIANTES — 3 ANGLES DIFFÉRENTS, MÊME MODE
A (habitude simple) : ex. instructif "transforme tes cours en flashcards et révise 10 minutes par jour. micabo est top pour ça, il les crée à partir de tes notes."
B (objection dépassée) : ex. "arrête de relire tes cours en surlignant tout, ça rentre pas. avec micabo tu te testes et là ça reste."
C (diversité concrète) : ex. "sur micabo tu déposes ton pdf de cours et t'as tes flashcards prêtes, révisables dans le bus." Mode confession : A "je transforme chaque cours en flashcards sur micabo et je révise 10 minutes le soir.", B "avant je faisais mes fiches à la main pendant des heures, maintenant micabo me les sort direct.", C "sur micabo je révise mes cours, mon vocabulaire et mes fiches d'exam au même endroit."
17. AUTOCONTRÔLE AVANT DE RÉPONDRE
Ai-je identifié le mode dominant AVANT d'écrire ? Mes 3 variantes sont-elles dans CE mode uniquement ?
Un tiret cadratin "—" ou double "--" quelque part ? Vérifie caractère par caractère.
Une tournure "ce n'est pas X, c'est Y" ou un mot abstrait ? Réécris concret.
Ai-je mis de la hype IA ou parlé d'IA plus d'une fois ?
Un ado de 15 ans comprend-il du premier coup ?
Ai-je écrit "micabo" en minuscules partout, sans surnom ni "plateforme" ?
Mes 3 variantes ont-elles vraiment 3 angles différents ?
L'accord de genre correspond-il au reste du slideshow ?
La marque concurrente a-t-elle totalement disparu si applicable ?
Ai-je évité la slide de couverture ?$p$)
on conflict (cle) do nothing;
