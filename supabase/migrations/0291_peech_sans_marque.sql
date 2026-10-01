-- 0291 — micabo ne fait pas d'audio : PeECH devient sans marque (01/10/2026).
--
-- Décision d'Adrien : « micabo ne fait pas d'audio, PeECH sans marque ».
--
-- PeECH lit les notes à voix haute. La règle de 0287 (une recommandation de
-- concurrent devient micabo) lui faisait dire « transforme tes notes en audio
-- avec l'appli micabo » : 9 placements sur 30 à l'essai à blanc de 0289, et 12
-- decks turcs déjà en base, où la traduction avait remplacé PeECH par micabo.
-- Une fausse promesse sur ce que fait l'appli, juste avant que le spectateur la
-- télécharge.
--
-- 1. `concurrents_sans_marque` : la liste des concurrents dont une slide qui
--    les recommande ne devient JAMAIS micabo, elle devient sans marque (« une
--    appli audio »). Le moteur (`versMicaboDepuis`, `appliquerVerdicts`,
--    `corrigerMentionsConcurrents`) la lit depuis 0291 ; PeECH est le seul.
--    Une table à part et non une colonne de `concurrents` : un `alter table …
--    add column` sur `concurrents` faisait attendre l'outil MCP sa
--    confirmation humaine jusqu'au délai de 60 s (même piège que 0287), deux
--    fois de suite.
-- 2. Le stock : 17 slides qui prêtent l'audio à micabo, réécrites au plus court
--    (le nom part, le reste reste mot pour mot). 12 decks turcs (PeECH traduit en
--    micabo), et `78e85e05` en cinq langues, un placement MANUEL qui listait
--    « mode audio » parmi les fonctions de micabo : l'élément est retiré de la
--    liste. Sauvegarde `avant_sans_audio_2026_10_01` dans
--    `micabo_marque_sauvegarde` d'abord. Les deux posts non publiés qui portaient
--    ce texte passent par `corriger_texte_post` (journal dans
--    `concurrents_corrections`). Les publiés ne sont pas touchés.
-- 3. Le prompt v2 (`placement_micabo_v2`) le dit aussi : pas d'audio, et la
--    slide d'une appli audio n'est pas une place pour micabo.
--
-- Aucun `delete`, aucun `drop` (piège du MCP, voir 0287).

create table if not exists public.concurrents_sans_marque (
  nom text primary key references public.concurrents (nom) on update cascade,
  raison text not null,
  created_at timestamptz not null default now()
);
alter table public.concurrents_sans_marque enable row level security;
insert into public.concurrents_sans_marque (nom, raison)
values ('PeECH', 'lecture audio des notes : micabo ne fait pas d''audio (Adrien, 01/10/2026)')
on conflict (nom) do nothing;

-- ---------------------------------------------------------------------------
-- Le stock
-- ---------------------------------------------------------------------------

-- Table permanente, pas temporaire : un `on commit drop` passe par le piège du
-- MCP (0287), et la table garde la trace de chaque réécriture.
create table if not exists public.audio_0291 (
  ligne uuid not null,
  pos integer not null,
  avant text not null,
  apres text not null,
  primary key (ligne, pos)
);
alter table public.audio_0291 enable row level security;
insert into public.audio_0291 values
  ('7424b3a5-33aa-485d-928d-7ecfbb4f1da2', 3, 'micabo uygulaması ile sese', 'bir uygulamayla sese'),
  ('75c74ac4-bead-4a6f-b3ca-364db9c827fa', 3, 'micabo uygulaması ile', 'bir uygulamayla'),
  ('cbceb255-c0e9-4d04-9bc4-c5f4dcaa0865', 3, 'micabo uygulamasıyla notlarını', 'bir uygulamayla notlarını'),
  ('03e46d8d-25f9-41b1-a359-30207cbe6413', 3, 'micabo uygulaması ile notlarını', 'bir uygulamayla notlarını'),
  ('9e2f05a6-6241-4502-be91-6daae9c73b1d', 3, 'notlarımı micabo uygulamasına yükler', 'notlarımı bir seslendirme uygulamasına yükler'),
  ('444652d1-45f6-4fed-aef8-292a9c814006', 5, '4. micabo uygulaması (yapay zeka)', '4. sesli not uygulaması (yapay zeka)'),
  ('1283071f-36a9-491a-b87f-5d335cf14bda', 4, '(micabo uygulamasını kullanmaya başladım', '(bir uygulama kullanmaya başladım'),
  ('7f128a21-ac81-43fc-811d-86a264e1ba2a', 3, E'micabo uygulaması\nile', E'bir uygulama\nile'),
  ('fc4cd218-f648-423b-a7a6-9fd16d2d8e4c', 3, 'notlarını micabo uygulaması ile sese', 'notlarını bir uygulamayla sese'),
  ('fdc186e9-ce4d-4a30-b027-21b29b2ad2b7', 3, 'notlarımı micabo uygulamasına yükledim', 'notlarımı bir seslendirme uygulamasına yükledim'),
  ('39638731-c41e-49dc-97c4-5b47478b93bc', 3, 'notlarımı micabo uygulaması ile sese', 'notlarımı bir uygulamayla sese'),
  ('b257f68c-ca64-4c70-a949-d5e85cbe8601', 3, E'micabo uygulaması ile\nsese', E'bir uygulamayla\nsese'),
  ('5cd305bd-817b-4bb4-b9bc-95a4e56926ac', 3, 'Karteikarten, Audio-Modus...', 'Karteikarten...'),
  ('38794234-00ad-47a9-a30c-5a9ccd8a2838', 3, 'flashcards, audio mode...', 'flashcards...'),
  ('0385758c-6514-4363-8e25-3a60e7525af7', 3, 'flashcards, modo audio...', 'flashcards...'),
  ('ec92ea03-9abc-4d2a-b1a3-3a4d83f173fc', 3, 'flashcards, mode audio...', 'flashcards...'),
  ('3bf28f5c-a8b5-4f75-be0e-9a25785ac31b', 3, 'bilgi kartları, sesli mod gibi', 'bilgi kartları gibi')
on conflict (ligne, pos) do nothing;

insert into public.micabo_marque_sauvegarde (etiquette, surface, ligne_id, colonne, valeur)
select 'avant_sans_audio_2026_10_01', 'contenu_langues', cl.id::text, 'slides', cl.slides::text
  from public.contenu_langues cl
 where cl.id in (select ligne from public.audio_0291);

update public.contenu_langues cl
   set slides = (
     select jsonb_agg(
              case when a.ligne is not null
                   then jsonb_set(e, '{texte_overlay}', to_jsonb(replace(e->>'texte_overlay', a.avant, a.apres)))
                   else e end
              order by o)
       from jsonb_array_elements(cl.slides) with ordinality as t(e, o)
       left join public.audio_0291 a on a.ligne = cl.id and a.pos = (e->>'position')::int)
 where cl.id in (select ligne from public.audio_0291)
   and jsonb_typeof(cl.slides) = 'array';

-- Les deux posts non publiés qui portaient ce texte (0949587a et 988a867a, tr).
select public.corriger_texte_post(
         pa.id, 3,
         replace(replace(ps.texte_overlay, 'micabo uygulaması ile sese', 'bir uygulamayla sese'),
                 E'micabo uygulaması\nile', E'bir uygulama\nile'),
         '0291 : micabo ne fait pas d''audio, PeECH sans marque')
  from public.passages pa
  join public.post_slides ps on ps.post_id = pa.post_id and ps.position = 3
 where pa.id in ('87951088-cd17-4b5b-b340-e756cec9cc0d', '88ad39f1-3ff9-454b-82e1-efd745d7c997')
   and pa.statut <> 'publie' and pa.publie_at is null
   and ps.texte_overlay ~* '\mmicabo\M';

-- ---------------------------------------------------------------------------
-- Le prompt v2
-- ---------------------------------------------------------------------------

update public.prompts
   set contenu = replace(replace(contenu,
         E'- donne la date de son exam et la note qu''il vise, et sait quoi réviser chaque jour.\n',
         E'- donne la date de son exam et la note qu''il vise, et sait quoi réviser chaque jour.\nmicabo ne lit pas les notes à voix haute : jamais d''audio, de podcast ni de lecture vocale.\n'),
         E'(Wilgo, Quizlet, Anki, une appli audio, Notion ou ChatGPT présentés pour réviser) : c''est la place que le compte d''origine réservait à sa pub. micabo la prend, dans la même forme. Un classement où l''outil n''est qu''un élément noté ne compte pas.',
         E'(Wilgo, Quizlet, Anki, Notion ou ChatGPT présentés pour réviser) : c''est la place que le compte d''origine réservait à sa pub. micabo la prend, dans la même forme. Un classement où l''outil n''est qu''un élément noté ne compte pas. Une appli audio non plus : micabo ne fait pas ce qu''elle fait.'),
       updated_at = now()
 where cle = 'placement_micabo_v2';
