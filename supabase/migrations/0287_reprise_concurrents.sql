-- 0287 — Plus aucune slide ne fait la publicité d'un concurrent (01/10/2026).
--
-- Le placement micabo réécrit UNE slide ; les autres gardaient la publicité du
-- compte d'origine. Sur les decks de `jeanne.wilgo` (le compte de l'appli
-- Wilgo) : 27 decks en langue d'origine sur 48 (56 %) et 27 traduits sur 105
-- (26 %) citaient encore un concurrent. Demande d'Adrien : les slides ne citent
-- plus de concurrent par erreur de placement, sauf dans un classement.
--
-- 99 slides relues une par une, deck entier sous les yeux (fr, de, es, tr, en) :
-- 73 remplacées, 26 laissées. Les règles appliquées, écrites dans la
-- colonne `motif` de chaque ligne :
--   - recommandation, consigne, témoignage isolé, méthode à son nom, reste de
--     fiche App Store → le nom du concurrent devient la forme de marque de la
--     langue ; le reste MOT POUR MOT, promesses comprises (décision d'Adrien :
--     « gratuite », « vérifiée par des profs » restent) ;
--   - classement où le concurrent est le GAGNANT → c'est son placement, il
--     devient micabo (le placement allemand de 5cc2bb38 le faisait déjà) ;
--   - classement ou comparatif où il n'est qu'un élément noté, et micabo gagne
--     → laissé, et marqué `concurrent_laisse` sur la slide pour que le moteur
--     ne le rejuge pas à chaque assignation ;
--   - deux slideshows en file (9dc90d30, fabbb97c) faits de captures de fiches
--     App Store : laissés, à refuser dans la file — réécrire le texte
--     n'enlèverait pas l'image ;
--   - « study smarter » est une expression anglaise courante, pas l'appli :
--     le motif StudySmarter passe en un mot.
--
-- Les décisions sont rangées dans `concurrents_reprise_0287` (une ligne par
-- slide, avec son motif), puis appliquées : c'est la trace de ce qui a été
-- jugé, comme les lignes explicites de 0283. Appliquée en plusieurs envois :
-- tables, décisions (deux envois), posts concernés, puis écritures.
--
-- Piège de l'outil, à connaître : le MCP Supabase demande une confirmation
-- humaine avant toute instruction destructive (`delete`, `drop`), et sans
-- interface pour la donner il attend jusqu'à son délai de 60 s, puis la
-- transaction est annulée. Les quatre premiers essais sont tombés là-dessus
-- (un `delete from burn_rendus` vide et des `drop table` de tables
-- temporaires). Les écritures ci-dessous n'en contiennent aucun ;
-- `burn_rendus` était vide, rien n'y était à jeter.
--
-- Chaque ligne est gardée par l'empreinte md5 du texte d'avant : un deck édité
-- entre-temps n'est pas écrasé. Les posts NON publiés de J-2 à J suivent leur
-- deck ; les publiés ne sont jamais touchés. Sauvegarde d'abord (leçon de
-- 0262) dans `concurrents_reprise_sauvegarde`, journal dans
-- `concurrents_corrections`.

update public.concurrents
set motif = '\mstudysmarter\M',
    note = 'en un mot : « study smarter » est une expression anglaise courante (0287)'
where nom = 'StudySmarter';

create table if not exists public.concurrents_reprise_sauvegarde (
  id bigserial primary key,
  cible text not null check (cible in ('contenu_langues', 'passages', 'post_slides', 'posts')),
  ref_id uuid not null,
  slides jsonb,
  texte text,
  hashtags text,
  sauve_le timestamptz not null default now()
);
alter table public.concurrents_reprise_sauvegarde enable row level security;

create table if not exists public.concurrents_reprise_0287 (
  contenu_id uuid not null,
  langue text not null,
  position integer not null,
  md5_avant text not null,
  decision text not null check (decision in ('remplacer', 'laisser')),
  apres text,
  motif text,
  primary key (contenu_id, langue, position)
);
alter table public.concurrents_reprise_0287 enable row level security;

-- Décisions, premier envoi.
insert into public.concurrents_reprise_0287 values
  ('0cec3333-03a3-4ea4-bc68-d64675ae8f16', 'fr', 5, 'b333540c249b91c9f8743e5635151648', 'remplacer', $t$Arrête de demander à
ChatGPT de faire le travail à ta
place.

Il te donne la réponse, tu
recopies et tu ne retiens rien.

Il existe des IA faites pour
réviser (par exemple l'appli micabo)
qui te font chercher au lieu
de répondre à ta place. C'est
là que tu apprends vraiment.$t$, $t$Recommandation d'une IA de révision (« par exemple wilgo ») dans une liste de conseils, pas un comparatif.$t$),
  ('0dc9500a-c0a8-40e4-9b96-2ff8d6fece53', 'fr', 4, 'e5e46364491af997a18d2fb72488fedd', 'remplacer', $t$Utilise l'IA pour réviser 🤖
N'utilise pas chatGPT mais
révise ne faisant des quizz ou
des annales sur l'appli micabo$t$, $t$Consigne « révise sur Wilgo AI » suivie d'un reste de fiche App Store, retiré.$t$),
  ('10c662f6-3802-4639-89e5-f2a50af88deb', 'fr', 3, '005b30250a53c6899ae6b20238a3c708', 'remplacer', $t$PHYSIQUE/CHIMIE - 17,5
J'apprenais le cours
en blurting d'abord,
ensuite je faisais des quizz
sur l'appli micabo (gratuite).$t$, $t$Témoignage « je faisais des quizz sur l'app Wilgo » dans des méthodes par matière, pas un comparatif.$t$),
  ('10c662f6-3802-4639-89e5-f2a50af88deb', 'fr', 5, 'fd89f97f159861616c016d33e0815b03', 'remplacer', $t$PHILO - 14,5
C'était ma matière faible.
Je refaisais des annales
corrigées (sur l'appli micabo,
gratuite).$t$, $t$Témoignage « annales sur l'app Wilgo » dans des méthodes par matière, pas un comparatif.$t$),
  ('10c662f6-3802-4639-89e5-f2a50af88deb', 'tr', 3, 'bd4a2cfaccafa91ce2a26fe10364fd9d', 'remplacer', $t$FİZİK/KİMYA - 17,5
Önce konuları ezberler,
sonra micabo uygulamasından
(ücretsiz) test çözerdim.$t$, $t$Témoignage isolé (« je faisais des tests sur l'appli Wilgo ») dans une liste de conseils par matière, pas un comparatif.$t$),
  ('12a7280a-ddf9-43d8-9636-d4b41653680c', 'de', 2, 'd1825295248da8a9c64c6a62efd30a4a', 'laisser', null, $t$Comparatif « X genutzt », une slide par appli, micabo est dans la liste.$t$),
  ('12a7280a-ddf9-43d8-9636-d4b41653680c', 'de', 4, 'd78a3d7a2abb45ae9b9b921c1b2f2cc6', 'laisser', null, $t$Comparatif « X genutzt », une slide par appli, micabo est dans la liste.$t$),
  ('12a7280a-ddf9-43d8-9636-d4b41653680c', 'de', 6, '93858ad873f1b49d4a436eb83d46c480', 'laisser', null, $t$Comparatif « X genutzt », une slide par appli, micabo est dans la liste.$t$),
  ('12a7280a-ddf9-43d8-9636-d4b41653680c', 'en', 2, '4f250522c8b39227d3ba003566d2962a', 'laisser', null, $t$Comparatif « Used X », une slide par appli (chatgpt, quizlet, micabo, Turbo AI, knowunity).$t$),
  ('12a7280a-ddf9-43d8-9636-d4b41653680c', 'en', 6, '258bf8652abfa460516960e1549b095f', 'laisser', null, $t$Comparatif « Used X », une slide par appli (chatgpt, quizlet, micabo, Turbo AI, knowunity).$t$),
  ('12a7280a-ddf9-43d8-9636-d4b41653680c', 'es', 2, '7a8195e13de4f619d53114f77e5e1216', 'laisser', null, $t$Comparatif « Usaste X », une slide par appli, micabo est dans la liste.$t$),
  ('12a7280a-ddf9-43d8-9636-d4b41653680c', 'es', 4, '79f877c2f4fcb7aec34696d45a1a456a', 'laisser', null, $t$Comparatif « Usaste X », une slide par appli, micabo est dans la liste.$t$),
  ('12a7280a-ddf9-43d8-9636-d4b41653680c', 'es', 6, '9290fd99b596608968a8759c619567e4', 'laisser', null, $t$Comparatif « Usaste X », une slide par appli, micabo est dans la liste.$t$),
  ('12a7280a-ddf9-43d8-9636-d4b41653680c', 'fr', 2, '6e010c3252f2383afe0942afecb0ba00', 'laisser', null, $t$Comparatif « j'ai utilisé X » une slide par appli, micabo inclus : élément de liste.$t$),
  ('12a7280a-ddf9-43d8-9636-d4b41653680c', 'fr', 4, 'd7bd03d652092ec276621d8e3f605537', 'laisser', null, $t$Comparatif « j'ai utilisé X » une slide par appli, micabo inclus : élément de liste.$t$),
  ('12a7280a-ddf9-43d8-9636-d4b41653680c', 'fr', 6, '302f322cc24ab256490addf45bdd45f5', 'laisser', null, $t$Comparatif « j'ai utilisé X » une slide par appli, micabo inclus : élément de liste.$t$),
  ('12a7280a-ddf9-43d8-9636-d4b41653680c', 'tr', 2, '5c9fbf77f01a55308103bbd89ba8ff40', 'laisser', null, $t$Comparatif « X kullandım », une slide par appli (chatgpt, quizlet, micabo, Turbo AI, knowunity).$t$),
  ('12a7280a-ddf9-43d8-9636-d4b41653680c', 'tr', 4, 'e9103c912df35c6ced12e73cf62074c6', 'laisser', null, $t$Comparatif « X kullandım », une slide par appli (chatgpt, quizlet, micabo, Turbo AI, knowunity).$t$),
  ('12a7280a-ddf9-43d8-9636-d4b41653680c', 'tr', 6, '1af967218587dd12e5e62f1416b0267d', 'laisser', null, $t$Comparatif « X kullandım », une slide par appli (chatgpt, quizlet, micabo, Turbo AI, knowunity).$t$),
  ('23ab67f8-7f89-4eba-9985-9172e376a5e3', 'de', 3, '45e7be3564db577e42a69f2449c08496', 'remplacer', $t$#2
Die besten Schüler
lernen nicht mehr,
sie nutzen einfach
die micabo-App.$t$, $t$Présenté comme ce que font les meilleurs élèves (nom nu objet de « nutzen »).$t$),
  ('23ab67f8-7f89-4eba-9985-9172e376a5e3', 'fr', 3, '4be551933e6b922909d170dafca0e360', 'remplacer', $t$#2
Les mentions TB ne
révisent plus, ils utilisent
juste l'appli micabo$t$, $t$Présenté comme ce que font les mentions TB.$t$),
  ('2cd5ac77-b7e5-4a3b-b19c-6fd58f4a53c5', 'de', 5, '1e4709fd4078e0d717dc94d19621854c', 'remplacer', $t$Die micabo-App
9/10
✅✅
Zuverlässig, weil von Lehrern geprüft. Auch super, um deine Notizen zu wiederholen und für Prüfungen zu lernen.$t$, $t$classement d'IA où le concurrent est le gagnant (9/10) : c'est son placement, son nom devient micabo, le reste mot pour mot ; le CTA déjà présent n'est pas doublé$t$),
  ('2cd5ac77-b7e5-4a3b-b19c-6fd58f4a53c5', 'fr', 5, 'd216563a2411d9c64f438810459d245a', 'remplacer', $t$l'appli micabo
9/10
✅✅
Fiable car vérifiée par des
profs de l'éducation-
nationale + très cool pour
revoir les cours (quizz,
fiches, coach IA...)$t$, $t$classement d'IA où le concurrent est le gagnant (9/10) : c'est son placement, son nom devient micabo, le reste mot pour mot$t$),
  ('2cd5ac77-b7e5-4a3b-b19c-6fd58f4a53c5', 'tr', 5, '7a3989a292bd5aee0e00a2c320711cf8', 'remplacer', $t$micabo uygulaması
9/10
✅✅
daha az hata yapıyor,
sınav tarihlerine göre
onunla çalış$t$, $t$classement d'IA où le concurrent est le gagnant (9/10) : c'est son placement, son nom devient micabo, le reste mot pour mot ; le CTA déjà présent devient « onunla » (avec elle)$t$),
  ('3104a723-2895-46de-8f51-837e85ec2f28', 'fr', 2, 'b334b564e7f97587d39f4cc857dd865c', 'remplacer', $t$HISTOIRE GÉO :
- Beaucoup d'apprentissage par cœur du cours
- Regarder des vidéos sur le sujet
- Utiliser la méthode blurting puis faire des
quizzs sur l'appli micabo$t$, $t$Conseil « faire des quizzs sur Wilgo » dans une liste d'astuces, pas un comparatif.$t$),
  ('3104a723-2895-46de-8f51-837e85ec2f28', 'tr', 2, 'e4853f451f4dc78297fa8b19df871901', 'remplacer', $t$TARİH COĞRAFYA:
- dersi bayağı ezberle
- konuyla ilgili videolar izle
- blurting tekniğini kullan sonra micabo uygulamasından test çöz$t$, $t$Impératif « Wilgo'dan test çöz » dans une liste de conseils, pas un comparatif.$t$),
  ('35ff7bf9-7756-4d37-852c-b63434562d11', 'fr', 3, 'f38c2be0c6fa3f5a154062e0ef2cf1ac', 'remplacer', $t$Entraîne toi avec l'IA 🤖
Avant les contrôle entraîne-toi avec des
quiz sur l'appli micabo. Corrigés par l'IA, et fait
par des vrais profs.

Tu progresses pour de vrai, tu relis pas
uniquement tes cours.$t$, $t$Impératif « entraîne-toi avec des quiz sur Wilgo ».$t$),
  ('36cb4e8a-1ebc-447a-bd3a-3fbbee9e098c', 'de', 2, 'e607f3f554ff3e7633199c992470baae', 'remplacer', $t$Französisch
18,5
Ich bin im ersten Jahr der Oberstufe, also habe ich dieses Jahr Abitur. Ich lerne mindestens eine Stunde pro Wochenende. Ich wiederhole die linearen Analysen der Woche und schaue mir frühere Prüfungsaufgaben an (auf der micabo-App).$t$, $t$Témoignage « j'utilise Wilgo » isolé, le deck n'est pas un comparatif.$t$),
  ('36cb4e8a-1ebc-447a-bd3a-3fbbee9e098c', 'de', 4, 'c3fbbb734bfa8c478db1a8538374d55f', 'remplacer', $t$Mathe
20
Ähnlich wie bei Französisch: Das Abitur kommt bald, also mache ich mindestens eine Übung pro Woche mit Probeklausuren auf der micabo-App. Und vor allem zwinge ich mich, den Stoff der Vorwoche gut zu kennen. Sonst ist es unmöglich, die Übungen zu schaffen. Manchmal schaue ich mir auch Yvan Monka an.$t$, $t$Témoignage « j'utilise Wilgo » isolé, le deck n'est pas un comparatif.$t$),
  ('36cb4e8a-1ebc-447a-bd3a-3fbbee9e098c', 'fr', 2, '9fd996b3b114c9d1e5040a7694e2c9aa', 'remplacer', $t$Français
18,5
Je suis en 1ère donc j'ai le
bac cette année, je fais
minimum 1h par week-
end. Je revois les
analyses linéaires de la
semaine et je regarde des
corrigés d'annales (sur
l'appli micabo).$t$, $t$Témoignage isolé « corrigés d'annales sur Wilgo », pas un comparatif.$t$),
  ('36cb4e8a-1ebc-447a-bd3a-3fbbee9e098c', 'fr', 4, 'ff7bb87c61553bcefe9e2f7068870635', 'remplacer', $t$Maths
20
Pareil que pour le
français, bac bientôt
donc je fais au moins un
exo de sujet blanc par
semaine sur l'appli micabo. Et
surtout je m'oblige à
connaitre bien ma leçon
d'une semaine à l'autre
sinon impossible de
réussir les exo + je
regarde Yvan Monka
parfois$t$, $t$Témoignage isolé « un exo par semaine sur Wilgo », pas un comparatif.$t$),
  ('36cb4e8a-1ebc-447a-bd3a-3fbbee9e098c', 'fr', 7, '53e4d054c596a2e4281f3cca64829729', 'remplacer', $t$Histoire Géo
17,5
J'aime bcp l'histoire
donc je regarde bcq de
vidéos et je fais des quizz
pour le fun mais aussi
pour réviser. 20min par
jour sur des app de
culture G ou sur l'appli micabo
pcq y'a aussi les leçons$t$, $t$Témoignage isolé « 20 min par jour sur Wilgo », pas un comparatif.$t$),
  ('3bd80908-7451-4bd6-8716-6abed1bf77cf', 'fr', 6, '2de320073ead46584c85a4d4d6d414f8', 'remplacer', $t$Perso on s'entraînait sur
l'appli micabo

y'a toutes les annales
corrigées et tout le
programme du brevet, et
on s'entraînait à fond avec
les quizz.$t$, $t$Témoignage isolé « on s'entraînait sur Wilgo ».$t$),
  ('42c35251-eba3-4cff-93a2-41316e51a5fb', 'de', 2, 'afaf38c5efd9af4d0010faca8e86924a', 'remplacer', $t$Radiologie
11/10
Der wahre Geheimtrick
in der Medizin.
200-300k pro Jahr in
eigener Praxis. Du arbeitest
im Dunkeln, siehst
niemanden und machst
um 15 Uhr Schluss. Das ist
was für Leute, die eine
sichere, stabile Karriere
wollen.
Schwierigkeit: 9/10, viel
Auswendiglernen, also
volle Pulle die micabo-App.$t$, $t$Prescription « Anki à fond » ; le classement porte sur des spécialités, pas sur des applis.$t$),
  ('42c35251-eba3-4cff-93a2-41316e51a5fb', 'es', 2, 'e502b78b1a268d19eb20a2507770a73c', 'remplacer', $t$Radiología
11/10
El verdadero atajo
de la medicina.
200-300k al año en
práctica privada. Trabajas
en la oscuridad, no ves
a nadie, y terminas
a las 3 de la tarde. Es para
quienes quieren una
carrera segura y estable.
Dificultad: 9/10, mucha
memorización, así que
la app micabo a tope.$t$, $t$Prescription « Anki à fond » ; le classement porte sur des spécialités, pas sur des applis.$t$),
  ('42c35251-eba3-4cff-93a2-41316e51a5fb', 'fr', 2, 'd2897c362c7a4cfd0323f6af32c186a3', 'remplacer', $t$Radiologie
11/10
Le vrai "cheat code"
de la médecine.
200-300k par an en
libéral. Tu travailles
dans le noir, tu ne vois
personne, et tu finis
à 15h. C'est fait pour
ceux qui veulent une
carrière sûre et stable.
Difficulté : 9/10, beaucoup
de parcoeur donc l'appli micabo
à fond$t$, $t$Le classement porte sur les spécialités ; « Anki à fond » est une consigne, pas un élément noté.$t$),
  ('42c35251-eba3-4cff-93a2-41316e51a5fb', 'tr', 2, 'b1d0ee670eadaed6e942d78768801126', 'remplacer', $t$Radyoloji
11/10
Tıbbın gerçek "hile kodu".
Özelde yılda 200-300 bin kazanılıyor.
Karanlıkta çalışıyorsun, kimseyi görmüyorsun,
saat 3'te işin bitiyor.
Sağlam, stabil bir kariyer isteyenler için.
Zorluk: 9/10,
çok ezber var o yüzden micabo uygulamasını fulle.$t$, $t$Consigne « o yüzden Anki'yi fulle » (cas cité par la règle) ; le classement porte sur des spécialités médicales, pas sur des applis.$t$),
  ('435b309b-43b2-4e59-9237-e4562fa47e14', 'de', 4, '66d4c6039c42d7f8f57b82c8eb2a87b0', 'remplacer', $t$Wiederhole die Fächer, die dir am schwersten fallen.
Lerne jedes Kapitel. Nutz Lern-Apps, die dir helfen. Meine Lieblings-App ist die micabo-App.$t$, $t$Reste de fiche App Store Wilgo derrière le CTA micabo : retiré.$t$),
  ('435b309b-43b2-4e59-9237-e4562fa47e14', 'es', 4, '71037c3b3447698cb141b0c2f838a01b', 'remplacer', $t$Repasa tus materias
más difíciles

Aprende sobre cualquier
capítulo. Usa apps
de repaso para ayudarte.
Mi favorita es la app micabo.$t$, $t$Reste de fiche App Store Wilgo derrière le CTA micabo : retiré, « : » final changé en « . ».$t$),
  ('435b309b-43b2-4e59-9237-e4562fa47e14', 'fr', 4, 'a626e1a6cff784591547d38138fe5965', 'remplacer', $t$Réviser les matières les
plus difficiles pour toi

Apprends sur n'importe
quel chapitre. utilise des
applications de révision
pour t'aider. Ma préférée
c'est micabo$t$, $t$Reste de fiche App Store Wilgo derrière « Ma préférée c'est micabo » : retiré (la slide porte déjà micabo), deux-points final ôté.$t$),
  ('435b309b-43b2-4e59-9237-e4562fa47e14', 'tr', 4, 'edcd2f8f411c68157e93080527a9af7f', 'remplacer', $t$sana en zor gelen konuları tekrar et

herhangi bir bölümden öğren. sana yardımcı olması için tekrar uygulamaları kullan. benim favorim micabo uygulaması.$t$, $t$Reste de fiche App Store Wilgo derrière le CTA micabo : retiré, et le « : » devenu orphelin passe en point.$t$),
  ('466bb7ba-8f18-4430-9148-55d8c51f7c18', 'fr', 5, 'b333540c249b91c9f8743e5635151648', 'remplacer', $t$Arrête de demander à
ChatGPT de faire le travail à ta
place.

Il te donne la réponse, tu
recopies et tu ne retiens rien.

Il existe des IA faites pour
réviser (par exemple l'appli micabo)
qui te font chercher au lieu
de répondre à ta place. C'est
là que tu apprends vraiment.$t$, $t$Recommandation d'une IA de révision (« par exemple wilgo ») dans une liste de conseils, pas un comparatif.$t$),
  ('5cc2bb38-cd4d-49f3-94bb-d54663a7efcc', 'fr', 4, 'd216563a2411d9c64f438810459d245a', 'remplacer', $t$l'appli micabo
9/10
✅✅
Fiable car vérifiée par des
profs de l'éducation-
nationale + très cool pour
revoir les cours (quizz,
fiches, coach IA...)$t$, $t$classement d'IA où le concurrent est le gagnant (9/10) : c'est son placement, son nom devient micabo, le reste mot pour mot$t$),
  ('5cc2bb38-cd4d-49f3-94bb-d54663a7efcc', 'tr', 4, '73dd1e95046581f97c2c7f31891a9219', 'remplacer', $t$micabo uygulaması ile notlarını yükle, sana özel çalışma planı oluştursun ve testlerle tekrar et.$t$, $t$case du gagnant : le concurrent n'était cité que pour être écarté au profit de micabo, retiré$t$),
  ('6b08dcfb-090d-4cb9-81d0-2c3a143819a2', 'fr', 4, '3b1a5cf60a5957ea7ba93d143ea1e9b8', 'remplacer', $t$Réviser les matières les
plus difficiles pour toi

Apprends sur n'importe
quel chapitre. utilise des
applications de révision
pour t'aider. Ma préférée
c'est l'appli micabo$t$, $t$« Ma préférée c'est wilgo » est une recommandation ; reste de fiche App Store retiré, deux-points final ôté.$t$),
  ('71fa02d1-cd9e-435d-bcb1-19eda1ea6557', 'tr', 5, '98606ad8407f27fc6196e5f824f6fddb', 'remplacer', $t$4) yaptığın hataları ve
karmaşık soru/akıl yürütmeleri
bul ve NOT AL

seçenek 1: zamanın varsa
-> hataları tekrar yapmamak
için yeni alıştırmalar çöz

seçenek 2: çok hata yaptığın
konularda micabo uygulamasını kullanarak
çoktan seçmeli testler yap

seçenek 3: zamanın yoksa
notlarını tekrar oku ve sınavda
hataları yapmamak için
onları düşün$t$, $t$Consigne « WILGO'yu kullanarak testler yap » dans une routine de révision, pas un comparatif.$t$),
  ('766074b1-379b-432e-8469-c8a805b904af', 'de', 3, 'a4c1ae0fc62bf8aba254d646e056ee7c', 'remplacer', $t$#2 Die, die Bestnoten bekommen, nutzen die micabo-App$t$, $t$Méthode à son nom présentée comme celle des élèves à Bestnoten.$t$),
  ('766074b1-379b-432e-8469-c8a805b904af', 'es', 3, 'e26e444941ad16765a42b55206f1ca66', 'remplacer', $t$#2 Los que sacan
sobresaliente usan
la app micabo$t$, $t$Méthode à son nom présentée comme celle des élèves à sobresaliente.$t$),
  ('766074b1-379b-432e-8469-c8a805b904af', 'fr', 3, 'd366c827ff247a201e0ea1cd47c114c1', 'remplacer', $t$#2 ceux qui ont la
mention TB, utilisent
l'appli micabo$t$, $t$« ceux qui ont la mention TB utilisent la méthode WILGO » : méthode à son nom.$t$),
  ('766074b1-379b-432e-8469-c8a805b904af', 'tr', 3, '45692d722fd7b29583416712a58b0fcb', 'remplacer', $t$#2 çok iyi derece yapanlar,
micabo uygulamasını
kullanıyor$t$, $t$Méthode au nom du concurrent présentée comme ce que font ceux qui réussissent (cas cité par la règle).$t$)
on conflict do nothing;

-- Décisions, second envoi.
insert into public.concurrents_reprise_0287 values
  ('78dd627a-4350-4f11-bb1e-958e3b8c4efc', 'fr', 4, '16bf6610ea1c2f452df2a0c4065f440c', 'remplacer', $t$Réviser les matières les
plus difficiles pour toi

Apprends sur n'importe
quel chapitre, utilise des
applications de révision
pour t'aider. Ma préférée
c'est l'appli micabo$t$, $t$« Ma préférée c'est wilgo » est une recommandation ; reste de fiche App Store retiré, deux-points final ôté.$t$),
  ('8264527a-26fb-4d2f-bfd3-d3a097d4eb2d', 'de', 3, 'a65affffbcd1f507bb58fcf46ef694d4', 'remplacer', $t$DIE FREIHEIT
In 5 Jahren nie als Hauptthema geprüft, obwohl es im Zentrum des Lehrplans steht. Sartre, Spinoza, Rousseau.

Übe mit den Quizzen der micabo-App, um sicherzustellen, dass du jeden Begriff vor dem großen Tag beherrschst.

Das ist die Art von Kapitel, wo ein Fehler am Prüfungstag richtig teuer wird.$t$, $t$Impératif « Übe mit Wilgo-Quizzen ».$t$),
  ('8264527a-26fb-4d2f-bfd3-d3a097d4eb2d', 'fr', 3, '327a9007f3820c70a900959e6a04e874', 'remplacer', $t$LA LIBERTÉ
Jamais testée comme sujet
principal en 5 ans alors que c'est
au cœur du programme. Sartre,
Spinoza, Rousseau.

Entraîne-toi sur les quiz de l'appli micabo
pour être sûr de maîtriser chaque
notion avant le jour J.

C'est le genre de chapitre où une
confusion le jour de l'épreuve te
coûte très cher.$t$, $t$Impératif « Entraîne-toi sur les quiz Wilgo ».$t$),
  ('8e88d77c-fa89-4a92-bd83-94cc672ea6cb', 'de', 3, 'c0925379e1982d5f0ac81acedeed400a', 'remplacer', $t$Benutz die micabo-App. Das ist dein Cheatcode für gute Noten.

Im Bus, statt auf Social Media rumzuhängen, startest du sie.
Mach einfach Quizfragen im Fach deiner Wahl. Du merkst nicht mal, dass du lernst.$t$, $t$Impératif « Benutz die WILGO App » + « startest du WILGO ». — 2e mention en pronom$t$),
  ('8e88d77c-fa89-4a92-bd83-94cc672ea6cb', 'fr', 3, 'b8d45398af5c0afebcda5086d92ab99a', 'remplacer', $t$Utilise l'appli micabo
(le cheatcode pour tes
notes)
Dans le bus, au lieu de
passer du temps sur les
réseaux, tu la lances.
Commence à faire des
quiz dans la matière que tu
choisis, t'auras même pas
l'impression de bosser.m$t$, $t$Impératif « Utilise l'app WILGO » ; la 2e mention devient un pronom pour ne pas mettre deux micabo dans la slide.$t$),
  ('9dc90d30-3b1f-4c61-8be3-0dbe965f369d', 'fr', 4, '5ed89b85823340987f19e994665179ef', 'laisser', null, $t$slideshow en file (brouillon) fait de captures de fiches App Store : à refuser dans la file, pas à réécrire$t$),
  ('9dc90d30-3b1f-4c61-8be3-0dbe965f369d', 'fr', 5, 'a0a411e28dd4fa280f196fcc8167330d', 'laisser', null, $t$slideshow en file (brouillon) fait de captures de fiches App Store : à refuser dans la file, pas à réécrire$t$),
  ('a3389b9b-a5cc-4803-8863-04939804d472', 'en', 1, '7e55a1dbc10473d552a357d8f9b9cd10', 'laisser', null, $t$faux positif : « study smarter » est l'expression courante ; motif StudySmarter resserré en un mot (0287)$t$),
  ('a3389b9b-a5cc-4803-8863-04939804d472', 'en', 3, 'f477e5726e4c9144cd0eff3fa89aa331', 'remplacer', $t$2. The 80/20 Rule +
Q&A with the micabo app

Focus on the 20% of topics
that are most likely to help
you score 80% of the marks
(like frequently asked
questions).$t$, $t$Brainly prescrit comme astuce dans une liste de conseils, pas un comparatif ; groupe réordonné au minimum pour tenir en anglais.$t$),
  ('a3389b9b-a5cc-4803-8863-04939804d472', 'fr', 3, '13611914a7b9f073af17cdf2c66169f0', 'remplacer', $t$2. la règle des 80/20 +
l'appli micabo

concentre-toi sur les 20% de sujets
qui te rapporteront 80% des points
(genre les questions qui tombent souvent)$t$, $t$Astuce prescrite « règle des 80/20 + Brainly Q&A », pas un comparatif.$t$),
  ('a3389b9b-a5cc-4803-8863-04939804d472', 'tr', 3, '2b5fb5f6d608cd87f0186d438393856c', 'remplacer', $t$2. 80/20 kuralı +
micabo uygulaması ile soru-cevap

notların %80'ini almana yardımcı olacak
konuların %20'sine odaklan (sık sorulanlar gibi).$t$, $t$Brainly prescrit comme astuce dans une liste de conseils, pas un comparatif ; « ile » ajouté pour que le groupe tienne.$t$),
  ('a90df94f-3d17-4b6f-9310-3a472798ab73', 'fr', 4, 'b3c3cb454a907637b8e36ebf52e7c488', 'remplacer', $t$Autre technique qui parait
bizarre mais qui marche trop :
C'est de faire énormément de
qcm et quizz, il recommande de
réviser avec l'appli micabo.

L'IA génère quiz, fiches et
corrigés d'exo et des profs
corrigent tout pour que ce soit
adapté à l'élève$t$, $t$Recommandation « il recommande de réviser avec Wilgo ».$t$),
  ('a9b94091-83f3-4c00-8161-5915bd1321ca', 'de', 3, '19055d0e992d3fa05cae1b3bb3f12eb6', 'remplacer', $t$DIE FREIHEIT
In 5 Jahren nie als Hauptthema geprüft, obwohl es im Zentrum des Lehrplans steht. Sartre, Spinoza, Rousseau.
Übe mit den Quiz der micabo-App, um sicherzustellen, dass du jedes Konzept beherrschst, bevor der große Tag kommt.
Das ist die Art von Kapitel, bei der ein Fehler am Prüfungstag dich teuer zu stehen kommt.$t$, $t$Impératif « Übe mit den Wilgo-Quiz ».$t$),
  ('a9b94091-83f3-4c00-8161-5915bd1321ca', 'fr', 3, 'a75faf9d84eb46c81f9baba93c4a4fe5', 'remplacer', $t$LA LIBERTÉ
Jamais testée comme sujet
principal en 5 ans alors que c'est
au cœur du programme. Sartre,
Spinoza, Rousseau.
Entraîne-toi sur les quiz de l'appli micabo
pour être sûr de maîtriser chaque
notion avant le jour J.
C'est le genre de chapitre où une
confusion le jour de l'épreuve te
coûte très cher.$t$, $t$Impératif « Entraîne-toi sur les quiz Wilgo ».$t$),
  ('a9b94091-83f3-4c00-8161-5915bd1321ca', 'tr', 3, '4b1e6349811c54614af9137fb70745b2', 'remplacer', $t$ÖZGÜRLÜK
5 yıldır ana konu olarak hiç test edilmedi ama programın tam kalbinde. Sartre, Spinoza, Rousseau.

micabo uygulamasının testleriyle çalış ki sınavdan önce her konuya hakim ol. Bu, sınav günü küçük bir karışıklığın sana çok pahalıya mal olabileceği türden bir bölüm.$t$, $t$Impératif « Wilgo testleriyle çalış », pas un comparatif ; génitif « uygulamasının » devant « testleriyle ».$t$),
  ('b40d78b4-f441-4fd7-8ea9-55513a013fb2', 'en', 2, '4f250522c8b39227d3ba003566d2962a', 'laisser', null, $t$Comparatif « Used X », une slide par appli (chatgpt, quizlet, turbolearn, puis micabo).$t$),
  ('b40d78b4-f441-4fd7-8ea9-55513a013fb2', 'es', 2, '7a8195e13de4f619d53114f77e5e1216', 'laisser', null, $t$Comparatif « Usaste X », une slide par appli, micabo est dans la liste.$t$),
  ('b40d78b4-f441-4fd7-8ea9-55513a013fb2', 'fr', 2, '6e010c3252f2383afe0942afecb0ba00', 'laisser', null, $t$Comparatif « j'ai utilisé X » une slide par appli, micabo inclus : élément de liste.$t$),
  ('b40d78b4-f441-4fd7-8ea9-55513a013fb2', 'tr', 2, '5c9fbf77f01a55308103bbd89ba8ff40', 'laisser', null, $t$Comparatif « X kullandım », une slide par appli (chatgpt, quizlet, turbolearn, puis micabo).$t$),
  ('bc546a2d-fe63-4b69-8867-186871a5f767', 'fr', 2, '36259fd5d101a9e204e664f61e572339', 'remplacer', $t$Le piège des fiches 📝
Elle m'a confié qu'avant elle faisait
des fiches mais "Ça lui donnait
l'impression d'avoir rien fait."
Maintenant, elle a stoppé et fait
SEULEMENT des annales à la place

(elle en faisait sur l'appli micabo,
pour elle, c'est la meilleure app de
révision)$t$, $t$Recommandation « c'est la meilleure app de révision », pas un comparatif.$t$),
  ('bcb9d216-e6fe-4885-bb18-f730ec119bfe', 'fr', 2, 'c30bd2373b097bd3bf777d8977df27b0', 'remplacer', $t$Le dormeur 😴
(Pour les étudiants qui veulent dormir mais
aussi réussir leur année)
10h00 - 10h30 : Réveil + petit-déj 🥣
10h30 - 11h30 : Première session de révision
avec l'appli micabo 🦫
11h30 - 12h30 : Pause / petite marche chill
12h30 - 13h30 : Déjeuner 🍽️
14h00 - 15h30 : Session de révision 2
(fiches, exercices) 📚
15h30 - 18h00 : temps libre / voir des potes
19h00 - 20h00 : Dîner 🥘
20h00 - 20h20 : Quiz chill pour
vérifier qu'on a retenu les infos du jour 🧠
Soir : détente / TikTok 📱
Coucher : 23h-23h30 🛌$t$, $t$Méthode à son nom dans un emploi du temps conseillé ; la 2e mention est retirée pour ne pas mettre deux micabo dans la slide.$t$),
  ('c001d578-e391-41e6-9020-9eaf3d79eed1', 'es', 3, 'b6c8804ddc21c9a0777817493f11735b', 'remplacer', $t$HISTORIA Y GEOGRAFÍA
17,5
Primero me aprendo
la lección con el método
"blurting", después hago
pruebas en la app micabo.$t$, $t$Témoignage « je fais des tests sur Wilgo » isolé, pas un comparatif.$t$),
  ('c001d578-e391-41e6-9020-9eaf3d79eed1', 'fr', 3, 'e9469ad3190940d1b2f3b53b0176ddad', 'remplacer', $t$HISTOIRE-GÉO
17,5
J'apprends d'abord le
cours avec la méthode
blurting, ensuite je fais des
quizz sur l'appli micabo$t$, $t$Témoignage isolé « je fais des quizz sur Wilgo », pas un comparatif.$t$),
  ('c001d578-e391-41e6-9020-9eaf3d79eed1', 'tr', 3, 'd15c29ff2483c5cacb49ce1c72e83bc0', 'remplacer', $t$TARİH-COĞRAFYA
17,5
Önce bulanıklaştırma
yöntemiyle dersi
öğreniyorum, sonra micabo uygulaması
üzerinden test çözüyorum.$t$, $t$Témoignage isolé (« je fais des tests sur Wilgo ») dans une liste de méthodes par matière, pas un comparatif.$t$),
  ('c001d578-e391-41e6-9020-9eaf3d79eed1', 'tr', 6, '56ad2522f483c1775d119b112dd2d442', 'remplacer', $t$FRANSIZCA
18,5
Şu an lisedeyim yani bu
yıl üniversite sınavım var,
hafta sonu minimum 1
saat çalışıyorum. Haftalık
çözümlü deneme
sınavlarına (micabo uygulamasında) bakıyorum.$t$, $t$Témoignage isolé (« je regarde les sujets corrigés sur Wilgo »), pas un comparatif.$t$),
  ('c0bfd359-d613-4a99-8a3c-b4a8f685d424', 'fr', 2, 'a1a554f6ece17aa801a6fcb28264a763', 'remplacer', $t$Histoire géo
• ma moyenne: 17,6
• mes astuces:
- regarder des vidéos ou
écouter des podcasts
sur le thème
- Faire des quiz avec
l'appli micabo chaque jour$t$, $t$Astuce prescrite « Faire des quiz avec WILGO chaque jour ».$t$),
  ('c0bfd359-d613-4a99-8a3c-b4a8f685d424', 'tr', 2, 'af0945de1d06d3f8ef13ae1e1aeb0f79', 'remplacer', $t$tarih coğrafya
• ortalamam: 17,6
• taktiklerim:
- konuyla ilgili videolar izle
ya da podcast dinle
- her gün micabo uygulaması ile test çöz$t$, $t$Impératif « her gün WILGO ile test çöz » dans une liste de tactiques, pas un comparatif.$t$),
  ('cc30ddf8-829b-419b-b935-489d5fe11a35', 'de', 2, '615b10260cf3b3fa2bece5b4b16f033c', 'remplacer', $t$Geschichte, Erdkunde
• mein Schnitt: 17,6
• meine Tricks:
- schau dir Videos an oder
hör Podcasts zum Thema
- mach täglich Quizzes mit
der micabo-App$t$, $t$Conseil impératif « mach täglich Quizzes mit WILGO ».$t$),
  ('cc30ddf8-829b-419b-b935-489d5fe11a35', 'es', 2, '2f3cf97584b4425c2462775eed676d2b', 'remplacer', $t$Historia y Geografía

• mi media: 17,6
• mis trucos:
- mira videos o
escucha podcasts
sobre el tema
- Haz quizzes con
la app micabo cada día$t$, $t$Conseil impératif « Haz quizzes con WILGO cada día ».$t$),
  ('cc30ddf8-829b-419b-b935-489d5fe11a35', 'fr', 2, '845047c50568c500d4da0302c181ea31', 'remplacer', $t$Histoire géo
• ma moyenne: 17,6
• mes astuces :
- regarder des vidéos ou
écouter des podcasts
sur le thème
- Faire des quiz avec
l'appli micabo chaque jour$t$, $t$Astuce prescrite « Faire des quiz avec WILGO chaque jour ».$t$),
  ('cd8d453b-5ba0-471c-8996-da5893629e76', 'fr', 3, '026a9731f5cf8755db042e55c5629398', 'remplacer', $t$Physique-chimie
Ma note : 18,00
Mon conseil : Apprends
les formules et révise avec
des fiches d'IA comme
l'appli micabo.$t$, $t$Conseil « révise avec des fiches d'IA comme Wilgo » ; le « Wilgo » isolé en dernière ligne (reste de logo) est retiré.$t$),
  ('d2f8752c-2d2e-4c96-8f65-29d7efaf628c', 'fr', 3, '7ec254490ff68b8ec03a73f6dbc6b1ba', 'remplacer', $t$HISTOIRE
1-apprend le plan du cours
2- fait des quizz sur l'appli micabo
pour vérifier tes
connaissances
3- apprend une accroche
pour ton intro$t$, $t$Consigne « fait des quizz sur Wilgo », pas un comparatif.$t$),
  ('dda3c488-9c6e-4847-85ca-7f872f1e05cc', 'de', 3, 'bc3802244e87c5a694f3b1d52531a028', 'remplacer', $t$PHYSIK/CHEMIE - 17,5

Ich hab den Stoff zuerst
mit Blurting gelernt,
dann hab ich Quizzes
mit der micabo-App gemacht (kostenlos).$t$, $t$Témoignage « quiz avec l'appli Wilgo » isolé, pas un comparatif.$t$),
  ('dda3c488-9c6e-4847-85ca-7f872f1e05cc', 'fr', 3, '9a51a9246d5b617ae45bbe9b5dbb1182', 'remplacer', $t$PHYSIQUE/CHIMIE - 17,5

J'apprenais le cours
en blurting d'abord,
ensuite je faisais des quizz
sur l'appli micabo (gratuite).$t$, $t$Témoignage « je faisais des quizz sur l'app Wilgo » dans des méthodes par matière, pas un comparatif.$t$),
  ('dda3c488-9c6e-4847-85ca-7f872f1e05cc', 'fr', 5, 'fd89f97f159861616c016d33e0815b03', 'remplacer', $t$PHILO - 14,5
C'était ma matière faible.
Je refaisais des annales
corrigées (sur l'appli micabo,
gratuite).$t$, $t$Témoignage « annales sur l'app Wilgo » dans des méthodes par matière, pas un comparatif.$t$),
  ('e7422935-c02e-4420-92bd-04fa6d25ea5d', 'fr', 2, '7bd873b3d1ddf35f17bb565dc6b21876', 'remplacer', $t$5 techniques infaillibles pour réviser efficacement
1. La règle des 2 minutes : Si une tâche prend moins de 2 minutes,
fais-la immédiatement. Pas d'excuses. Réponds à ce message, plie ce
t-shirt qui traîne, envoie ce mail. C'est rapide, c'est simple. Ça
t'évitera une montagne de petites tâches qui s'accumulent.
2. Utilise l'IA : Quand tu dois réviser mais que tu procrastines,
lance des quiz sur l'appli micabo corrigés par l'IA. Ça prend 15-20 minutes
max. C'est actif, c'est stimulant, et tu progresses direct. Plus
d'excuses du genre 'j'ai la flemme de relire mes cours'.
3. Le Pomodoro : Travaille intensément pendant 25 minutes, puis
pause de 5 minutes. Répète ce cycle. C'est scientifiquement
prouvé : cette méthode booste ta productivité. En plus, 25
minutes ça passe vite. Tu peux tout faire en Pomodoro.
4. La méthode Feynman : Essaye d'expliquer ton cours à quelqu'un
comme si c'était un enfant. Si tu peux pas l'expliquer
simplement, c'est que t'as pas compris. Ça te force à arrêter de
procrastiner et à vraiment bosser ton sujet. C'est radical comme
méthode.
5. Le time blocking : Planifie ta journée en blocs de temps pour
des tâches spécifiques. Pas de flou, pas de 'je verrai plus tard'. Tu
sais ce que tu fais et quand. Ça élimine l'indécision. Et l'indécision,
c'est la porte d'entrée de la procrastination.$t$, $t$Consigne « lance des quiz sur Wilgo » dans une liste de techniques.$t$),
  ('eb647307-93d9-4aa4-bcdb-b2d667a4b450', 'de', 2, '4338294cc4167c80ba110f02448a5b3e', 'laisser', null, $t$Méthode notée et jugée (6/10, perte de temps) dans un classement de méthodes.$t$),
  ('eb647307-93d9-4aa4-bcdb-b2d667a4b450', 'es', 2, '155b826e22b14c4056f2e7276b03b2c1', 'laisser', null, $t$Méthode notée et jugée (6/10, perte de temps) dans un classement de méthodes.$t$),
  ('eb647307-93d9-4aa4-bcdb-b2d667a4b450', 'fr', 2, 'a90659d6c4eda029f144eb94663cba05', 'laisser', null, $t$Méthode notée et jugée (« Flashcards/Anki 6/10, perte de temps ») dans un classement de méthodes.$t$),
  ('eb647307-93d9-4aa4-bcdb-b2d667a4b450', 'tr', 2, 'bc778e35b376284d460638774af9ccc5', 'laisser', null, $t$Méthode notée et jugée (« flashcard/anki 6/10 … zaman kaybı »), cas cité par la règle.$t$),
  ('ed5adb62-e9db-444b-ad4d-98e5bfd4122d', 'fr', 3, '58e7cdb857b23fc443bca5e85b46b06f', 'remplacer', $t$HISTOIRE-GÉO
17,5
J'apprends d'abord le
cours avec le méthode
blurting, ensuite je fais des
quizz sur l'appli micabo$t$, $t$Témoignage isolé « je fais des quizz sur Wilgo », pas un comparatif.$t$),
  ('ed5adb62-e9db-444b-ad4d-98e5bfd4122d', 'fr', 6, '8646c977ebb9eb674e8960c7da44f07d', 'remplacer', $t$FRANÇAIS
18,5
Je suis en 1ère donc j'ai le
bac cette année, je fais
minimum 1h par week-
end. Je revois les analyses
linéaires de la semaine et je
regarde des corrigés
d'annales (sur
l'appli micabo).$t$, $t$Témoignage isolé « corrigés d'annales sur Wilgo », pas un comparatif.$t$),
  ('ed5adb62-e9db-444b-ad4d-98e5bfd4122d', 'tr', 3, '1563b8ea97b59467abf1d8e637bf96f3', 'remplacer', $t$TARİH-COĞRAFYA
17,5
Önce konuları blurting
yöntemiyle çalışıyorum,
sonra micabo uygulamasından testler
çözüyorum.$t$, $t$Témoignage isolé (« je fais des tests sur Wilgo ») dans une liste de méthodes par matière, pas un comparatif.$t$),
  ('f36096d3-2169-4ce1-918e-20b4d3fc97dd', 'de', 3, 'db19aca530e5f2e95ae0f00a709f27fe', 'remplacer', $t$Nutze die micabo-App (der Cheatcode für deine Noten).

Im Bus, statt in sozialen Medien zu hängen, startest du sie. Mach Quizfragen im Fach deiner Wahl. Du merkst nicht mal, dass du lernst.$t$, $t$Impératif « Nutze die WILGO App » + « startest du WILGO ». — 2e mention en pronom$t$),
  ('f36096d3-2169-4ce1-918e-20b4d3fc97dd', 'fr', 3, 'c10be946bc1b782264379eb6023d628d', 'remplacer', $t$Utilise l'appli micabo (le
cheatcode pour tes notes)

Dans le bus, au lieu de
passer du temps sur les
réseaux, tu la lances.
Commence à faire des quiz
dans la matière que tu
choisis, t'auras même pas
l'impression de bosser.$t$, $t$Impératif « Utilise l'app WILGO » ; la 2e mention devient un pronom pour ne pas mettre deux micabo dans la slide.$t$),
  ('fabbb97c-542e-460a-86d2-a476973d4ea0', 'fr', 3, '69ed225687e0151faab26a82046a77cc', 'laisser', null, $t$slideshow en file (brouillon) fait de captures de fiches App Store : à refuser dans la file, pas à réécrire$t$),
  ('fb298bf4-9a0a-4318-8a33-799c754bbe8e', 'fr', 6, '0ea037341f450a6b103f42f01bf10a34', 'remplacer', $t$Moyenne générale élève : 18,04
Moyenne générale classe : 13,33
(Merci l'appli micabo)$t$, $t$Réussite attribuée au concurrent (« Merci Wilgo »).$t$),
  ('ff91768b-2f54-4b18-9e4e-a70acf86d5ba', 'fr', 3, 'e6178a896e09ec2c1a46a694bf2b3a64', 'remplacer', $t$HISTOIRE GÉO
17,5
J'apprends d'abord le
cours avec le méthode
blurting, ensuite je fais des
quizz sur l'appli micabo$t$, $t$Témoignage isolé « je fais des quizz sur Wilgo », pas un comparatif.$t$),
  ('ff91768b-2f54-4b18-9e4e-a70acf86d5ba', 'tr', 3, '2ba97ee8f8e48cb98efa375d8afa43a0', 'remplacer', $t$TARİH COĞRAFYA
17,5
Önce bulanıklaştırma
yöntemiyle dersi
öğreniyorum, sonra
micabo uygulamasında testler çözüyorum.$t$, $t$Témoignage isolé (« je fais des tests sur Wilgo ») dans une liste de méthodes par matière, pas un comparatif.$t$)
on conflict do nothing;

-- Posts non publiés concernés (J-2 à J) : ceux des slideshows remplacés, plus
-- la légende #Wilgo de f6cda090. Table permanente, pas temporaire (voir plus
-- haut).
create table if not exists public.concurrents_reprise_0287_posts (
  passage_id uuid primary key,
  post_id uuid not null
);
alter table public.concurrents_reprise_0287_posts enable row level security;

insert into public.concurrents_reprise_0287_posts (passage_id, post_id)
select pa.id, pa.post_id
from public.passages pa
join public.posts po on po.id = pa.post_id
where pa.statut <> 'publie' and pa.publie_at is null and po.publie_at is null
  and pa.date_publication_prevue >= date '2026-09-29'
  and (exists (select 1 from public.concurrents_reprise_0287 r where r.decision = 'remplacer'
                 and r.contenu_id = pa.contenu_id and r.langue = pa.langue)
       or pa.id = 'f6cda090-a743-4b40-bd8b-db98f58982db')
on conflict do nothing;

-- Écritures (une seule transaction implicite). Sauvegarde d'abord.
insert into public.concurrents_reprise_sauvegarde (cible, ref_id, slides, hashtags)
select 'contenu_langues', cl.id, cl.slides, cl.hashtags
from public.contenu_langues cl
where exists (select 1 from public.concurrents_reprise_0287 r where r.contenu_id = cl.contenu_id and r.langue = cl.langue)
   or cl.id in ('ff47e7b6-0bff-440b-afb2-846eda61ddb5', 'e76ae31f-7efa-4925-8618-3169a3af7b68');
insert into public.concurrents_reprise_sauvegarde (cible, ref_id, slides, hashtags)
select 'passages', pa.id, pa.slides, pa.hashtags
from public.passages pa join public.concurrents_reprise_0287_posts p on p.passage_id = pa.id;
insert into public.concurrents_reprise_sauvegarde (cible, ref_id, texte)
select 'post_slides', s.id, s.texte_overlay
from public.post_slides s join public.concurrents_reprise_0287_posts p on p.post_id = s.post_id;
insert into public.concurrents_reprise_sauvegarde (cible, ref_id, hashtags)
select 'posts', po.id, po.hashtags
from public.posts po join public.concurrents_reprise_0287_posts p on p.post_id = po.id;

-- Posts non publiés, AVANT les decks : la garde compare au texte d'origine,
-- et la publication est revérifiée au moment d'écrire.
update public.post_slides s
set texte_overlay = r.apres, burned_media_id = null, burned_at = null, burn_erreur = null
from public.concurrents_reprise_0287_posts p, public.passages pa, public.posts po, public.concurrents_reprise_0287 r
where pa.id = p.passage_id and po.id = p.post_id and s.post_id = p.post_id
  and pa.statut <> 'publie' and pa.publie_at is null and po.publie_at is null
  and r.decision = 'remplacer' and r.contenu_id = pa.contenu_id and r.langue = pa.langue
  and r.position = s.position and md5(s.texte_overlay) = r.md5_avant;

update public.passages pa
set slides = (
  select jsonb_agg(coalesce(
    (select jsonb_set(e, '{texte_overlay}', to_jsonb(r.apres)) from public.concurrents_reprise_0287 r
     where r.decision = 'remplacer' and r.contenu_id = pa.contenu_id and r.langue = pa.langue
       and r.position = (e->>'position')::int and md5(coalesce(e->>'texte_overlay', '')) = r.md5_avant),
    e) order by o)
  from jsonb_array_elements(pa.slides) with ordinality as t(e, o))
from public.concurrents_reprise_0287_posts p
where pa.id = p.passage_id and jsonb_typeof(pa.slides) = 'array'
  and pa.statut <> 'publie' and pa.publie_at is null;

-- Journal des decks, avant d'écrire : le texte d'avant est relu en base.
insert into public.concurrents_corrections
  (passage_id, post_id, contenu_id, langue, champ, position, avant, apres, motif, deck_corrige)
select null, null, r.contenu_id, r.langue, 'slide', r.position, e->>'texte_overlay', r.apres, '0287 : ' || r.motif, true
from public.concurrents_reprise_0287 r
join public.contenu_langues cl on cl.contenu_id = r.contenu_id and cl.langue = r.langue
cross join lateral jsonb_array_elements(case when jsonb_typeof(cl.slides) = 'array' then cl.slides else '[]'::jsonb end) e
where r.decision = 'remplacer' and (e->>'position')::int = r.position
  and md5(coalesce(e->>'texte_overlay', '')) = r.md5_avant;

-- Decks : remplacement, ou mémoire du « classement » sur la slide
-- (`concurrent_laisse`, lu par `slidesAJuger` côté moteur).
update public.contenu_langues cl
set slides = (
  select jsonb_agg(coalesce(
    (select case when r.decision = 'remplacer'
                 then jsonb_set(e, '{texte_overlay}', to_jsonb(r.apres)) - 'concurrent_laisse'
                 else jsonb_set(e, '{concurrent_laisse}', e->'texte_overlay') end
     from public.concurrents_reprise_0287 r
     where r.contenu_id = cl.contenu_id and r.langue = cl.langue
       and r.position = (e->>'position')::int and md5(coalesce(e->>'texte_overlay', '')) = r.md5_avant),
    e) order by o)
  from jsonb_array_elements(cl.slides) with ordinality as t(e, o))
where jsonb_typeof(cl.slides) = 'array'
  and exists (select 1 from public.concurrents_reprise_0287 r where r.contenu_id = cl.contenu_id and r.langue = cl.langue);

-- Légendes.
update public.contenu_langues set hashtags = '#réussite #notes'
where id = 'ff47e7b6-0bff-440b-afb2-846eda61ddb5' and hashtags = '#Wilgo #réussite #notes';
update public.contenu_langues set hashtags = '#ComparatifIA #Études'
where id = 'e76ae31f-7efa-4925-8618-3169a3af7b68' and hashtags = '#ComparatifIA #Wilgo #Études';
update public.posts po set hashtags = '#réussite #notes'
from public.concurrents_reprise_0287_posts p
where p.passage_id = 'f6cda090-a743-4b40-bd8b-db98f58982db' and po.id = p.post_id
  and po.publie_at is null and po.hashtags = '#Wilgo #réussite #notes';
update public.passages set hashtags = '#réussite #notes'
where id = 'f6cda090-a743-4b40-bd8b-db98f58982db' and publie_at is null and statut <> 'publie'
  and hashtags = '#Wilgo #réussite #notes';

-- Journal des posts non publiés corrigés (le texte d'avant est dans la sauvegarde).
insert into public.concurrents_corrections
  (passage_id, post_id, contenu_id, langue, champ, position, avant, apres, motif, deck_corrige)
select pa.id, pa.post_id, r.contenu_id, r.langue, 'slide', r.position, sv.texte, r.apres, '0287 : post non publié', false
from public.concurrents_reprise_0287_posts p join public.passages pa on pa.id = p.passage_id
join public.post_slides s on s.post_id = p.post_id
join public.concurrents_reprise_0287 r on r.decision = 'remplacer' and r.contenu_id = pa.contenu_id and r.langue = pa.langue
  and r.position = s.position and s.texte_overlay = r.apres
left join lateral (
  select x.texte from public.concurrents_reprise_sauvegarde x
  where x.cible = 'post_slides' and x.ref_id = s.id order by x.id desc limit 1
) sv on true;

-- Résultat au 01/10 : 166 lignes sauvegardées, 73 slides de decks remplacées,
-- 9 slides de posts non publiés, 2 légendes. Restent 25 slides qui citent un
-- concurrent, toutes des classements marqués `concurrent_laisse`.
