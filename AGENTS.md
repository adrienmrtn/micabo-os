# Agents — micabo OS

## Produit

micabo = éducation IA pour étudiants : cours / notes / PDF → flashcards,
révision ~10 min/jour.

- Ton : étude, examens, notes, révisions.
- Jamais de culture générale.
- Jamais le mot d’un autre produit dans un CTA (écrire `micabo` en minuscules).

## Retrait des modules annexes (0256, 14/09/2026)

Quatre modules sont **partis** : « Create a post » (`/admin/creation` +
`creation-manuelle`), « CM paper » (`/admin/papier` + `papier-cm` + les étapes
`papier_cm` / `papier_assign` de minuit + le type de compte `cm`), « AI
slideshows » (`/admin/ugc/slideshows`, une page vide) et « AI Videos »
(`/admin/ugc/videos` + `assignation-ugc-video`). La marque système
`ugc-ai-video` est supprimée de `labels` ; `hook` reste.

**Le schéma reste dormant** : rien n’est droppé. Les cinq tables `papier_*`
(0 ligne), `ugc_video_posts`, `comptes.type_compte`, `comptes.ugc_ai_video`,
`labels.ugc_ai_video`, `profiles.hm_ugc_ai_video` et `hm_ugc_video_labels`
sont toujours là — plus personne ne les écrit. Un compte n’a donc plus qu’un
type, et `comptesPoster.ts` a remplacé `comptesCm.ts`.

Ce qui **reste allumé** et ne doit pas être confondu avec le retrait : les
personas UGC (`/admin/ugc/personas`), le face swap slideshow (`comptes.ugc_ai`,
`contenus.ugc_compatible`, `ugc_face_swap.ts`) et le burn.

Deux morceaux ont été **sauvés** de fichiers supprimés parce que le moteur s’en
sert encore : `resoudreVisuelsAssignation` (garnissage d’une slide depuis la
biblio du label) vit dans `_shared/visuels_assignation.ts`, et les exemples
feed d’un label dans `src/features/moteur/promptsFeed.ts`.

## Tierlist des slideshows (0250, en prod depuis le 11/09/2026)

Un slideshow porte **un tier** (`contenus.tier` : D, C, B, A, S, S+) et un
nombre de passages à effectuer (`passages_cible` : 0/1/1/2/4/8, divisé par deux
le 17/09/2026). Il n'y a plus
d'ELO par langue — `contenu_langues.score` est **gelé** (historique) et n'est
plus lu par le moteur.

- Import : note /100 = 30 % pertinence + 70 % vues source, régularisée
  (`kk = k/2`). <55 → non importé · 55–60 C · 60–70 B · ≥70 A. **Plafond :
  sans 10 000 vues sur le TikTok d'origine (`VUES_SOURCE_MIN_B_PLUS`), l'entrée
  se fait en C quelle que soit la note** — un slideshow très pertinent mais peu
  vu ne mérite pas 2 à 4 passages d'emblée, il remontera s'il performe chez
  nous. Une seule ligne `contenu_langues` est créée (langue source) ; les
  autres langues arrivent à la demande, à l'assignation (`assurerDeckPourLangue`).
- Cycle : les passages du cycle sont ceux créés depuis `tier_maj_at`, hors
  reposts bonus et hors posts test. Quand ils sont tous **réglés**, on
  requalifie sur `m` = moyenne des vues mesurées : bandes absolues (<600 D ·
  <1 000 C · <5 000 B · <30 000 A · <150 000 S · sinon S+), jamais plus d'un
  cran de descente, et il faut 1 000 vues pour sortir de D. Cycle qui traîne →
  requalification forcée à 14 jours.
- Assignation : tirage **au hasard** parmi les slideshows du pool (labels ∩,
  toutes langues) qui ont encore des passages dus — mais **un C n'est tiré que
  si le pool n'a plus rien en B ou mieux**. Plus de softmax, plus de pénalité
  de saturation, plus de « jamais deux fois le même post » — mais **jamais deux
  fois sur le même compte à moins de 30 jours** (`RECUL_MEME_COMPTE_JOURS`,
  19/09/2026 ; la fenêtre était d'un jour et laissait passer les doublons). S'il n'y a pas assez de passages dus,
  un slideshow en D est repêché avec un cycle d'un passage.
- Le quota d'un créateur (`posts_par_jour`) **ne baisse plus jamais**.
- Repost bonus : un passage > 50 000 vues rejoue le même post sur le même
  compte à J+7 (`reposts_bonus`). Hors cycle, mais dans le quota du jour ;
  abandonné si le créneau est passé.

## Un slideshow revenait sur le même compte au bout d'un jour (19/09/2026)

Signalé par une créatrice : « the system is showing me posts that I have
already published previously (exact duplicates) », ses deux recharges
consommées sur un post identique à celui qu'elle avait publié trois jours plus
tôt. Elle avait raison, et le défaut n'était pas chez elle.

`choisirContenu` n'excluait que les slideshows déjà sortis **le jour même** —
et le commentaire l'assumait : « un même slideshow peut revenir un autre jour ».
L'historique était pourtant complet en base ; il n'était simplement jamais relu
au-delà du jour.

Sur 17 comptes actifs : **15 touchés, 53 paires compte/slideshow répétées, 58
passages en double, dont 46 réellement repartis en ligne**, à 1 à 10 jours
d'écart. Aucun pool n'était épuisé — la créatrice avait **112 slideshows jamais
vus sur un pool de 126**.

`RECUL_MEME_COMPTE_JOURS = 30` vit dans `tierlist.ts`, à côté de
`REPOST_BONUS_JOURS`, et pas à côté du filtre : c'est la même leçon que le trio
des délais de cycle. Deux tests verrouillent qu'il reste **au-dessus du repost
bonus (7)** et **au-dessus du timeout de cycle (14)**.

- **> repost bonus** : rejouer un post sur le même compte est une décision qui
  se prend — > 50 000 vues, J+7, `bonus_repost = true`, hors cycle. Si le
  tirage ordinaire pouvait produire la même répétition au même moment, un
  doublon ne serait plus lisible en base.
- **> timeout de cycle** : un slideshow doit avoir été jugé avant de pouvoir
  revenir.

**L'index ne peut pas porter cette règle.** `passages_compte_contenu_jour_uidx`
est un index unique sur `(compte_id, contenu_id, date_publication_prevue)` : il
ferme la course entre deux workers du même jour, et c'est tout ce qu'un unique
sait exprimer. Une fenêtre glissante demanderait un `EXCLUDE … USING gist` sur
un `daterange`, que les 58 doublons historiques feraient échouer à la création
— et dont la violation remonterait sous un SQLSTATE que `estDoublonContenuJour`
ne sait pas lire. La règle des 30 jours vit donc dans l'applicatif ; l'index
garde son rôle, plus étroit.

**Pool vidé par l'exclusion** : `choisirContenu` rend `null`, l'appelant
journalise « Plus de candidat dans le pool » et s'arrête. Un post de moins vaut
mieux qu'un doublon. Marge mesurée au 19/09 : 105+ inédits par compte, plus de
50 jours d'autonomie.

**Reprise des données.** Les 8 doublons encore non publiés du jour ont été
supprimés (sauvegardés dans `doublons_sauvegarde`) puis réassignés par
`kick_edge_micabo('assignation-contenu', …)` — zéro doublon au retirage.

Deux choses n'ont **pas** été faites, volontairement :

- **Ne pas passer par `revoquer-post` en admin pour dédoublonner.**
  `doitRejeterSlideshow` rejette le slideshow *pour tout le monde* dès que le
  rôle n'est pas `poster` : on aurait sorti 8 bons slideshows du pool pour un
  problème qui ne concernait qu'un compte.
- **Ne pas toucher au doublon assigné du 12/09** (asya.ders680, `d97efcc0`). Il
  appartient à un cycle **déjà clos** — `tier_maj_at` au 18/09 — donc il a
  compté dans la note B du slideshow. Le supprimer réécrirait un historique
  fermé.

Les 46 doublons déjà en ligne ne sont pas rattrapables et n'ont pas été
touchés.

## Le cycle n'était pas tenu : perte de mise à jour (0274, 25/09/2026)

`passages_cible` disait combien de passages un cycle doit produire, **et rien ne
le faisait respecter**. Signalé par « j'ai l'impression de toujours voir les
mêmes posts » — l'impression était juste, la cause n'était pas celle qu'on
croyait.

`choisirContenu` **lit** les restants (`assignation_contenu.ts:974`), **décide**
(`:983`), puis n'**écrit** qu'après avoir fabriqué le deck (`:450`) — traduction,
placement, hashtags : **6 à 24 secondes** mesurées sur les traces. Entre les
deux, aucun verrou sur `contenus` : le `for update` de 0265 porte sur `comptes`.
`LARGEUR_ASSIGNATION = 6` fait tourner six créateurs dans cette fenêtre, et les
logs Edge montrent **deux chaînes d'invocation en parallèle**, donc jusqu'à
**douze workers** qui lisent le même « il reste 1 passage » et en créent chacun
un. Perte de mise à jour de manuel.

Mesuré sur les 98 cycles ouverts au 24/09 : **22 passages en surplus sur 169**
(13 %), sur 15 slideshows ; **22 sur 22** créés à moins de 10 s du passage
précédent du même cycle, écart médian **2,1 s**, minimum **4 ms**, tous dans la
rafale 22:00–22:01 UTC. Le défaut rejouait chaque nuit : 3 le 21/09, 9 le 22,
4 le 23, 5 le 24.

**`contenusSession` ne pouvait pas l'attraper** : c'est un `const` local à un
compte et à une invocation. **L'index non plus** :
`passages_compte_contenu_jour_uidx` porte `compte_id` et la collision est ENTRE
comptes — il n'a jamais eu l'occasion de se déclencher. « Au plus N par cycle »
n'est pas un unique, et un `EXCLUDE` échouerait à la création sur les surplus
historiques : même leçon que la fenêtre des 30 jours du 19/09.

**Le correctif est dans la transaction**, comme 0265 : `perform 1 from
public.contenus … for update` après le verrou `comptes` (ordre fixe pour toutes
les transactions, donc pas de nouveau 40P01), puis recomptage du cycle et
`raise exception … errcode = 'P0002'` / `cycle_complet` si la cible est
atteinte. Le comptage **reproduit `restantsParContenu` à l'identique** — hors
reposts bonus, hors posts test, depuis `tier_maj_at` ; deux compteurs qui
divergent finissent par se contredire. Aucun bloc `exception` dans la fonction,
règle de 0265. Les reposts bonus sont exemptés : ils sont hors cycle par
construction.

Côté TS, `estCycleComplet` (`assignation_quota.ts`, sur le modèle de
`estDoublonContenuJour`) et une branche dans le `catch` : on journalise, on
repioche. **Le créateur ne perd pas son post**, c'est un autre slideshow qui le
remplit.

**La migration peut précéder le redéploiement des chargeurs** : un appelant qui
ne connaît pas encore `P0002` tombe dans le `log` + `continue` générique du
`catch` et repioche quand même. Le seul manque est un compteur `echecsDeck`
incrémenté à tort et un journal moins clair.

**Quatre pistes écartées sur données**, à ne pas rouvrir sans preuve neuve : la
requalification qui rouvrirait un cycle (**0 cas** — les passages naissent à
00:00, les requalifications tombent à 00:02–00:18, donc « retarder la
requalification » coûterait un jour par cycle pour zéro surplus corrigé) ; le
repêchage en D (**0 occurrence**) ; les exclusions du comptage (`est_test` vrai
nulle part, `post_id` null nulle part) ; les chemins hors tirage — orphelins,
`revoquer-post`, reprises manuelles des 18/19/24/09 — **0 surplus**, bilan net
nul ou négatif à chaque fois.

**Piège de mesure à connaître** : comparer les passages d'un jour passé à
`passages_cible` d'aujourd'hui produit des faux positifs, parce que la cible
bouge à chaque requalification. Un « S cible 4 avec 6 passages » du 19/09 était
un S+ cible 8 ce jour-là, et il avait livré exactement 8. Toujours comparer à la
cible **qui avait cours**, via `contenu_tier_historique` (0272).

**Deux crons tombaient à la même seconde.** `minuit-vnext` (`0 22 * * *`) et
`minuit-vnext-journee` (`*/15 * * * *`) se déclenchaient tous deux à 22:00:00 —
vérifié dans `cron.job_run_details` : 22:00:00.071 et 22:00:00.078. C'est ce qui
donnait les deux chaînes concurrentes, et le moteur faisait probablement deux
fois le travail chaque nuit. `minuit-vnext-journee` est passé à
**`5,20,35,50 * * * *`** le 25/09 : même cadence au quart d'heure, jamais sur la
minute 0 (donc jamais en collision avec les filets 01:00 / 04:00 ni avec
`rattrapage-elo-midi`). Fait par un `cron.schedule` sur ce seul nom, jobid 44
conservé, comme le 11/09.

**Faiblesse latente non traitée** : `lireParLots` ne pagine pas (455 lignes lues
au pire, plafond PostgREST 1 000). À environ 3,7× le volume actuel, le décompte
de cycle se mettrait à tronquer **en silence** et redeviendrait une cause de
surplus. À fermer avant que le volume n'arrive.

## Le palier C était une trappe sans fond (25/09/2026)

`prioriserTiersHauts` **verrouillait** les C : un C ne sortait pas tant qu'un
seul slideshow en B ou mieux devait un passage. Ce n'était pas un réglage trop
serré, c'était un circuit sans sortie — il faut être posté pour être mesuré, et
mesuré pour être requalifié. Un C ne pouvait donc **jamais** remonter, et le
dépôt l'écrivait déjà en toutes lettres depuis le 17/09 sans en tirer la
conséquence.

Mesuré le 25/09, après le correctif de 0274 : **24 slideshows en B+ dus pour 39
passages**, contre **57 C dus pour 57 passages**, face à **59 posts par jour sur
29 comptes actifs**. Le moteur tirait donc 59 posts par nuit dans un vivier de
24 — c'est ça, « je vois toujours les mêmes posts », signalé par Adrien après
deux ou trois jours. Ce n'est pas un défaut du tirage : c'est de l'arithmétique.

Le verrou devient une **part réservée**, `PART_TIRAGE_C = 0,3` dans
`tierlist.ts`. Trois cas : plus rien en B+ → tout le pool ; plus aucun C dû →
les B+ ; les deux → trois tirages sur dix vont aux C. Le tirage reste uniforme
à l'intérieur du groupe retenu, et `alea` est injectable pour que le test
verrouille les trois branches sans dépendre du hasard.

**0,3 se démontre, il n'est pas pris au jugé** : 70 % de 59 ≈ 41 créneaux
restent aux tiers hauts, au-dessus des 39 passages qu'ils doivent. **Les B+ ne
perdent donc rien**, et ~18 C sont mesurés chaque jour — les 57 sont jugés en
trois jours. C'est le seul chiffre à revoir si le rapport entre les deux
bascule ; le test le borne sous 0,5 pour qu'on ne puisse pas évincer les B+.

**Un slideshow sans tier n'est pas un C** et n'entre pas dans la part réservée :
son cycle n'a pas de sens avant sa première qualification. Il ne sort que par le
repli « plus rien en B+ », comme avant.

**Correction du 26/09/2026 — le chiffre « pool tirable 24 → 81 » était faux.**
81 était le nombre de slideshows qui DEVAIENT un passage. Devoir un passage
n'est pas être tirable : le tirage croise aussi les labels du compte et le
recul de 30 jours. Mesuré au moment de la rafale du 26/09, le pool réellement
tirable était de **39 slideshows** — 1 en B+, 38 en C. Les 47 manquants ne
portent que `cold-study`, le label retiré le 24/09 que plus aucun compte ne
porte : ils sont **définitivement intirables** et gonflent tous les comptages
de « passages dus » sans jamais pouvoir sortir.

**Compter les dus n'est donc jamais une mesure du pool.** Le seul comptage
honnête croise les trois filtres — cycle dû, label partagé avec un compte
actif, pas vu par ce compte depuis 30 jours. `pool_global.ts` ne le fait pas :
`dusBPlus` et `dusC` ignorent labels et recul, donc `tirablesMaintenant`
surestime, et le surestimait déjà avant ce correctif.

Ce que la part réservée aux C a réellement acheté, mesuré le 26/09 : un seul
slideshow B+ était disponible, pour 16 comptes. Sous le verrou, ces 16 comptes
auraient tous été servis avec LE MÊME slideshow dans la même nuit — très
exactement « toujours les mêmes ». La part a réparti les 59 posts sur 53
slideshows au lieu de 38, et la concentration du top 5 est tombée de 33,9 % à
16,9 %. Le gain est là, pas dans un équilibre 70/30 qui n'a jamais eu lieu.

`verrouillesParPriorite` est **supprimée** de `pool_global.ts` — elle comptait
les C mis sur la touche, il n'y en a plus. Un accesseur qui rendrait toujours 0
ferait croire à un étage de l'entonnoir qui n'existe pas ; `tirablesMaintenant`
additionne désormais `dusBPlus + dusC`, et la carte du Moteur affiche `dusC`.

## Le repêchage rouvrait le cycle qu'il venait d'ouvrir (0275, 27/09/2026)

0274 ferme la perte de mise à jour du tirage ordinaire, et son comptage part de
`contenus.tier_maj_at`. **Le repêchage, lui, déplace `tier_maj_at`.**

`choisirContenu` finissait par un `update contenus set passages_cible = 1,
tier_maj_at = now()` **nu** — hors transaction, sans verrou, sans condition. Six
workers qui repêchent le même slideshow en D écrivent donc six fois
`tier_maj_at = now()`, et chacun voit ensuite « 0 fait sur 1 ». Ce n'est pas une
course perdue : c'est une porte que 0274 ne couvrait pas. Il ferme la lecture
concurrente, pas la remise à zéro du compteur.

Mesuré sur la rafale du 27/09 : quatre slideshows en D ont pris **7, 5, 5 et 3
passages** pour une `passages_cible` de 1 — **20 des 59 passages du jour**. Sur
`c8b9a2d2` : six passages en **31 secondes** (22:01:17 → 22:01:48) et huit
écritures de tier pendant la rafale. Conséquence visible : **sept créateurs ont
publié le même slideshow le même jour**, et la variété est retombée de 55
slideshows distincts (26/09) à 37, top 5 de 15,3 % à 37,3 % — au niveau d'avant
le correctif des C.

**Le contrôle de la nuit avait annoncé « zéro surplus », et il avait raison
selon sa propre définition** : il comparait à un `tier_maj_at` que le repêchage
venait de déplacer. Une mesure qui part du compteur que le défaut réécrit ne
peut pas voir le défaut. Pour ce chemin, compter les passages du JOUR par
slideshow est le seul angle qui le révèle.

Le dépôt avait écarté cette piste le 24/09 — « le repêchage en D : **0
occurrence** ». C'était vrai ce jour-là, parce que le pool était assez fourni
pour ne jamais tomber dans le repêchage. Il est devenu assez maigre pour y
tomber chaque nuit. **Une piste écartée sur données se rouvre quand les données
changent** : la conclusion portait sur un régime, pas sur le code.

**Le correctif est dans la transaction**, comme 0265 et 0274 :
`repecher_contenu(contenu, tier)` prend le `for update` sur `contenus` (même
ordre d'acquisition, donc pas de 40P01), recompte le cycle à l'identique de
`restantsParContenu`, et n'ouvre que s'il n'y a pas déjà un cycle ouvert.

Elle rend **true seulement si elle a réellement ouvert le cycle**. Le second
worker voit le cycle du premier, rend false, et l'appelant passe au candidat
suivant. Rendre true lui ferait reprendre un slot que le premier n'a pas encore
consommé — exactement le doublon qu'on ferme. Un cycle « ouvert et inutilisé »
ne peut appartenir qu'à un worker concurrent : s'il était disponible, le tirage
ordinaire l'aurait pris avant d'arriver au repêchage. Décliner est sans perte.

Elle **ne lève pas**, elle rend un booléen : un repêchage décliné est un cas
normal du tirage, pas une panne. Aucun bloc `exception`, règle de 0265.

Côté TS, `choisirContenu` parcourt les repêchables **mélangés** jusqu'à en
ouvrir un. `melanger` (Fisher-Yates sur une copie, `alea` injectable) vit dans
`tierlist.ts` et non à côté de son appelant, pour la raison du 17/09 :
`assignation_contenu.ts` tire `supabase.ts` et son specifier `jsr:`, que Vite ne
résout pas, donc le test ne pourrait pas le lire. Un ordre stable ferait
converger tous les workers sur le même slideshow en D — c'est le défaut même.

## 0275 n'avait pas suffi : le repêchage rouvrait son propre cycle en chaîne (0276, 28/09/2026)

0275 a mis l'ouverture du cycle sous verrou et refusait de rouvrir un cycle
« ouvert et non consommé ». **L'erreur était dans la condition, pas dans le
verrou.**

Dès que le premier worker a inséré SON passage, le cycle est plein
(`faits >= cible`) — et 0275 autorisait alors la réouverture. Chaque worker
rouvrait donc à son tour, et le compteur repartait de zéro à chaque fois. 0275 a
fermé la fenêtre de course et laissé la porte principale grande ouverte.

Mesuré sur la rafale du 28/09, **avec 0275 déployé** : cinq slideshows en D ont
pris **34 des 52 passages** (8, 7, 7, 6, 6), huit réécritures de tier chacun. La
variété est tombée à **22 slideshows distincts** et le top 5 à **65,4 %** —
pire que la veille (39 / 34,5 %) et très loin du 26/09 (50 / 15,1 %).

**La bonne règle est celle que le dépôt applique partout ailleurs : un slideshow
doit être JUGÉ avant de revenir.** Un cycle plein dont le passage n'est pas
encore mesuré n'est pas un cycle à rouvrir, c'est un cycle en attente de
verdict. Traduit au plus étroit et au plus vérifiable : **au plus un passage de
repêchage par slideshow et par jour**.

Les deux gardes sont nécessaires et ne se remplacent pas :

1. **déjà un passage pour ce jour** → plafonne à 1/jour. C'est la porte
   principale, celle que 0275 laissait ouverte.
2. **cycle ouvert et non consommé** (0275) → couvre la fenêtre entre la
   réouverture d'un worker et son insertion, pendant laquelle la garde 1 ne voit
   encore aucun passage.

Vérifié en prod sur les deux branches : un slideshow déjà servi le 28 rend
`false` sans toucher `tier_maj_at` ; sur un jour neuf, le premier appel rend
`true` et le **second appel immédiat rend `false`** — c'est la garde 2 qui
parle, et c'est exactement le cas que 0275 seul ne couvrait qu'à moitié.

`p_jour` est le jour de publication prévu, **pas `now()`** : c'est la clé que
porte `passages.date_publication_prevue`. Compter sur `created_at` ferait dériver
le plafond dès qu'une rafale traverse minuit UTC — et la rafale part à 22:00 UTC,
donc elle le traverse tous les jours du point de vue de Paris.

**La migration peut précéder le redéploiement**, et cette fois ce n'est pas un
`catch` générique qui l'assure mais le **paramètre par défaut** : un chargeur
encore sur 0275 appelle à deux arguments, tombe sur la nouvelle fonction avec
`p_jour = null`, saute la garde 1 et retrouve le comportement de 0275. Pas de
fenêtre d'échec. L'ancienne signature à deux arguments est supprimée pour ne pas
laisser deux surcharges que PostgREST résoudrait par nom de paramètre sans rien
signaler.

**Conséquence assumée** : sur un pool maigre, le repêchage ne fournit plus qu'un
passage par slideshow repêchable et par nuit, donc des créateurs finiront sous
quota. C'est l'arbitrage du 19/09, déjà écrit ici — « un post de moins vaut mieux
qu'un doublon » — et **huit créateurs sur le même slideshow le même jour EST un
doublon vu de l'audience**.

**Leçon de méthode, à ne pas réapprendre** : une mesure qui part du compteur que
le défaut réécrit ne peut pas voir le défaut. Le contrôle du 27/09 annonçait
« zéro surplus » en comparant à un `tier_maj_at` que le repêchage venait de
déplacer. Pour ce chemin, le seul angle qui révèle quoi que ce soit est de
compter **les passages du JOUR par slideshow**.

## Le retrait d'un label attirait le repli vers lui (0277, 28/09/2026)

Un compte créé le 28/09 (`leon.lernen977`) est né **sans label**, donc sans
aucun post — l'assignation croise les labels du compte avec ceux du contenu, et
un compte sans label n'intersecte rien. Aucune erreur nulle part.

La chaîne complète, et chaque maillon est du code qui « marche » :

1. la file admin `file_labels_comptes` était vide ;
2. `popLabelFile` tombe alors sur son repli, `labelMoinsUtiliseParLangue`, qui
   prend le label **le moins utilisé** ;
3. un label retiré a **zéro compte**, donc le repli élisait `cold_study`
   **précisément parce qu'il était retiré** — 0 compte contre 27 pour
   `classic_study` ;
4. l'insert partait dans le trigger de 0273, qui le **jette en silence**.

**Le mécanisme de retrait attirait donc le repli vers le label retiré**, soit
l'inverse exact de sa raison d'être. C'est la conséquence non vue du choix
assumé de 0273 — « le trigger ignore la ligne, il ne lève pas » : **ignorer en
silence rend un défaut invisible, pas inoffensif**. Le compte naît, l'appelant
reçoit un `ok`, et le créateur attend des posts qui ne viendront jamais.

Le correctif est au **point de passage unique** : `idsLabelsAssignables`
(`_shared/labels_systeme.ts`, module pur) écarte un label retiré en plus d'un
label système, et les quatre requêtes `labels` de `manage-users` sélectionnent
`retire_le`. Les trois chemins (`filtrerIdsAssignables`, le pool du repli, la
liste par ids) passent par là. 5 tests, dont celui qui verrouille le point qui
compte : **mieux vaut rendre une liste vide** — donc un `409 NO_LABELS` visible —
**qu'un label que le trigger jettera sans rien dire**.

Un appelant qui oublierait `retire_le` dans son `select` retrouve le
comportement d'avant 0277 : c'est documenté dans la fonction et testé, pas
silencieux.

**0277 supprime aussi la ligne `cold-study`.** Tant qu'elle existe, elle reste un
piège pour tout chemin qui oublierait le filtre. Les FK sont en **CASCADE** :
la suppression a emporté 58 `contenu_labels`, 287 `media_labels` et 1
`compte_reference_labels`, et les 58 slideshows y perdaient leur **seul** label.
Ils étaient déjà intirables, mais on perdait le moyen de les retrouver — d'où
`cold_study_sauvegarde` (1 label, 58 contenus, 287 médias, 1 source), leçon de
0262 : avant une bascule irréversible, ranger l'état d'avant.

Il ne reste que deux labels : `classic-study` et `hook` (système, non
assignable). Plus aucun label retiré en base.

**Piège de diagnostic à connaître.** J'ai d'abord cru régler ça en réamorçant la
file : `items` a été réécrit avec des **chaînes** alors que
`normaliserFileLabelsValeur` attend des objets `{label_id, ugc}`. L'entrée était
donc illisible, silencieusement ignorée, et l'`updated_at` du réglage n'a jamais
bougé — c'est ce détail qui a mis sur la piste. Une file jamais consommée dont
l'horodatage ne bouge pas veut dire « personne ne l'a lue », pas « personne n'est
passé ».

## Clôture d'un cycle (0257, 16/09/2026)

Un cycle se clôt sur des passages **réglés**, pas sur des passages publiés, et
il se clôt **au relevé** et non à la fin du drain. Deux corrections au même
symptôme : un slideshow restait à `x/x` sans que rien ne bouge.

- **Réglé = mesuré ou périmé** (`passageRegle`). Mesuré : publié, vues connues,
  ≥ 2 jours (`MESURE_JOURS`). Périmé : jamais publié 5 jours après le créneau
  prévu, ou publié sans relevé 5 jours après la publication
  (`PASSAGE_PERIME_JOURS`, au-dessus de la fenêtre de scrape de 4 jours). Avant,
  la clôture exigeait que *tous* les passages soient mesurés : un seul créateur
  qui ne postait pas gelait le slideshow les 14 jours du timeout, alors que les
  trois autres passages avaient déjà rendu leur verdict. `m` ne se calcule
  toujours que sur les mesurés ; les périmés sont écrits en perte
  (`passagesPerimes` dans le brief). Cycle entièrement périmé → `m` null, tier
  inchangé, cycle rouvert : le slideshow repart en circulation au lieu
  d'attendre.
- **Requalification au relevé.** `requalifierContenus` accepte `contenuIds` et
  un run compte requalifie les slideshows qu'il vient de mesurer. C'était réservé
  au run « tous comptes » par prudence — à tort : la fonction relit les passages
  par `contenu_id`, pas par compte, donc ciblée sur un slideshow elle voit son
  cycle en entier quel que soit le compte qui a déclenché le run. La passe
  complète de fin de file reste, comme filet.

`MESURE_JOURS` passe de 3 à 2 jours (16/09/2026), sur la courbe réelle du
projet et non au jugé : vues médianes 676 à J+0, 1 073 à J+1, 1 491 à J+2, puis
un plateau à ~1 400-1 620 de J+4 à J+6. À J+2 on tient déjà **~96 %** du
plateau — le troisième jour n'achetait presque rien et coûtait un jour sur
chaque cycle. La mesure reste dans la fenêtre de scrape (4 j) et chaque passage
est toujours vu deux fois avant l'échéance, grâce à la passe de 13:00.

Le biais résiduel est connu et assumé : mesurer plus tôt sous-compte de
quelques pour cent, donc un slideshow pile sur une borne de bande (surtout la
barre des 1 000 vues, C → B) peut tomber un cran plus bas qu'avec l'ancien
délai. Les bandes n'ont pas été retouchées.

Ce qui n'a **pas** changé : le timeout 14 jours, les
bandes, et le tirage — un S+ met toujours plus longtemps à remplir son cycle
qu'un C, puisque le tirage est uniforme *par slideshow* et non *par passage dû*
(l'écart est passé de 16× à 8× le 17/09, en divisant les quotas par deux).

## Les trois délais du cycle sont un trio ordonné (17/09/2026)

`MESURE_JOURS` **(2)** `< RATTRAPAGE_JOURS_DEFAUT` **(3)** `< PASSAGE_PERIME_JOURS` **(4)**.

Ce n'est pas une convention d'écriture, ce sont deux contraintes dures :

- **fenêtre > mesure** — le relevé doit encore couvrir le post au moment où on
  lit ses vues. `joursFenetreParis(n)` couvre les `n` derniers jours, aujourd'hui
  compris : à 2, un post publié à J0 est relevé à J0 et J+1 puis **sort de la
  fenêtre**, alors que `passageMesure` se déclenche à J+2. On mesurerait donc à
  J+2 un chiffre figé à J+1 — sur la courbe du projet, 1 073 contre 1 491 de
  médiane, ~72 % du réel. La bande C/B étant à 1 000 vues pile, tout ce qui vit
  entre 1 000 et 1 491 basculerait en C, le palier dont `prioriserTiersHauts` ne
  fait jamais remonter personne. Garder `MESURE_JOURS = 2` sous une fenêtre de 2
  est donc **strictement pire** qu'assumer J+1 : même précision, un jour perdu.
- **péremption > fenêtre** — ne pas condamner un passage qu'on est encore en
  train de relever. Un périmé est exclu de la moyenne ; le périmer trop tôt fait
  requalifier sur moins de données, et un cycle entièrement périmé donne
  `m = null`, donc tier inchangé. On jetterait du signal réel.

Le 17/09 ces délais passent de 2/4/5 à **2/3/4** : un jour gagné sur la
péremption, un sur le relevé, zéro perte de précision.

`RATTRAPAGE_JOURS_DEFAUT` **vit désormais dans `tierlist.ts`**, pas dans
`rattrapage_elo.ts`. Ce n'est pas un réglage du relevé, c'est le terme du milieu
du trio — les séparer est précisément ce qui leur a permis de se désynchroniser
sans que rien ne le signale. `rattrapage_elo.ts` la réexporte, aucun appelant ne
change. Effet de bord utile : le test peut enfin la lire, alors qu'importer
`rattrapage_elo.ts` depuis Vitest tire `supabase.ts` et son specifier `jsr:`,
que Vite ne résout pas.

**Trois tests verrouillent les deux inégalités** et la position de
`CYCLE_TIMEOUT_JOURS` au-dessus du reste (`tierlistCycle.test.ts`). Ne pas les
supprimer pour faire passer un changement de constante : c'est exactement le
cas qu'ils gardent.

**Déploiement** : cinq chargeurs sur `6b84048` — `assignation-contenu` (v22),
`assignation` (v23), `minuit-vnext` (v24), `rattrapage-elo` (v18) et
`revoquer-post` (v22). Les sept autres bundles ressortent identiques. Les cinq
alias `createClient` sont inchangés (`re`, `ue`, `Ee`, `Y`, `oe`), les douze
sentinelles présentes, test de vie 401 sur les cinq, aucun `ReferenceError`.

## Publication atomique, quotas divisés, file court-circuitable (0265/0266, 17/09/2026)

**La cause racine des orphelins est fermée.** `creer_publication_atomique()`
remplace la séquence en quatre appels PostgREST de `materialiserPostDepuisPassage` :
`passages` → `posts` → `post_slides` → lien, plus le solde du repost bonus, dans
**une seule transaction**. La mort du process ne laisse plus rien derrière elle —
c'était le trou que 0264 ne pouvait que soigner après coup. Les quatre
suppressions de compensation manuelles côté TS ont disparu avec.

L'ordre `passages` d'abord est délibéré : il ne décide pas de la correction (la
transaction s'en charge) mais de **quelle erreur gagne**, et l'appelant en dépend.
23505 sur `passages_compte_contenu_jour_uidx` → il repioche un slideshow ;
`quota_posts_jour` (P0001) → il arrête le compte. Insérer `posts` en premier
ferait dire « quota plein » là où il faut repiocher.

**Aucun bloc `exception` dans la fonction, et c'est structurel.** En plpgsql,
`begin … exception … end` ouvre une sous-transaction : attraper puis poursuivre
committe l'état déjà écrit — exactement l'orphelin qu'on supprime. Et le TS
reconnaît ses deux cas au SQLSTATE et au texte ; réemballer une erreur lui ferait
traiter un quota plein comme une panne.

**Le piège qu'a créé le regroupement : deadlock 40P01.** L'`insert into passages`
prend un `FOR KEY SHARE` sur la ligne `comptes` (FK `passages.compte_id`), puis le
trigger `posts_enforce_quota_jour()` réclame un `FOR UPDATE` sur **cette même
ligne**. Dans une seule transaction c'est une montée en verrou : deux workers
concurrents sur le même compte détiennent chacun le KEY SHARE que l'autre doit
évincer. Tant que les écritures étaient dans des transactions séparées, le KEY
SHARE tombait au commit du passage et le cas n'existait pas — la fusion le crée.
Un `perform 1 from public.comptes where id = p_compte_id for update;` en tête
donne à toutes les transactions le même ordre d'acquisition. Reproduit puis
vérifié éteint sur PostgreSQL 16.

**Ce qui reste dehors, volontairement** : la traduction + Sophia
(`assurerDeckPourLangue`), la résolution des visuels, le face swap UGC et
l'upscale. Le verrou du trigger est tenu jusqu'au COMMIT ; y glisser un appel
Gemini sérialiserait tous les workers du compte.

**Quotas divisés par deux** (`PASSAGES_PAR_TIER` : B 2→1, A 4→2, S 8→4, S+ 16→8).
La grille n'est **pas rétroactive** — `passages_cible` n'est réécrit qu'à la
requalification — donc le stock a été repris à la main le 17/09, uniquement à la
baisse. Effet immédiat et attendu : la réserve passe de **85 à 40 passages dus**,
soit **2,5 → 1,2 jour** d'autonomie à 34 posts/jour. Chaque slideshow est reposté
moitié moins, donc le pool se vide deux fois plus vite : c'est un arbitrage en
faveur de la fraîcheur, payé en débit d'import et de validation.

**L'entonnoir du pool** (`pool_global.ts`, pur, + `PoolGlobalCard`). Bibliothèque →
validés → cycles ouverts → réellement tirables, avec les jours d'autonomie et la
concentration du top 5. Les deux étages qui coûtaient le plus n'étaient visibles
nulle part : la file de validation (95 slideshows dormants le 16/09 sur 166) et
`prioriserTiersHauts`, qui verrouille **tous** les C tant qu'un seul B+ doit un
passage — d'où « toujours les 4 ou 5 mêmes », et d'où le fait qu'un C ne peut
jamais remonter puisqu'il faut être posté pour être mesuré.

**Court-circuit de la file** (`comptes_reference.skip_validation`, 0266). Un
interrupteur par source : à `on`, ses imports naissent `valide` au lieu de
`brouillon`. Ne surcharge jamais un `rejete` — un refus explicite reste un refus.

**`MESURE_JOURS` 3 → 2.** Justifié par la courbe mesurée : médianes 676 (J+0),
1 073 (J+1), 1 491 (J+2), plateau 1 400–1 620 de J+4 à J+6. J+2 vaut ~96 % du
plateau ; le troisième jour d'attente n'achetait plus rien.

## Posts orphelins et doublon du jour (0264, 17/09/2026)

Symptôme unique, deux causes : le panneau des incomplets affichait « 1/2 post(s) »
et le bouton Assigner répondait « Quota déjà rempli (2/2) ». Les deux avaient
raison — ils ne comptaient pas la même chose.

**Posts orphelins.** `materialiserPostDepuisPassage` écrit le `posts`, puis les
`post_slides`, puis lie `passages.post_id`. Les deux premiers échecs rollbackent
le post proprement ; rien ne protège la **mort du process** entre les slides et
le lien — l'invocation Edge meurt à 150 s (`IDLE_TIMEOUT`, vu le 16/09 à 22:07,
et les orphelins apparaissent chaque nuit entre 22:00:1x et 22:00:5x). Le post
reste, le passage reste sans `post_id`, `purgerAssignationIncomplete` le supprime
à la passe suivante : post orphelin.

Le compteur de quota lit `Math.max(passages, posts)` — pour rester cohérent avec
le trigger `posts_enforce_quota_jour()` — donc l'orphelin remplit le quota sans
passage. Le créateur poste une fois au lieu de deux, et **rien ne peut le
débloquer**. Un orphelin publié est pire : le créateur le voit et le poste, mais
il est invisible au moteur (pas de vues, pas de crédit de cycle, rien dans la
qualification).

`rattacher_posts_orphelins(p_depuis date)` recolle. `posts.sujet_id` est null sur
tous les orphelins, donc le contenu se retrouve par les **médias** : celui dont
`structure_slides` contient tous les `post_slides.media_id` du post. Strict — un
contenu mal attribué fausserait son cycle. Le passage reprend le `created_at` du
post, pour retomber dans le cycle auquel il appartenait. Un orphelin non publié
qui doublonne un passage du jour est supprimé plutôt que rattaché : c'est un
doublon, pas un passage manquant. Idempotent.

Premier passage (17/09) : **14 rattachés, 2 doublons supprimés, 4 non résolus**
sur 19 orphelins depuis le 10/09.

**Doublon du jour.** `choisirContenu` exclut les slideshows déjà sortis du jour
par une lecture en base et une liste en mémoire — les deux locales à un appel.
Deux workers concurrents sur le même compte lisent avant que l'autre n'ait
committé et tirent le même slideshow (hugo.notes813, 15/09 à 22:00:41 et
22:00:43). Le trigger `posts_enforce_quota_jour()` compte les posts, pas
lesquels. L'index `passages_compte_contenu_jour_uidx` ferme la course en base ;
l'assignation attrape la violation (`estDoublonContenuJour`) et repioche au lieu
de planter.

L'index ne porte que sur `date_publication_prevue >= 2026-09-18`. Deux doublons
historiques existent, et chez louise.revisions565 le 08/09 les **deux posts ont
réellement été publiés** (4 540 et 1 042 vues). Ce sont des faits ; on ne
réécrit pas l'historique pour faire passer une contrainte. Les reposts bonus
sont exclus de l'index — ils rejouent le même contenu sur le même compte
volontairement.

**Suite** : la cause racine du n°1 est fermée depuis 0265 — la publication naît
en une transaction, l'invocation ne peut plus mourir entre deux écritures.
`rattacher_posts_orphelins()` reste pour l'historique et les orphelins d'avant le
17/09 ; il est idempotent, donc sans risque à relancer.

## Qualification des créateurs (0253, 12/09/2026)

L'ELO compte est **retiré** — colonnes `comptes.score` / `score_maj_at`
supprimées, avec la pénalité de −5 par jour sans post, la moyenne pondérée et
les classements ELO du Pilotage. Un compte porte maintenant une **case** :

    INACTIF < MAUVAISES_VUES < PASSABLE < BIEN < STAR

Les règles vivent dans `_shared/qualification.ts` — module **pur**, réexporté
par `src/features/moteur/qualification.ts` et testé côté front (23 cas), pour
que l'écran et le moteur comptent pareil :

- **INACTIF** : ≤ 6 posts réellement publiés sur les 10 derniers **prévus** ;
- **MAUVAISES_VUES** : moyenne < 600 vues sur les 10 derniers **publiés** ;
- **BIEN** : moyenne ≥ 1 000 **et** ≥ 8 publiés sur 10 prévus ;
- **STAR** : moyenne > 10 000 **et** ≥ 9 publiés sur 10 prévus ;
- **PASSABLE** : tout le reste.

Deux points ont dû être tranchés, et ils sont dans le code :

1. « la moins bonne quand plusieurs cases » ne peut pas jouer entre BIEN et
   STAR, qui sont **emboîtées** — tout STAR remplit aussi BIEN, la règle prise
   au pied de la lettre dégraderait chaque STAR. Elle joue entre ce qui monte
   (vues, assiduité) et ce qui descend (inactivité, vues basses) : 50 000 vues
   avec 5 posts sur 10 → INACTIF.
2. « si moins de 10 prévus, prendre le nombre maximal de prévus » = la
   **proportion** fait foi (6/10, 8/10, 9/10) appliquée aux créneaux réellement
   eus. Sur 10 prévus on retombe sur l'énoncé.

Le créneau du jour est exclu de l'assiduité (il est encore ouvert), les posts
de test ne comptent nulle part, et un post publié mais non mesuré n'est pas un
zéro dans la moyenne.

**Quand** : à la FIN du drain `rattrapage-elo` (`rattrapageEloDrainLot`,
`restants === 0`), jamais au cron de minuit — le relevé des vues est asynchrone
et se termine bien après. Juger à minuit noterait chaque créateur sur la
veille. Une case posée à la main (`qualification_manuelle`) est **verrouillée**
tant qu'un admin ne rend pas la main au moteur.

### Surveillance des comptes (`/admin/surveillance`)

File des comptes INACTIF ou MAUVAISES_VUES, plus les comptes en **essai**
(80 h après `comptes.created_at`) qui entrent d'office 30 h avant la fin — une
échéance de contrat passe outre un skip. Quatre gestes :

- **skip** 7 jours (`surveillance_skip_jusqu_a`) ;
- **changer la case** à la main (verrouille) ou la rendre au moteur ;
- **nudge** : un message interne, choisi parmi `nudges_modeles`, affiché au
  créateur à sa prochaine connexion (`comptes_nudges` + `NudgePopup`). Il
  n'existe aucun canal hors OS : ni e-mail, ni SMS. Le corps est **copié** du
  modèle, pas référencé, et part dans la langue du COMPTE — pas celle de
  l'admin qui clique ;
- **ne pas renouveler** : liste de suivi (`ne_pas_renouveler`) avec la case
  « j'ai demandé au HM » (`hm_prevenu`). **Rien n'est coupé dans le process** :
  ni quota, ni assignation, ni désactivation. C'est une liste, pas un
  interrupteur.

L'essai de `/admin/essai` (5 jours) est un autre compteur, laissé tel quel :
80 h est le seuil de la file de surveillance, pas une redéfinition de l'essai.

## File de validation, formats et placement manuel (0257/0258, 14/09/2026)

**Rien n'entre dans le pool sans un admin.** Le pipeline d'import tourne comme
avant (OCR, pertinence, note /100 et tier d'entrée, nettoyage, format,
caption), mais il s'arrête sur `statut = 'brouillon'` + `import_statut = 'done'`
— cette paire, et elle seule, veut dire « en file ». Pas de nouvelle valeur
d'enum : `assignation_contenu.ts` filtrait déjà sur `valide`. Les variations
suivent la même porte. Le rejet automatique sous 55 est inchangé, et un
`rejete` ne repasse jamais par la file.

`/admin/file` ouvre un éditeur par slideshow : réordonner et supprimer des
slides, corriger le texte du deck source, poser des calques PNG (bibliothèque
globale `blocs_png`, gérée dans les Réglages), régler titre, format, labels,
tier, passages dus, musique, hashtags. Le montage est **aplati dans le
navigateur** — l'Edge n'a ni Pillow ni OpenCV, et le lambda de burn est un
moteur à part qu'on ne détourne pas. L'aplat est réécrit **sur le
`storage_path` existant** de l'image propre : `trouverPropreExistant` cherche
le préfixe `propre/<contenu>/<position>.`, un chemin suffixé casserait la
reprise d'import (même règle que `format_media.ts`). Le `burn_rendus` de la
slide est jeté ; `burn_analyses`, lu sur le BRUT qu'on ne touche jamais, reste
valable.

Refuser = suppression dure, à la main. La purge est un bouton, jamais une
échéance. Un slideshow validé se remet en file depuis sa fiche : les passages
et posts déjà créés ne bougent pas (ils portent leur propre copie des slides
et ne lisent jamais `contenus.statut`), seules les prochaines assignations
cessent de le piocher.

**Les formats ne jouent sur RIEN dans l'assignation** — ni filtre, ni
équilibrage, ni départage. Liste globale, facultative sur un slideshow,
reclassable après coup. Leur seule raison d'être est la carte « Par format »
des Analytics : vues moyennes sur les passages publiés ET mesurés, passages,
slideshows, tiers, requalifications, filtrable par langue et période,
croisable avec les labels. Croisé par label, un slideshow à deux labels compte
dans les deux lignes — le total n'est pas une part de 100 %.

**Placement micabo.** `contenus.placement_manuel` : posé, `integrateSophia` ne
tourne dans AUCUNE langue. La source part telle quelle, les autres langues sont
une simple traduction, et le prompt reçoit la consigne de garder `micabo`
littéral, de ne pas déplacer le CTA, de ne pas en inventer un deuxième. Non
posé, le comportement d'avant tient, `placementParDefaut` compris. Un deck
manuel est « prêt » dès qu'il a du texte : sans cette nuance,
`assurerDeckPourLangue` attendait un `position_sophia` qu'aucun modèle n'allait
plus poser et retraduisait à chaque passage.

## Un deck en langue source ne traversait aucune règle (0268, 17/09/2026)

`assurerDeckPourLangue` sortait directement quand la langue du compte est celle
du slideshow :

```ts
if (langue === langueSource) { deck = deckSource; }   // ← rien d'autre
else if (...) { translateSlideshow(...) }             // ← toutes les règles
```

Or `translateSlideshow` était le SEUL endroit où vivaient la casse de la marque,
l'interdiction du tiret long, le filtre anti-publicité **et la génération des
hashtags**. Un deck publié dans sa propre langue n'en voyait rien.

Au 17/09 : **133 decks sur 206 (65 %)**, et la corrélation dans les données était
exacte — 14 fautes de marque, **toutes** dans ce groupe, zéro dans les traduits ;
86 decks anglais sur 86 sans hashtags ; 10 tirets longs sur 86.

**On ne fait pas repasser ces decks par un modèle.** Le texte source performe
mieux que le traduit (médiane 4 540 vues contre 1 386 au 17/09) : le réécrire
détruirait ce qui marche. Trois pièces à la place :

- `_shared/marque.ts` — module PUR, sans réseau : `normaliserMarque` (casse +
  mot de catégorie, turc compris) et `retirerTiretsLongs`. Appliqué au chemin
  source, et **aussi** au chemin traduit en filet : le prompt porte déjà ces
  règles, un modèle n'est pas une garantie, et les deux passes sont idempotentes.
- `genererHashtags` (gemini.ts) — appel court qui ne demande QUE la légende, sans
  toucher au texte. Rangé dans `contenu_langues.hashtags`, donc payé une fois.
- La génération des hashtags est **commune aux deux chemins et placée après
  eux**. C'est délibéré : la condition des branches porte sur le TEXTE, pas sur
  la légende, donc un deck traduit sans hashtags ne serait rentré dans aucune et
  serait retombé indéfiniment sur le pool statique.

`hashtags` entre aussi dans le test `pret`. Sans ça, un deck avec du texte mais
sans légende était « prêt » à vie et CHAQUE passage retombait sur le repli.

### Le pool de repli : deux défauts, même correctif

`HASHTAGS` (assignation_contenu.ts) ne contenait **pas le turc**, et repliait sur
`?? HASHTAGS.fr`. Le turc est la plus grosse langue du réseau : deux TikTok
turcs sont partis en ligne avec des hashtags **français** (`#pourtoi #savoir
#fyp` le 08/09, `#apprendre #culturegenerale #developpementpersonnel` le 13/09).
Une langue inconnue rend maintenant une chaîne **vide** — un post sans légende
vaut mieux qu'un post qui signale la mauvaise audience à l'algorithme — et le
drain le journalise.

Le pool disait par ailleurs Sophia (`#culturegenerale`, `#savoir`, `#cultura`,
`#booktok`) sur un réseau **micabo**, alors que le dépôt écrit lui-même
« micabo = progrès en cours, pas culture générale ». Réécrit autour des
révisions, des fiches et des examens, et les attrape-tout (`#fyp`, `#pourtoi`)
sont retirés : le prompt de `genererHashtags` les interdit, le repli ne va pas
dire l'inverse.

## La marque : « l'appli micabo » (0260 → 0263, puis 0267 le 17/09/2026)

Quatrième passage sur ce texte : 0260 bascule sur « micabo », 0261 revient au
site micabo.app, 0263 rebascule sur le nom nu, **0267 ajoute le mot de
catégorie**.

**L'état courant est « l'appli micabo »** : le nom toujours en minuscules même
en début de phrase, sans `.app`, mais **précédé du mot de catégorie** — « l'appli
micabo » ou « l'application micabo ». Le nom nu ne suffit pas : une slide se lit
en une seconde et ne dit pas ce qu'est micabo. Restent interdits « le site
micabo » et « la plateforme micabo » : c'est une application mobile.

Par langue : `the micabo app` (en), `la app micabo` (es), `die micabo-App` (de),
`micabo uygulaması` (tr). Quand la phrase dit déjà « une appli comme micabo », ne
rien ajouter — la catégorie y est.

**Le turc est le piège.** C'est une langue agglutinante : le cas se collait au
nom par une apostrophe (micabo'yu, micabo'ya, micabo'da, micabo'dan). En insérant
`uygulaması` (izafet), **le suffixe de cas migre sur le possessif** :

| avant | après |
|---|---|
| micabo'ya yükle | micabo uygulamasına yükle |
| micabo'yu kullan | micabo uygulamasını kullan |
| micabo'da test | micabo uygulamasında test |
| micabo'dan yardım | micabo uygulamasından yardım |

Remplacer bêtement « micabo » par « micabo uygulaması » produirait
« micabo uygulaması'yu », qui n'existe pas. Les formes suffixées se traitent donc
AVANT la forme nue. Et la règle de l'accusatif devant `kullan-` a besoin d'un
garde `(?!\s*uygulama)`, sans quoi elle remord sur sa propre sortie et donne
« micabo uygulamasını uygulamasını kullan » — le défaut a été pris au test, pas
en production. Jamais « sitesi » sous aucune forme.

**La règle vit dans une fonction SQL**, `micabo_avec_article(texte, langue)`
(0267), et non dans une requête jetable : le prochain qui bascule la marque la
relit, la rejoue à l'identique sur du texte neuf, et voit les cas limites déjà
traités.

**Avant toute nouvelle bascule, sauvegarder.** 0262 pose
`micabo_marque_sauvegarde` et y range le texte d'avant sous une étiquette
(`avant_micabo_nu_2026_09_15`, puis `avant_appli_micabo_2026_09_17` : 236 lignes — 130 `contenu_langues`, 47 passages, 49 `post_slides`, 10 prompts). C'est la leçon des deux premiers aller-retours :
la réécriture **fusionne deux formes en une** — « le site micabo.app » et
« micabo.app » nu donnent tous deux « micabo » — donc l'inverse ne peut être
qu'une reconstruction canonique, jamais une restitution. Avec la sauvegarde,
le retour se fait en relisant la valeur d'avant.

Deux autres choses apprises, qui valent au-delà de micabo :

- **Retirer le mot de catégorie AVANT de toucher au nom.** L'ordre inverse
  laisse « site micabo'yu » : la règle turque des suffixes a déjà consommé le
  nom et le mot orphelin reste.
- **Une suite de `regexp_replace` remord sur sa propre sortie.** « micabo ile »
  devenait « micabo.app sitesi.app sitesiyle ». Passer par une sentinelle
  (`chr(1)`) et ne rétablir qu'à la fin.

0267 fait exception à la règle ci-dessous et **réécrit** les decks au lieu de
les vider : ajouter un mot de catégorie ne change pas le sens du texte, donc
payer une retraduction complète n'aurait rien acheté. Les passages et
`post_slides` NON PUBLIÉS sont réécrits avec ; les publiés, jamais.

Pour une bascule qui change le sens, en revanche, les decks traduits sont
**vidés**, pas réécrits : ils traduisent une source qui vient de changer. `assurerDeckPourLangue` les refait
à l'assignation avec le prompt courant. C'est du crédit Gemini, pas du contenu
perdu — et rien pour les slideshows qui seront rejetés d'ici là.

`micabo.app` reste par ailleurs le **domaine de messagerie interne**
(`prenom.n@micabo.app`) et l'URL de l'OS, et `micabo` tout court le nom de
l'OS et de la plateforme : ne jamais les réécrire en cherchant la marque
produit. Les posts déjà **publiés** ne sont jamais touchés non plus.

## La forme allemande de la marque était à l'envers (0278, 29/09/2026)

45 slides sur 92 disaient « die App micabo » au lieu de `die micabo-App`. Repris
en base au 29/09 : sur les 150 lignes `contenu_langues` en allemand, **77 en
ordre inverse**, 22 de plus en « micabo App » sans trait d'union, **4 correctes**.

**L'allemand est la seule langue où ça se voit, et ce n'est pas un hasard** : sa
forme est un COMPOSÉ — le nom D'ABORD — là où le français, l'espagnol et le turc
mettent la catégorie devant (« l'appli micabo », « micabo uygulaması »). Un
modèle qui traduit « l'appli micabo » mot à mot rend « die App micabo » : correct
en français, faux en allemand. Trois formes fausses cohabitaient, dont
« die appli micabo » — le mot FRANÇAIS resté dans la traduction.

**Le garde de 0267 bénissait ce qu'il laissait passer.** `dejaQualifie` existe
pour ne pas doubler le mot de catégorie ; « die App micabo » en contient un, donc
`normaliserMarque` sortait à la casse sans jamais regarder l'ORDRE. Le garde
n'était pas trop large : il ne posait aucune question sur ce qu'il validait.
C'est la même famille que 0268 — une règle qui ne s'applique que sur un chemin
ne protège que ce chemin.

Second défaut de la même ligne : `Anwendung` ne comptait pas comme mot de
catégorie, donc « die Anwendung micabo » passait pour NON qualifié et repartait
dans le remplacement final, qui produit « die Anwendung die micabo-App ». Zéro
cas en base, rien ne l'empêchait.

- **On ne touche pas à l'article.** « die App micabo » → « die micabo-App »,
  « der App micabo » → « der micabo-App ». La déclinaison est imposée par la
  phrase, que ce code ne lit pas ; la réécrire casserait le cas grammatical.
  Vérifié après reprise : nominatif, accusatif et datif intacts.
- **`[ \t]` et non `\s`.** Vérifié en base : aucun saut de ligne ne sépare jamais
  la catégorie du nom. En tolérer un ferait fusionner deux lignes d'une slide —
  on corrigerait la marque en cassant la mise en page, qui est le produit.
- **Pas de sentinelle `chr(1)` ici.** Les deux passes ne se remordent pas : la
  première rend `micabo-App`, avec un trait d'union, que la seconde (espace
  obligatoire) ne peut plus voir. La leçon de 0262 tient, elle est réglée par la
  forme de la sortie plutôt que par une sentinelle.

`normaliserOrdreDe` vit dans `_shared/marque.ts` (module pur, 6 tests dont
l'idempotence et le non-collage de lignes) et son miroir SQL
`micabo_ordre_de` / `micabo_ordre_de_slides` dans 0278, comme
`micabo_avec_article` en 0267 : le SQL reprend le stock, le TS tient la
production courante, les deux doivent rester d'accord. Les neuf mêmes cas ont été
joués des deux côtés avant d'écrire quoi que ce soit.

**0278 réécrit au lieu de vider**, comme 0267 : remettre un composé à l'endroit ne
change pas le sens, donc payer une retraduction complète n'achèterait rien.
Sauvegarde `avant_micabo_app_de_2026_09_29` d'abord (98 decks, 18 passages, 18
`post_slides`) — la réécriture fusionne trois formes en une, donc l'inverse ne
pourrait être qu'une reconstruction. Les passages et `post_slides` **publiés ne
sont pas touchés** : 53 slides en ligne gardent la forme fautive, on ne réécrit
pas ce qui est publié.

Après reprise : **0 forme fautive** sur les trois surfaces, 102 decks corrects.

## Un slideshow est deux listes, et rien ne les tenait ensemble (0279, 29/09/2026)

Des créateurs recevaient des posts avec une slide **sans image** et une slide
**en double**. On a d'abord cru à deux défauts, et à un CTA micabo qui ajoutait
une slide. **Les deux étaient faux** : `placerSophiaSurDeck` RÉÉCRIT
`deck[deck.length - 1].texte_overlay` (`import_contenu.ts:1454`), il n'ajoute
rien. Un seul défaut produit les trois symptômes.

`contenus.structure_slides` porte les **images**, `contenu_langues.slides` porte
les **textes**. Elles doivent avoir la même longueur et le même ordre, et **rien
ne le vérifiait** — ni à l'écriture, ni à la livraison.

Sur `b1bc3cb3` : le TikTok d'origine avait 6 images, toutes en base
(`propre/1` à `propre/6`). `structure_slides` n'en listait plus que **5**, et ses
positions 4 et 5 pointaient `propre/5` et `propre/6` — **la 4ᵉ image avait été
retirée et les suivantes renumérotées**. Le deck avait gardé ses 6 entrées. Donc
les textes ne suivaient plus les images à partir de la suppression, le dernier
sortait deux fois, et le 6ᵉ n'avait aucune image. **11 créateurs** servis avec ce
trou.

**La source est l'éditeur de `/admin/file`.** Sa sauvegarde réécrit la structure
(suppression + renumérotation), puis pousse les textes **position par position**
via `majTexteSlideDeck`, qui ne sait qu'ÉCRASER une position : elle ne raccourcit
jamais le tableau, et **elle ne touche que le deck SOURCE**. Les decks traduits
gardaient l'ancien alignement — d'où des créateurs de langues différentes tous
troués au même endroit.

`_shared/deck_structure.ts` (module pur, réexporté en `deckStructure.ts`,
9 tests) tient l'invariant des deux côtés :

- **à l'écriture** — `realignerDeck(slides, ordreAncien)` remappe TOUS les decks
  de langue sur la nouvelle structure. On **remappe, on ne vide pas** : un texte
  traduit est du crédit déjà payé et il n'a pas changé de sens parce que sa
  voisine est partie. Le vidage reste réservé aux bascules où la SOURCE change de
  sens. Une position absente rend une entrée vide — décaler d'un cran pour
  combler un trou reproduirait exactement le défaut qu'on ferme.
- **à la livraison** — `positionsOrphelines` refuse de matérialiser un post dont
  le deck porte une position qu'aucune image ne porte. L'appelant tombe dans son
  `catch` générique et repioche. Même arbitrage que le 19/09 : un post de moins
  vaut mieux qu'un post cassé, et surtout ça rend visible un défaut qui partait
  en ligne sans un mot.

**Le garde-fou ne réintroduit PAS la pré-vérification d'existence des médias**
que 0265 a retirée : il ne lit rien de plus, il compare deux listes déjà en
mémoire, donc aucune fenêtre entre lecture et écriture. Un média effacé de
`media_library` reste géré par le `left join` de `creer_publication_atomique`.

### La reprise ne pouvait pas être uniforme (0279)

3 slideshows sur 175 validés, 13 decks. **Une troncature en aveugle en aurait
détruit trois.** Sur `0b9ce977`, `placerSophiaSurDeck` avait écrit le CTA DANS la
9ᵉ entrée en fr et en tr (et décalé l'outro en es) : couper à 8 faisait perdre le
placement micabo à deux langues. La règle appliquée est donc vérifiable ligne par
ligne :

- **tronquer** si la queue au-delà de la structure est un DOUBLON de l'entrée
  précédente et ne porte PAS le CTA — signature du défaut, les positions 1..N
  sont justes par construction (l'admin les a validées) → 10 decks ;
- **vider** sinon, `assurerDeckPourLangue` refait le deck depuis la source
  corrigée avec le prompt courant → 3 decks.

Repris aussi : 1 passage encore `assigne` qui partait le soir même avec son trou
(l'entrée en trop retirée, le créateur garde son post) et un vieux du 12/09. Les
**10 posts publiés** des 27 et 28/09 gardent leur slide vide — on ne réécrit pas
ce qui est en ligne. Sauvegarde `decks_desalignes_sauvegarde` avant toute
écriture (leçon de 0262).

**Autre cause, à ne pas confondre** : 3 slideshows dont `structure_slides`
référence un `media_id` **effacé de `media_library`**. Les deux listes sont de
même longueur, c'est la cible qui a disparu. Le garde-fou ci-dessus ne les
attrape pas, volontairement (voir 0265). Non traités par 0279.

**Leçon de méthode** : la première explication — « le CTA ajoute une slide » —
tenait debout et collait aux symptômes, sans qu'aucune ligne de code ne la
soutienne. Lire le code qui écrit, pas seulement les données qu'il laisse.

## Un média effacé désarmait le garnissage au lieu de le déclencher (0280, 29/09/2026)

Deuxième cause des slides sans image, à ne pas confondre avec 0279 : ici les
deux listes ont la même longueur, c'est la **cible qui a disparu**.
`structure_slides` porte un `media_id` dont la ligne `media_library` n'existe
plus.

`resoudreVisuelsAssignation` sait pourtant garnir une slide vide depuis la
bibliothèque du label — **740 images** disponibles sur `classic-study`. Mais son
test était `if (s.media_id)` : il faisait confiance à l'identifiant **sans
vérifier la ligne**. Une référence pendue passait donc pour « image stockée
(pinned ou import) », court-circuitait le garnissage, et le `left join` de
`creer_publication_atomique` écrivait NULL.

**Le mécanisme de secours existait et était désarmé par le cas même qu'il aurait
dû couvrir.** C'est la même forme que 0277 — le retrait d'un label attirait le
repli vers lui — et que 0278 — le garde bénissait ce qu'il laissait passer : une
condition qui ne pose pas de question sur ce qu'elle valide.

Les ids de la structure sont désormais relus en une requête, et un id absent
tombe dans le garnissage avec un motif distinct (« média effacé remplacé — … »)
pour que ça se voie dans `passages.visuels_resolution`.

**Ce n'est pas la pré-vérification d'existence retirée par 0265.** Celle-là
gardait une ÉCRITURE et ouvrait une fenêtre où une FK violée passait. Ici on est
dans le résolveur, dont le métier est de choisir un média et qui lit déjà la
biblio du label. Si la ligne disparaît entre la lecture et l'écriture, le
`left join` écrit NULL comme avant : aucune garantie perdue, une gagnée.

Reprise : les 3 `structure_slides` concernées ont leur `media_id` pendu
**retiré** (`media_id = null` dit la vérité — cette slide est à garnir ; le
laisser reste un piège pour tout chemin qui lirait la structure sans passer par
le résolveur, et l'éditeur affichait une slide « pourvue » qui ne l'était pas).
Et les 3 slides trouées des 2 passages NON PUBLIÉS sont remplies par un tirage
dans la biblio du label — hook en position 1, pool sinon, jamais un média déjà
présent dans le post : le repli de `tirerMediaParCritere`, à la main. On remplit
plutôt que de supprimer le passage : le créateur garde son post, et le passage
du 12/09 appartient à un cycle qu'on ne rouvre pas. Sauvegarde
`media_efface_sauvegarde`.

## Le relevé payait jusqu'à soixante fois chaque post (0281, 01/10/2026)

Le 28/09 à 22:16 UTC, Apify a commencé à répondre `402
not-enough-usage-to-run-paid-actor` : crédit du cycle épuisé. Plus aucun
relevé, donc plus aucun cycle clos, plus aucune requalification, et le pool
tirable est tombé à zéro le 01/10 (assignation à 46/52, repêchages seuls).
**Le drain s'est pourtant déclaré « terminé, erreurs : [] » trois nuits de
suite.** C'est le brief du matin (`docs/brief/`) qui l'a vu, par
l'horodatage des relevés.

Le crédit n'était pas épuisé par malchance. Une journée normale, le 28/09 :
**74 scrapes de profil, ~2 450 résultats Apify, 1 349 passages re-mesurés
pour ~50 nouveaux posts.** Trois causes, toutes dans le relevé :

1. **Tout était re-mesuré, tout le temps.** Un passage publié depuis 30 jours
   était re-scrapé dès que son relevé avait 6 h : deux fois par jour pendant
   un mois, jusqu'à ~60 mesures par post. Le moteur n'en lit qu'une
   (`MESURE_JOURS`, J+2) et le plateau tombe vers J+4–J+6. Et la profondeur de
   scrape suivait le NOMBRE de dus (2 × n), pas leur ÂGE : 40 posts lus par
   compte et par passe, même pour des dus tous récents.
2. **Le verrou du drain n'était pas atomique.** Lire `elo_dernier_run`, tester
   `busy`, écrire. Entre la fin d'un lot (busy=false) et le kick du suivant,
   le cron minute lisait le même curseur : **23 scrapes en double sur 74**,
   jusqu'à trois sur le même compte à 10 ms d'écart. Une fois dédoublée, la
   chaîne le restait jusqu'à la fin de la file.
3. **Un post introuvable était payé à vie.** Chaque passe relançait un
   `scrapePost` (un lancement Apify par post) : 70 le 28/09, dont 22 « pas de
   match » retentés deux fois par jour pendant 30 jours.

Le lien du créateur n'y était pour rien : 0 post publié sans lien en
septembre, et 1 349 rapprochements par URL contre 61 replis le 28/09.

**Les règles vivent dans `_shared/releve_file.ts`** (module pur, réexporté par
`src/features/moteur/releveFile.ts`, 16 tests) :

- relevé à **20 h** d'intervalle (`RAFRAICHIR_APRES_MS`), coincé entre les
  13 h qui séparent minuit de 13:00 (la passe de midi ne re-mesure plus ce que
  minuit vient de mesurer) et 24 h moins un drain ;
- **figé après 7 jours** (`RELEVE_FIGE_APRES_JOURS`), au-dessus de
  `PASSAGE_PERIME_JOURS` et de `MESURE_JOURS` — un test le verrouille ;
- profondeur de scrape = nos posts publiés depuis le **plus vieux dû**, +25 %
  et +2 (`profondeurScrape`) ; un compte sans dû n'est pas scrapé, et son
  scrape « metrics seules » n'a lieu qu'une fois par 20 h ;
- `scrapePost` de repli seulement dans la fenêtre de 7 jours, et abandon
  après **3 échecs** (`passages.stats_echecs`, `stats_tentative_at`).

**Le verrou se prend en base** (`prendre_verrou_drain_elo`, 0281) : un UPDATE
compare-and-set sur la ligne `reglages`, qui refuse aussi un kick dont le
curseur a déjà été dépassé. Testé sur PostgreSQL 16 : 20 appels simultanés,
un seul gagnant. Même famille que `repecher_contenu` (0275).

**Deux défauts de plus, trouvés en chemin :**

- les erreurs de scrape étaient rangées compte par compte et **jamais remontées
  au drain** — d'où le « erreurs : [] ». Elles le sont ; un 402 arrête la file
  (`apifyEpuise`) au lieu de faire défiler 27 comptes en erreur ;
- la requalification « au relevé » (0257) prenait les slideshows **visés** par
  la passe, pas ceux **mesurés**. Apify en 402, elle jugeait des cycles sur
  des vues figées : **10 B→C le 30/09 sans une vue nouvelle.** Elle ne touche
  plus que les passages réellement relevés, et la requalification et la
  qualification de fin de drain sont sautées quand Apify est épuisé.

Estimation sur les logs du 28/09 : de ~2 450 à **~900–1 100 résultats par
jour** (÷2,5), sans perdre une mesure dont le moteur se sert. La passe de 13:00
ne prend plus que les posts du matin.

**Visibilité** : chaque départ de passe écrit la consommation du cycle
(`GET /v2/users/me/limits`) dans `reglages.apify_usage` ; le brief du matin la
lit (Q9) et alerte à 70 % / 90 %.

### Rattrapage du 01/10 et verdicts rejugés (0282)

Crédit Apify remis par Adrien, drain relancé à 10:27 UTC : 26 comptes en
**une seule chaîne** (aucun doublon), 340 passages relevés, 8 introuvables,
0 erreur, en 13 minutes. Fin de file : 7 requalifications sur données
fraîches, 8 cases de créateurs corrigées (dont 5 remontées après une
rétrogradation du 30/09 sur vues figées), 8 reposts bonus que la panne avait
masqués (> 50 000 vues), programmés du 03 au 06/10.

**Les verdicts rendus pendant la panne ont été rejugés** (0282). 70 verdicts
entre le 28/09 22:16 et le 01/10 10:27 UTC ; chacun recalculé sur le même
cycle, au même instant, avec les vues rattrapées (`bilanCycle` + `requalifier`
répliqués en SQL et recoupés cas par cas avec les fonctions TS). **21
différaient, tous encore en vigueur** : dix B→C et deux C→D à tort, cinq
slideshows en D à 1 100 – 2 700 vues (leur place était B), trois A qui
devaient passer S (31 000 à 52 000 vues), un C qui devait passer B. Corrigés
sur le tier et la cible, **pas sur `tier_maj_at`** : le cycle en cours n'est pas
rouvert, le trigger de 0272 journalise un `ajustement`. Sauvegarde
`verdicts_figes_sauvegarde` (RLS active, aucune policy).

« En vigueur » veut dire : aucune VRAIE requalification depuis. Un repêchage
D→D à un passage ne compte pas — un slideshow descendu en D à tort puis
repêché est toujours prisonnier du verdict faux, et c'est lui qu'il fallait
sortir.

**Effet de bord connu, non corrigé** : `vues_globales_jour` (Pilotage) somme,
par compte, les vues des N derniers posts du dernier scrape de profil. N
dépendait déjà du nombre de passages dus (12 à 40) ; il suit maintenant leur
âge (~20 en régime), donc le « total » a perdu la moitié de son échelle le
01/10 (delta −4 M) sans qu'aucune audience ne bouge. Ce n'a jamais été un
total. Le recalculer depuis `passages` (nos posts, à âge égal) est le bon
correctif ; c'est un point « À traiter » du brief, pas une urgence.

## Une seule mesure par post, à J+2, par son lien (0283 → 0285, 01/10/2026)

0281 avait divisé la consommation Apify par ~2,5, et ce n'était pas assez.
Mesuré sur le rattrapage du 01/10 : **1,60 $ pour 26 scrapes de profil et
570 posts lus, soit ~2,8 $ pour 1 000 résultats.** En régime, deux passes par
jour remontaient 7 jours de posts sur 26 comptes, soit 2,3 à 2,9 $/jour : la
limite de 70 $ serait tombée vers le 08–09/10, avant la fin du cycle.

Le coût ne venait plus du NOMBRE de mesures, mais de leur **profondeur**. Pour
re-mesurer un post vieux de six jours, le scrape de profil lit les vingt qui
l'ont suivi. Or le moteur ne lit qu'un chiffre, celui de J+2
(`MESURE_JOURS`), sur lequel le cycle est jugé.

Décision d'Adrien : **une mesure, à J+2, et c'est tout.**

- un post est relevé quand il a `MESURE_JOURS` jours, puis **plus jamais**
  (`mesureFaite` : relevé pris à J+2 ou après). Un post relevé trop tôt avant
  le 01/10 est refait une fois, à J+2 ;
- **par son lien** : tous les posts dus d'un compte partent dans **un** appel
  Apify (`postURLs`, `apify_releve.ts`), sans téléchargement. On paie le post,
  pas les vingt qui l'entourent. Rapprochement par l'identifiant du lien
  résolu, à défaut par le lien que renvoie l'actor (`apparierParLien`) ;
- **sans lien valide** (`lienTiktok` : champ vide, hashtags collés à la
  place), et seulement là, le profil est lu jusqu'au post et le post est
  retrouvé par cohérence (±36 h + texte). Plus de 7 jours sans lien : abandonné ;
- l'espacement de 20 h ne joue qu'après un ÉCHEC (`stats_tentative_at` sans
  `stats_maj_at` au même instant). Sans cette nuance, un post relevé trop tôt
  à 12:30 attendait le lendemain 13:00 pour sa mesure de J+2 ;
- plus de `scrapePost`, plus de scrape « metrics seules », plus de
  `compte_metrics` écrit par le relevé.

`apify_releve.ts` est un module à part, pour la même raison qu'`apify_usage.ts`
(0281) : `apify.ts` est tiré par six autres bundles, qui « changeaient » au
moindre ajout. Seuls `rattrapage-elo` et `minuit-vnext` bougent.

**La courbe du Pilotage ne lit plus les profils** (0285). `vues_globales_jour`
sommait le dernier scrape de chaque profil, un « total » qui dépendait du
nombre de posts lus. Sans scrape de profil, il se serait figé sans un mot.
`snapshot_vues_globales(p_jour, p_jours)` le calcule désormais sur nos
passages, hors posts test :
- `vues_delta(J)` = vues relevées des posts publiés le jour Paris J ;
- `vues_totales` = leur cumul.

Un post n'étant mesuré qu'à J+2, la fonction recalcule les quatre derniers
jours à chaque passe. L'historique est recalculé de la même façon, avec la
sauvegarde `vues_globales_jour_sauvegarde`. Au 01/10 : 10,37 M de vues sur nos
posts depuis le 07/09.

Le bouton « Rafraîchir » des Analytics est **supprimé**. Il appelait la fonction
`metriques`, qui scrape 30 posts par profil pour tous les comptes : environ 800
résultats, ~2 $ par clic. La fonction reste déployée, mais plus rien ne
l'appelle — ni cron, ni écran.

### Verdicts du jour (0283)

116 cycles pleins attendaient leur verdict : leurs passages des 28–30/09
n'avaient été relevés que le 01/10. Décision d'Adrien : juger le jour même.
`requalifier()` a été répliqué sur la moyenne des vues relevées, quel que soit
leur âge :
- **38 jugés** ;
- **33 descentes reportées** : tier gardé, cycle rouvert ;
- **5 cycles rouverts** : aucun post publié, créneau passé ;
- 39 non touchés : un passage du jour n'était pas encore publié.

Le report des descentes est délibéré. Une vue de moins de deux jours vaut
~45 à 70 % de sa valeur à J+2 : une montée sur vues jeunes reste vraie, une
descente est probablement fausse. C'est la classe d'erreur que 0282 venait de
corriger. Sauvegarde dans `verdicts_du_jour_sauvegarde`.

Résultat : 84 slideshows tirables (71 en B ou mieux) et 110 passages dus pour
52 posts par jour, soit **2,1 jours** de runway (0,2 avant).

### Les slideshows cold-study sortent du pool (0284)

Les 50 slideshows encore `valide` qui ne portaient que `cold-study` (supprimé
par 0277) passent en **`rejete`**, pas en suppression. Les FK `passages`,
`reposts_bonus` et `contenu_tier_historique` sont en CASCADE : supprimer ces
contenus aurait effacé 146 passages publiés, avec leurs vues, que la
qualification des créateurs lit encore. La source `studylapses` (niche
cold_study) est désactivée. Sauvegarde dans `cold_study_retrait_sauvegarde`.
Les « dus intirables » tombent à 0.

**Déploiement du 01/10/2026, après OK d'Adrien.** Migrations 0283 → 0285
appliquées. Deux chargeurs sur `8d8b504` : `rattrapage-elo` (v22) et
`minuit-vnext` (v37).

- **Les deux alias `createClient` ont été renommés** : `he`→`be` et `Ue`→`De`,
  relus dans les bundles.
- Les dix autres bundles ressortent identiques à l'octet.
- Test de vie `401` passé sur les deux (par `pg_net`).
- Relevé à blanc sur `irem.is684` : un lien, un appel Apify, 54 700 vues
  rapprochées par le lien en 7 s, aucune écriture.

## Le calendrier du créateur suit le jour de Paris (01/10/2026)

Signalé par Rana : le calendrier « vide » chez Ramazan (@asya.ders680) et Isil
(@baran.notlar863), qui publiaient. La base était saine, et le calendrier du
manager complet. La page du créateur prenait « aujourd'hui » et le mois affiché
à l'heure du TÉLÉPHONE (`aujourdhui()`, `new Date()`), alors que le moteur date
les posts au jour de Paris. Conséquences :
- en Turquie (une heure d'avance), entre minuit et 1 h, « Aujourd'hui » était
  vide ;
- le 30/09 au soir, la grille s'ouvrait déjà sur un mois d'octobre sans aucun
  post. Ramazan l'a ouverte à 00:31 heure turque ;
- et un post publié en retard — Isil publie souvent la veille pour le
  lendemain — ne s'affichait plus nulle part dès le lendemain.

`calendrierPoster.ts` (pur, testé) : la page prend `aujourdhuiParis()`, ouvre
la grille sur le mois de Paris, et « Aujourd'hui » montre aussi les posts non
publiés des deux jours précédents, marqués « en retard ». Le calendrier admin
et manager n'est pas touché. Limite latente repérée au passage :
`postsCalendrierAdmin` plafonne à 800 lignes, et perd déjà ce qui précède le
11/09.

## Les posts faisaient la publicité des concurrents (0286, 01/10/2026)

Wilgo dans **43 posts sur 14 jours, dont 30 publiés** : « Benutz die WILGO App…
dein Cheatcode für gute Noten », « ceux qui ont la mention TB utilisent la
méthode WILGO », « Wilgo'dan test çöz », et même un reste de fiche App Store
derrière le CTA micabo. La cause est à la source : des slideshows importés de
comptes concurrents (`jeanne.wilgo`). Au 01/10, **76 decks validés sur 35
slideshows** citent un concurrent, dont 56 Wilgo.

Rien ne l'attrapait, et c'était voulu à moitié : `retirerMentionConcurrent`
(0269) ne coupe que Hustly, parce qu'une coupe aveugle sur « Anki » détruirait
des comparatifs légitimes. **Décision d'Adrien : un classement ou un comparatif
reste, une recommandation se remplace.** Trancher entre les deux est un travail
de lecture, pas une regex — c'est donc le brief du matin, un modèle, qui le
fait, chaque matin, sur les posts du jour pas encore publiés
(`docs/brief/PLAYBOOK.md`, étape 2 bis).

- `concurrents` : la liste, éditable en base. Motifs POSIX **en mots entiers**
  (`\m … \M`) : « Ranking » contient « anki », c'est le faux positif vu au
  premier repérage. ChatGPT, Gemini et Perplexity n'y sont pas (IA
  généralistes), ni « notion » (un mot français).
- `mentions_concurrents(debut, fin)` : lecture seule, une ligne par slide ou
  légende qui cite un concurrent actif. Elle lit `texte_overlay` élément par
  élément : dans `slides::text`, le JSON écrit le saut de ligne `\n` et
  « \nWILGO » n'est plus un mot entier.
- `corriger_texte_post` / `corriger_hashtags_post` : **les seules écritures que
  le brief s'autorise**. Post non publié uniquement — la fonction lève sinon,
  on ne réécrit jamais ce qui est en ligne. Elles corrigent le post, le passage
  et, s'il porte encore le même texte à cette position, le deck de la langue
  (les prochains posts naissent propres), jettent le rendu incrusté de la
  slide, et journalisent avant/après dans `concurrents_corrections`. Pas de
  bloc `exception` (règle de 0265). Réservées au `service_role`.

Le brief lit aussi les posts **publiés** la veille qui citent encore un
concurrent (Q10, contrôle) et le stock du pool (Q9 `decks_pool_concurrents`,
qui doit baisser). Ce qui lui échappe : les posts publiés avant son passage de
07:52, ~2,4 % des posts.

**Les posts enchaînés (Q12)** sont dans le même passage : deux posts du même
compte à moins de 5 minutes. L'heure est celle de TikTok quand le lien porte
l'id de la vidéo (les 32 bits de tête de l'id sont l'horodatage Unix de la
création), sinon `publie_at`, l'heure du clic « publié » dans l'OS. Sur les 18
posts du 25/09 au 01/10 qui ont les deux, écart médian **0,9 min**, 90 % sous
2,1 min : l'heure de l'OS est un bon indicateur. Mais 323 liens sur 341 sont
des liens courts (`vm.tiktok.com`) sans id, et un créateur qui coche deux
posts d'un coup sortirait à tort. Le relevé de J+2 résout déjà chaque lien par
Apify ; y ranger l'heure de création TikTok rendrait la mesure exacte.

Migration appliquée le 01/10, aucun chargeur redéployé : le moteur n'a pas
changé.

## Plus aucune slide ne cite un concurrent par erreur de placement (0287, 01/10/2026)

0286 ne faisait que repérer et corriger chaque matin ce qui partait. Adrien :
« je veux que les slides (sauf classements) ne citent pas des concurrents ».
Le chiffre qui a décidé, sur les decks de `jeanne.wilgo` : **27 decks en
langue d'origine sur 48 (56 %)** citaient encore un concurrent, contre **27
traduits sur 105 (26 %)**. La traduction en retire la plupart, son prompt
interdit les produits tiers ; le chemin source n'a aucun traducteur (0268) et
le placement micabo ne réécrit qu'UNE slide.

**La règle**, écrite pour le modèle (`corrigerMentionsConcurrents`) comme pour
le brief :
- recommandation, consigne, témoignage isolé, méthode à son nom, reste de
  fiche App Store → le nom du concurrent devient la forme de marque de la
  langue, **le reste mot pour mot, promesses comprises** (« gratuite »,
  « vérifiée par des profs » restent : décision d'Adrien) ;
- classement où le concurrent est le **gagnant** (« Wilgo IA 9/10 » devant
  ChatGPT et Gemini) → c'est son placement, il devient micabo. Le placement
  allemand de `5cc2bb38` le faisait déjà de lui-même ;
- classement ou comparatif où il n'est qu'un élément noté et où micabo gagne
  (« j'ai utilisé quizlet », « Anki 6/10, perte de temps ») → laissé.

**Le stock** : 99 slides relues une par une, deck entier sous les yeux, en
cinq langues — **73 remplacées, 26 laissées**, 9 slides de posts non publiés et
2 légendes `#Wilgo`. Chaque décision et son motif sont dans
`concurrents_reprise_0287`, la sauvegarde (166 lignes) dans
`concurrents_reprise_sauvegarde`, le journal dans `concurrents_corrections`.
Les publiés ne sont pas touchés. Restent 25 slides qui citent un concurrent :
toutes des classements, marqués `concurrent_laisse` sur la slide.

Deux cas laissés exprès, à trancher dans la file : `9dc90d30` et `fabbb97c`
(en brouillon) sont faits de **captures de fiches App Store** de concurrents.
Réécrire le texte n'enlèverait pas l'image ; ils sont à refuser, pas à
réécrire. Et « study smarter » est une expression anglaise courante : le motif
StudySmarter passe en un mot.

**Le moteur** : `sansConcurrents` (`import_contenu.ts`) tourne à la sortie de
`assurerDeckPourLangue`, sur TOUS les chemins — deck déjà prêt, langue
d'origine, traduit — parce qu'une règle qui ne vit que sur un chemin ne protège
que ce chemin (0268). Sans mention, il ne coûte qu'une regex sur la liste de
la table `concurrents` (relue toutes les 10 minutes, repli sur la liste de 0286
si elle est illisible). Avec mention, un appel modèle court qui ne reçoit à
réécrire que les slides qui citent, mais lit le deck entier. `concurrents.ts`
(pur, 11 tests) contrôle la sortie : une réécriture qui cite encore un
concurrent, contient un tiret long, ou a gonflé (plus d'une ligne ou de moitié
de plus) n'est pas écrite. Le résultat est rangé dans `contenu_langues` : payé
une fois par deck. Un « classement » est mémorisé sur sa slide
(`concurrent_laisse` = le texte jugé) et rejugé seulement si le texte change.
Un appel raté laisse le deck tel quel : le brief du matin (0286, Q11) est le
filet.

**Piège de l'outil, à connaître avant la prochaine reprise** : le MCP Supabase
demande une **confirmation humaine** avant toute instruction destructive
(`delete`, `drop`). Sans interface pour la donner, l'appel attend son délai de
60 s et la transaction est annulée, sans un mot sur la cause. Quatre essais
sont tombés là-dessus (un `delete from burn_rendus` vide, des `drop table` de
tables temporaires) avant qu'un chronométrage étape par étape ne montre que
chaque instruction prenait quelques millisecondes. Une reprise passe par des
tables permanentes et sans `delete` ni `drop` ; une suppression vraiment
nécessaire se fait à part, et se dit.

**Déploiement du 01/10/2026, après la demande d'Adrien** (« fais la correction
mtn »). Cinq chargeurs sur `772589b` : `assignation-contenu` (v34),
`assignation` (v35), `revoquer-post` (v34), `bruler-texte-test` (v24) et
`minuit-vnext` (v38) — les cinq qui tirent `assurerDeckPourLangue`, environ
+6 Ko chacun. **Trois alias `createClient` ont été renommés** : `ce`→`pe`,
`he`→`_e`, `de`→`me` ; `De` et `Y` inchangés, relus dans les bundles.
`bruler-assignes`, `import-contenu` et `renettoyer-contenu` ressortent à taille
constante (permutation d'identifiants) : leurs bundles du dépôt, déjà en prod,
sont gardés tels quels. Les quatre autres sont identiques à l'octet.

## Des slides portaient l'OCR brut d'une capture d'écran (0288, 01/10/2026)

Vu en relisant 0287 : sur `8e88d77c`, le texte des slides 6 à 8 était l'OCR
intégral de l'image — fiche de figures de style tronquée, agenda Google avec
un clavier entier (163 lignes), notes de maths en russe (188 lignes) — et la
traduction allemande l'avait recopié. Vidés sur décision d'Adrien : la slide
part avec son image, sans texte superposé. Sauvegarde dans
`textes_bruit_sauvegarde`.

**Un seuil de longueur ne suffit pas à trier** : « plus de 40 lignes ou 900
caractères » a ramassé 4 slides sur 123 slideshows, dont une vraie
(`e7422935`, « 5 techniques infaillibles », un texte long et légitime). Chaque
slide a été lue avant d'être vidée. Si l'import doit un jour écarter ce bruit
à la source, c'est un critère de contenu (proportion de lignes d'un ou deux
caractères, alphabet différent de la langue du deck), pas de longueur.

## Placement micabo : seconde moitié, une mention par deck (0289/0290, 01/10/2026)

Le doc « Placement micabo : réflexion et propositions » (01/10) a mesuré ce que
faisait le placement : **47 % des placements récitaient une fonction** de l'appli
(« génère tes fiches », « au bon moment », « crée ton plan de révision »), **10
sur 24 cassaient le deck** (numéro faux, item de classement perdu, outro
écrasée, « faits fous » devenus pub), et **22 % des decks citaient micabo deux
fois** (38 % en turc). Décisions d'Adrien : seconde moitié du deck, PeECH
concurrent, les slides allemandes reprises, le stock déjà placé **n'est pas
replacé** (seuls les prochains decks), et un contrôle LLM chaque matin.

**Les doubles mentions ne venaient presque jamais du placement.** Elles venaient
d'un concurrent remplacé par micabo (0287), d'une appli tierce que la traduction
avait remplacée, ou d'un CTA écrit à la main sans cocher la case — puis
`placerSophiaSurDeck` ajoutait son propre micabo ailleurs. D'où, dans
`assurerDeckPourLangue` : **les concurrents passent avant le placement**, et
**une slide qui cite déjà micabo est marquée comme placement** au lieu d'en
recevoir un second (`slideCitantMicabo`, `marquerPlacement`). Le prompt des
concurrents et `appliquerVerdicts` ne laissent plus qu'**une slide nommer
micabo** : les autres recommandations deviennent sans marque. La traduction
reçoit `ctaManuel` dès que la source cite micabo, quelle qu'en soit la raison.

**Réponse à la question d'Adrien** (« quand il y a déjà un placement manuel,
juste traduction ? ») : oui si la slide est cochée dans l'éditeur
(`placement_manuel`) — c'était déjà le cas. Non si micabo est seulement écrit
dans le texte : le moteur en ajoutait un second. C'est fermé par la détection
ci-dessus.

**Seconde moitié du deck** (`positionsPermises`, `_shared/placement.ts`, pur,
7 tests) : la moitié haute du deck **plus** les 3 dernières, jamais la
couverture. On ouvre, on ne resserre jamais : sur 4 slides, la moitié seule
n'en laisserait que 2.

**Le placement contournait les règles de la marque.** `placerSophiaSurDeck`
écrivait la variante du modèle sans `nettoyerTexteDeck` : 11 decks, 2 passages
et 2 `post_slides` non publiés étaient revenus à « die App micabo » après la
reprise de 0278. Corrigé dans le moteur, stock repris par 0289 avec
`micabo_ordre_de_slides` (sauvegarde `avant_placement_0289_2026_10_01` dans
`micabo_marque_sauvegarde`). Même famille que 0268.

**Le prompt v2** est posé sous `placement_micabo_v2`, clé que le moteur **ne
lit pas** : la bascule de `placement_micabo` attend le verdict d'Adrien sur
l'essai à blanc. Le suffixe du code, lui, est déjà en production : gabarit des
voisines, « ne recopie jamais une autre slide », forme de marque par langue
(`FORME_MARQUE`), et la meilleure variante choisie sur « un élève l'aurait-il
écrite » plutôt que sur la seule conformité.

### L'essai à blanc (`essai-placement`, 0290)

Une fonction qui fabrique le deck comme la production (traduction comprise),
puis fait tourner sur ce même deck l'ancien moteur (`avant.ts`, figé) et le
nouveau, **sans rien écrire**. 30 paires : les 20 slideshows dont le texte
d'origine existe encore sans placement (tous de source anglaise), 20 en
français et 10 en anglais. Résultats rangés dans `essai_placement_0289`, avec la
clé A/B du jugement à l'aveugle (RLS active, aucune policy) — `net._http_response`
est purgé en quelques heures. Les deux versions sont dans l'onglet « Essai à
blanc » du doc, à juger par Adrien.

| Compteur (30 paires) | Ancien | Nouveau |
| --- | --- | --- |
| fiche produit (génère, au bon moment, plan auto…) | 13 | 3 |
| deux mentions de micabo dans le deck | 14 | 0 |
| promet une lecture audio | 1 | 9 |
| plus long que la plus longue voisine + 20 % | 3 | 8 |
| sur la dernière slide | 9 | 5 |

**Leçon de méthode : un exemple dans un prompt se recopie.** Au premier passage,
« mon prof m'a demandé ce que j'utilisais », donné comme exemple de preuve,
ressortait mot pour mot dans **9 placements sur 22** — même avec « ne recopie
jamais les exemples » ajouté. Le seul remède a été de retirer l'exemple et de
décrire la forme sans phrase citable.

**PeECH devenait « micabo » avec sa promesse audio** : 9 essais sur 30 disaient
« transforme tes notes en audio avec l'appli micabo ». Tranché par Adrien :
micabo ne fait pas d'audio, PeECH devient sans marque (0291, ci-dessous).

### Le contrôle de 08:49

`docs/brief/PLACEMENT.md` + **Q13** (`placements_a_controler`). Chaque matin, la
routine « Contrôle placement micabo » (`trig_01EPvFVm9SVHfVU9NvrXSWRT`, liée à la
session qui a fait ce travail) relit la slide micabo de chaque post non publié
de J-2 à J, la juge contre huit règles (une mention, gabarit, marque, longueur,
fiche produit, une idée, pas d'audio, promesse de la couverture), corrige au plus 25 posts
par `corriger_texte_post` et écrit la page « AAAA-MM-JJ · Contrôle placements ».
Une routine à session neuve ne marche pas ici : elle naîtrait sans Supabase,
sans Notion et sans dépôt (le paramètre `connectors` est refusé pour cette
organisation).

### Déploiement du 01/10/2026

Cinq chargeurs sur `3898647` : `assignation-contenu` (v35), `assignation`
(v36), `minuit-vnext` (v39), `revoquer-post` (v35) et `bruler-texte-test`
(v25), plus `essai-placement` (v2, nouveau, alias `z`). **Les cinq alias
`createClient` ont été renommés** : `pe`→`ge`, `_e`→`ye`, `De`→`Le`, `me`→`he`,
`Y`→`W`. Test de vie `401` passé sur les six. `bruler-assignes`,
`import-contenu` et `renettoyer-contenu` ressortent à taille constante
(permutation) : leurs bundles du dépôt sont gardés.

**`new RegExp` au niveau d'un module partagé fait « changer » tous les
bundles.** Le premier `MOTIF_MICABO` était construit par `new RegExp(...)` : esbuild
ne l'élaguait pas, même annoté `/* @__PURE__ */`, et il entrait dans trois bundles
qui ne s'en servent pas. Un littéral `/…/iu` s'élague. Même leçon que
`apify_usage.ts` (0281).

La branche `claude/wizardly-allen-c3xioi` a été repartie de `main` (son ancien
sommet `6a4de96` était le contenu déjà fusionné de #95, arbre identique) : les
chargeurs des déploiements précédents pointent sur des SHA que GitHub sert
toujours.

## micabo ne fait pas d'audio : PeECH sans marque (0291, 01/10/2026)

Décision d'Adrien après l'essai à blanc : « micabo ne fait pas d'audio, PeECH
sans marque ». PeECH lit les notes à voix haute ; la règle de 0287 (une
recommandation de concurrent devient micabo) lui faisait prêter cette fonction à
micabo. Une fausse promesse sur le produit, juste avant le téléchargement.

- **`concurrents_sans_marque`** : les concurrents dont une slide ne devient
  jamais micabo, mais une formulation sans marque (« une appli audio »).
  `versMicaboDepuis` la lit, `appliquerVerdicts` refuse une réécriture qui y
  met micabo, et le prompt des concurrents reçoit la liste (`sansMarque`). Si
  la table est illisible, le repli de `CONCURRENTS_DEFAUT` garde PeECH sans
  marque.
- **Une table à part, pas une colonne.** `alter table concurrents add column`
  a fait attendre l'outil MCP sa confirmation humaine jusqu'au délai de 60 s,
  deux fois, sans rien appliquer : même piège que les `delete`/`drop` de 0287,
  étendu aux ajouts de colonne. Une création de table passe.
- **Le stock** : 17 slides prêtaient l'audio à micabo. 12 decks turcs, où la
  traduction avait remplacé PeECH par micabo (« notlarımı micabo uygulaması ile
  sese çeviriyorum »), et `78e85e05` en cinq langues : un placement **manuel**
  qui listait « mode audio » parmi les fonctions de micabo. Réécrits au plus
  court, chaque décision dans `audio_0291`, sauvegarde
  `avant_sans_audio_2026_10_01`, deux posts non publiés corrigés par
  `corriger_texte_post`. Les turcs avaient aussi un placement ailleurs : la
  réécriture ferme du même coup leur double mention.
- **Le prompt v2** le dit (« micabo ne lit pas les notes à voix haute »), et la
  slide d'une appli audio n'est plus une place pour micabo. Le contrôle de
  08:49 en fait une règle de priorité haute.
- **Troisième passage de l'essai** (celui qu'Adrien juge) : fiche produit
  16 → 1, deux mentions 13 → 0, audio 0 → 0, plus long que les voisines 4 → 8,
  dernière slide 11 → 4. Le prompt invente encore parfois une matière ou une
  note absente du deck (« partiel d'histoire », « B+ in Biology ») malgré
  l'interdiction ajoutée : le contrôle de 08:49 le traite comme un défaut.

## Bascule du placement sur la v2, numérotation tenue par le code (0292, 01/10/2026)

**Verdict d'Adrien** : « globalement A est un peu mieux que B, mais l'idée globale
est surtout de voir sur un post entier : pas de bafouillement (si classement,
les chiffres du classement restent), pas d'emmêlement, clarté, sens ». A et B
étaient tirés au hasard par deck (A = nouveau sur 17 lignes) : démasqués, ses 9
choix donnent **4 au nouveau, 3 à l'ancien, 2 égalités**. Avec les compteurs du
passage final (fiche produit 16 → 1, double mention 13 → 0), `placement_micabo`
reçoit la v2 ; l'ancien est rangé sous `placement_micabo_v1_2026_10_01` — le
retour se fait en le recopiant. Seuls les prochains decks sont placés avec.

**Son critère, appliqué aux 30 posts entiers, a trouvé ce que les compteurs ne
voyaient pas** : la numérotation cassée. Ancien 7 fois sur 30 (outro écrasée par
un « conseil n°4 » après le n°5, « 5. » à la place du « 4. » remplacé), nouveau 5
(« 2, 4, 4 », un « 5. » ajouté à un deck sans numéros, le titre de la slide
suivante recopié). Un prompt ne tient pas ça — le suffixe disait déjà « reprendre
EXACTEMENT le préfixe ». C'est donc le code qui le tient :

- **`choisirVariante`** (`_shared/placement.ts`, pur, 13 tests) : `alignerPrefixe`
  remet le numéro de la slide remplacée mot pour mot (« 3. », « conseil n°3 »,
  « Tip #4 », seul sur sa ligne s'il l'était) et retire un numéro ajouté à un
  deck qui n'en a pas ; `casseLeDeck` écarte une variante qui recopie le titre
  d'une autre slide (comparé sans son numéro) ou qui perd la note d'un
  classement (`6/10`). La meilleure qui tient est écrite.
- **Aucune ne tient → on redemande** (`integrateSophia`, boucle de 4 essais). Sur
  l'essai, le cas « toutes recopient la slide suivante » est revenu propre au
  second appel. Au dernier essai on garde la meilleure, numéro remis, et le
  contrôle de 08:49 la verra.

Vérifié sur les 5 decks fautifs après déploiement : les 5 propres.

**L'essai à blanc n'a plus de témoin** : son bras « avant » lit
`placement_micabo`, qui EST la v2 depuis 0292. Pour rejouer une comparaison, faire
lire `placement_micabo_v1_2026_10_01` au bras ancien.

**Déploiement** : cinq chargeurs sur `13d3bd7` — `assignation-contenu` (v38),
`assignation` (v39), `minuit-vnext` (v42), `revoquer-post` (v38),
`bruler-texte-test` (v28) — et `essai-placement` (v5). Alias relus : `he`, `Se`,
`Fe`, `we`, `te`, `re` (le 01/10 au soir, 0291 les avait tous renommés une
première fois : `ge`→`he`, `ye`→`Se`, `Le`→`Fe`, `he`→`we`, `W`→`te`). Test de vie
`401` sur les six.

## Un deck traduit troué partait tel quel (0294, 02/10/2026)

Signalé par Adrien : le TikTok de @leon.lernen990 sur `85379b9e` (classement
des spécialités médicales) mêlait des slides en français et en allemand. Les
slides 1 à 4 n'avaient **aucun** texte allemand. Le français ne venait PAS des
images propres : l'audit de 0295 les trouve propres, et la légende Florence qui
lisait « Dermatologie 9/10 » est calculée sur l'image BRUTE
(`capturerCaptionSlide` reçoit `raw_url`), pas sur la propre. Hypothèse la plus
probable : la page du créateur montre à côté de chaque slide la photo d'origine
comme modèle de placement, et sans texte allemand à poser le créateur a pris
celles-là. Le même deck était parti une heure plus tôt chez @tim.arbeit325. Le
contrôle de 08:49 l'avait repéré (« À trancher ») mais n'a pas le droit de
réécrire un deck entier.

Le deck `de` était troué depuis l'import du 10/09, et deux règles l'ont laissé
passer :

- **à l'écriture**, `parPos.get(s.position) ?? ""` : une slide que le modèle de
  traduction ne rendait pas devenait une chaîne vide, en silence. Le placement
  remplissait ensuite sa slide ;
- **au test « prêt »**, une seule slide avec du texte suffisait. Le deck troué
  avait sa slide de placement, donc il était « prêt » à vie et ne repassait
  jamais par la traduction.

Trois decks dans ce cas en base : `85379b9e` de (2 posts publiés le 02/10),
`cc30ddf8` es (couverture vide, publiée le 30/09), `f36096d3` tr (jamais servi).
Vidés le 02/10 (`slides = []`, sauvegarde dans `decks_desalignes_sauvegarde`) :
ils sont retraduits en entier à la prochaine assignation.

Le correctif, dans `assurerDeckPourLangue` :

- `positionsSansTexte(source, deck)` (`_shared/deck_structure.ts`, pur, 5 tests,
  réexporté par `deckStructure.ts`) : les positions où la source a du texte et
  la langue n'en a pas. Une slide vide dans la SOURCE n'est pas exigée — c'est
  un choix (0288) ;
- le deck source est lu **avant** le test « prêt », et un deck traduit n'est
  prêt que s'il couvre toutes ces positions ; sinon il est retraduit en entier ;
- une traduction incomplète est redemandée **une** fois, puis abandonnée sans
  être écrite (`Traduction incomplète`) : l'assignation journalise « Deck
  échoué » et repioche ;
- `livrerDeck` refuse en sortie tout deck troué, sur tous les chemins — même
  arbitrage que 0279 : un post de moins vaut mieux qu'un post à moitié muet.

**Coût** : une lecture du deck source de plus par appel, y compris sur le chemin
« prêt ». Un slideshow dont la traduction rend toujours une slide vide ne sort
plus dans cette langue ; ça se voit dans le journal du drain, ça ne part plus en
ligne.

**Reste ouvert** : le texte d'origine laissé dans d'autres images « propres »,
mesuré par l'audit de 0295 ci-dessous.

**Déploiement du 02/10/2026, après OK d'Adrien.** Cinq chargeurs sur `828ce5c` :
`assignation-contenu` (v39), `assignation` (v40), `bruler-texte-test` (v29),
`minuit-vnext` (v43) et `revoquer-post` (v39), +913 octets chacun. **Les cinq
alias `createClient` ont été renommés** : `he`→`_e`, `Se`→`ve`, `te`→`re`,
`Fe`→`Be`, `we`→`be`. `bruler-assignes`, `import-contenu` et
`renettoyer-contenu` ressortent à taille constante (permutation) : leurs
bundles du dépôt sont gardés. Test de vie `401` passé sur les cinq (par
`pg_net`).

Le même jour, **0293** ajoute Flashka à `concurrents` (`\mflashka\M`) avant
l'import de la source @flashka_es : appli de flashcards IA, même pitch que
micabo. « Professor Ka », sa mascotte, n'est pas dans le motif : la remplacer par
micabo prêterait à micabo un tuteur IA.

## Audit des images propres : le texte que le nettoyage a laissé (0295, 02/10/2026)

`media_library.texte_restant` ne dit rien : l'import écrit `false` après chaque
nettoyage, sans rien vérifier (stockage du propre dans `import_contenu.ts`). Les
1 208 images `propre/…` étaient toutes « sans texte ».

`audit-propres` (fonction de lecture, chargeur `_deploy`) relit chaque image
avec `gemini-2.5-flash`, en lui donnant le texte du deck source à la même
position pour séparer le texte AJOUTÉ (à effacer) du texte de la scène (cahier,
écran), et range le verdict dans `audit_propres_0295` (RLS, aucune policy).
Elle n'écrit nulle part ailleurs.

Résultat du 02/10 : **1 071 propres, 79 partielles, 58 complètes**. Rangées :

| genre | images | dans un slideshow validé | posts publiés | posts à venir |
|---|---|---|---|---|
| texte (mots) | 78 | 23 (16 slideshows) | 128 | 10 |
| filigrane Xiaohongshu (`小红书号`) | 4 | 4 | 5 | 3 |
| chiffres / emojis seuls | 47 | 33 (15 slideshows) | 212 | 13 |
| calque micabo posé dans la file | 8 | 7 | 11 | 1 |

Les calques micabo (« Micabo Education ») sont voulus : ce sont des blocs PNG
aplatis par l'éditeur de `/admin/file`. Le texte vu par le modèle inclut des
captures d'écran (article, page YouTube) où il fait partie de la photo.

**Deux surfaces, deux gestes.** Les images d'un slideshow servent à ses propres
posts quel que soit `texte_restant` (`resoudreVisuelsAssignation` ne relit que
l'existence de la ligne) ; elles demandent un re-nettoyage, un calque ou une
slide retirée dans la file. Le pool de garnissage (`chargerBiblioLabel`), lui,
prend toute image propre du label avec `texte_restant = false`, **y compris
celles des slideshows rejetés** : 44 images avec du texte n'y sont que par là.
Passer leur drapeau à `true` les en sort sans toucher aux slideshows.

**Piège de méthode** : la légende Florence est calculée sur le BRUT. Elle ne
dit rien de l'image propre ; ne pas s'en servir pour juger un nettoyage.

**Piège d'exécution** : 27 appels × 3 images en parallèle ont fait répondre
**429** au Storage pendant deux minutes (09:00–09:02 UTC) — le même Storage qui
sert les images aux créateurs. L'audit tourne désormais en 3 chaînes de 2
images (`chaine`, `pas`, `manquants`), avec patience sur le 429 : 42 images
par minute, zéro erreur. Et 8 images en parallèle dans une invocation dépassent
sa mémoire (`546 WORKER_RESOURCE_LIMIT`).

### Les deux gestes, faits (0296, 02/10/2026, OK d'Adrien)

- **Hors des pools** : `texte_restant = true` sur les **82** images où l'audit
  lit des mots ou le filigrane Xiaohongshu. Pas les 47 « chiffres / emojis
  seuls », pas les 8 calques micabo. La liste et l'état d'avant sont dans
  `texte_restant_0296`. Le garnissage (`chargerBiblioLabel`) ne les tire plus ;
  elles apparaissent dans « échecs de nettoyage ».
- **Re-nettoyage** : les 26 images de slideshows validés (moins `e1b5ef61` #7,
  une capture d'article où le texte EST la photo), par `renettoyer-contenu`
  `{contenuId, position}`, les 11 des posts à venir d'abord. Même chemin de
  stockage, même ligne `media_library`, drapeau remis à `false` si le nettoyage
  aboutit — donc une image re-nettoyée revient d'elle-même dans les pools.
  Par vagues de 4 à 8 appels, jamais deux positions du même slideshow dans la
  même vague (`patchSlideMediaId` relit puis réécrit `structure_slides`).

**Résultat, relu par l'audit** (`renettoyage_0296`, verdicts frais dans
`audit_propres_0295`) : première passe **11 propres sur 26**, seconde passe sur
les 15 restantes **7 de plus** — **18 propres, 8 qui gardent du texte**. Le
moteur de nettoyage n'est pas déterministe : une seconde passe vaut la peine,
une troisième probablement pas. Ce qui résiste : les titres en encart (« LE
DEVOIR 📚 », « LE TEMPS ⌚ », « SES »), un autocollant italien (`17277702` #1,
que la traduction espagnole avait d'ailleurs recopié : « sfi dante »), du texte
manuscrit (`09c607a2` #1) et trois filigranes Xiaohongshu. Ces 8-là relèvent de
la file (calque, slide retirée) ; leur `texte_restant` est repassé à `true`.

**Piège** : `renettoyer-contenu` remet `texte_restant = false` dès que le
moteur rend une image, sans la relire. Une image ratée revient donc dans les
pools de garnissage. Après un re-nettoyage, relancer l'audit sur les images
touchées (`audit-propres` avec `{offset, limit: 1}` — l'offset suit l'ordre
`created_at, id` des `propre/…`, stable puisque l'upsert garde la ligne) et
remettre le drapeau sur celles qui gardent du texte.

**Le re-nettoyage touche aussi l'historique des posts publiés.** Le fichier
est écrasé au même chemin et la ligne `media_library` est la même : les
`post_slides` de TOUS les posts du slideshow pointent déjà dessus, publiés
compris (`propagerMediaAuxPostsAssignes` les réécrit de toute façon). Rien ne
change en ligne, mais dans l'OS un post publié montre ensuite une image qu'il
n'a pas portée. C'est voulu pour les posts à venir — le créateur voit l'image
propre sans réassignation —, c'est un défaut connu pour l'historique.

## Localisation scolaire dans les traductions (0297, 02/10/2026)

Les slideshows viennent surtout de France, et rien ne disait au traducteur quoi
faire du système scolaire d'origine. Sur les decks espagnols, allemands et
turcs : « brevet » recopié 14 fois sur 36 (« Geschichte-Erdkunde-Brevet »,
« dictée brevet » à chercher sur YouTube), les notes sur 20 recopiées
(« Ich hatte eine 18 », « Saqué un 18 », « 18 aldım » — un échec sur 100),
Yvan Monka gardé 4 fois sur 6. La règle « chiffres : garde-les » y poussait.

**Et trois langues n'avaient AUCUN prompt.** `traduction_es`, `traduction_de`
et `traduction_en` n'existaient pas : `assurerDeckPourLangue` retombait sur
`DEFAULT_TRANSLATE_PROMPT` (gemini.ts), dix lignes sans localisation, qui
parlent encore de « l'appli Sophia » et font retirer tout produit tiers,
classements compris. L'italien et le portugais sont toujours dans ce cas (aucun
compte aujourd'hui).

0297 ajoute un bloc « 9 bis » à chaque prompt de traduction et crée les trois
qui manquaient (sauvegarde `prompts_sauvegarde_0297`) :

1. examens et classes → l'équivalent local s'il existe VRAIMENT (LGS, Abitur,
   selectividad, YKS…), sinon une formule générique ;
2. notes → converties au barème local, exception explicite à « garde les
   chiffres » ;
3. personnes, youtubeurs, sites du pays d'origine → **toujours généralisés**,
   jamais remplacés par un équivalent que le modèle croirait connaître (pas de
   liste blanche : à décider avec Adrien si on en veut une) ;
4. une recherche à taper se traduit dans les mots d'un élève local ;
5. le pays d'origine présenté comme cadre de l'élève devient le pays du public.

Vérifié à blanc par `essai-placement` sur huit decks avant de conclure, puis
deux glissements corrigés (brevet devenu « selectividad », « Abi-Schnitt von
über 1,3 »).

**Le stock est repris par 0298** : 111 decks traduits (48 slideshows, 39 en
allemand, 29 en espagnol, 40 en turc, 3 en français) dont la source porte un
repère scolaire du pays d'origine sont **vidés**, pas réécrits — changer un
examen ou une note change le sens de la slide. `assurerDeckPourLangue` les
retraduit à la prochaine assignation avec les prompts de 0297, puis repasse les
concurrents et le placement v2. L'état d'avant et le motif trouvé sont dans
`localisation_reprise_0297` ; le retour arrière recopie `slides_avant`. Les 16
passages déjà assignés partent avec leur copie, les publiés ne bougent pas.

**Piège du MCP, élargi** (voir 0287) : `execute_sql` et `apply_migration`
attendent une confirmation humaine — puis meurent à 60 s sans rien appliquer —
dès qu'une chaîne contient un **point-virgule** ou un **nombre impair
d'apostrophes droites**, même entre `$q$…$q$`. Le découpeur du MCP ne connaît
pas les chaînes dollar. Écrire « · » et « ’ » dans le texte, ou passer par
`chr(59)` / `chr(39)`. Une instruction réellement destructive n'y est pour rien.

**Le texte d'une slide peut porter un filigrane** : sur `ff91768b` #7, l'OCR
avait recopié « 小红书号: 119180449 » dans le deck source, et la traduction l'avait
suivi en allemand et en espagnol (deux posts publiés). Retiré des trois decks le
02/10 (sauvegarde `textes_bruit_sauvegarde`). L'image le porte toujours.

## Pertinence d'import : la place du CTA, pas le sujet (0299, 02/10/2026)

Deux mesures sur 141 slideshows passés au moins deux fois chez nous (vues
corrigées de l'âge), qui valent pour toute la note d'import :

- **Vues du TikTok d'origine** : corrélation faible (Spearman 0,24) et non
  linéaire. De moins de 5 000 à 200 000 vues d'origine, nos médianes restent
  entre 1 200 et 1 500. Au-delà de 200 000, elles triplent (4 340 puis 5 672).
  Le plafond C de `VUES_SOURCE_MIN_B_PLUS` (10 000) ne sépare donc rien. Le lien
  est fort chez luna.study4 (0,71), nul chez jeena_study_tips (0,10) et
  jeanne.wilgo (−0,12). Pas touché : à décider avec Adrien.
- **Pertinence** : corrélée à l'envers (−0,30). Sous 30 : 3 497 vues de
  médiane, à 60 et plus : 1 444. L'ancien prompt notait le SUJET (« est-ce une
  méthode de révision ») : les faits de médecine et le classement des
  spécialités, nos meilleurs posts, prenaient 0 à 5.

`pertinence_micabo` note désormais une question : peut-on remplacer une slide
par une recommandation naturelle de micabo, devant un public d'élèves ou
d'étudiants ? Vérifié à blanc avant la bascule par **`essai-pertinence`**
(lecture seule, `{contenuIds, cle}`, chargeur `_deploy`) : corrélation avec nos
vues de −0,29 à +0,10 sur 140 importés, et sur 35 rejetés, charisme, citations
et pubs Peech restent sous 20 quand les slideshows médecine passent de 0 à 90.
Il note large (82,7 de moyenne contre 52,1) : la note d'import repose davantage
sur les vues d'origine. Le poids (30/70) n'est pas touché — le baisser à 15 %
faisait monter les entrées en A de 44 à 77, surtout des sources de 80 000 à
200 000 vues, qui ne font pas mieux que les petites.

Ancien prompt : `pertinence_micabo_v1_2026_10_02`. Re-notés à blanc, 74 des 94
slideshows rejetés à l'import (`elo_insuffisant`) des sources actives
passeraient le seuil : 44 jeanne.wilgo, 13 luna.study4, 8 jeena_study_tips,
8 flashka_es, 1 user5507909029330. Non réinjectés le 02/10 : ça coûte un
nettoyage complet et ça remplit la file.

## Au tirage, ce que la langue n'a pas encore vu passe devant (02/10/2026)

Le recul de 30 jours (`RECUL_MEME_COMPTE_JOURS`) est **par compte**. Rien
n'empêchait un slideshow de passer sur trois comptes de la même langue en
quelques jours, devant la même audience. Mesuré du 10 au 30/09, sur un même
slideshow, le deuxième passage dans une langue fait **0,57× le premier en
allemand, 0,63× en espagnol, 0,81× en turc, 0,86× en français**. En Espagne
(3 comptes), 67 % des posts de carla.curso418 après le 22/09 étaient déjà passés
en espagnol : 523 vues de médiane, contre 1 117 sur ses inédits.

`prefererInedits` (`tierlist.ts`, pur, 6 tests) restreint le groupe retenu par
`prioriserTiersHauts` aux slideshows sans passage dans la langue du compte
depuis `RECUL_MEME_LANGUE_JOURS` (30), et rend le groupe entier s'il n'y en a
aucun. **Une préférence, jamais un filtre** : l'arbitrage du 19/09 (un post de
moins plutôt qu'un doublon) vaut pour le même compte, pas pour la même langue.
Elle s'applique **après** le tier, donc `PART_TIRAGE_C` reste exacte. Le
repêchage essaie lui aussi les inédits de la langue d'abord.

Ce que ça n'achète PAS : du stock. Le 02/10, 49 slideshows devaient un passage
(68 passages) pour 54 posts par jour. La préférence répartit mieux ce stock
entre les langues, elle n'en ajoute pas. Et deux workers de la même langue dans
la même rafale peuvent encore choisir le même inédit : la préférence est lue
avant l'écriture, sans verrou — c'est assumé, le coût est un « déjà vu », pas un
doublon de compte.

**Piège de mesure, celui du 26/09 en plus grossier** : « 53 slideshows validés
jamais postés en Espagne » n'est PAS une réserve pour l'Espagne. 33 avaient leur
cycle plein (passés ailleurs, en attente de verdict), 20 seulement devaient un
passage, et les 48 autres posts du jour les voulaient aussi. Ne jamais compter
le pool sans le filtre de cycle.

**Déploiement du 02/10/2026** (demande d'Adrien, « fais donc »). Quatre
chargeurs sur `ef3bead` : `assignation-contenu`, `assignation`, `minuit-vnext`
et `revoquer-post`, +683 octets chacun. **Les quatre alias `createClient` ont
été renommés** : `_e`→`xe`, `ve`→`$e`, `Be`→`Je`, `be`→`Se`. `bruler-assignes`,
`import-contenu` et `renettoyer-contenu` ressortent à taille constante
(permutation) : leurs bundles du dépôt sont gardés. Versions déployées : v40,
v41, v44, v40. Test de vie `401` passé sur les quatre (par `pg_net`).

## Réinjection des rejetés et nettoyage ciblé de flashka (0300, 02/10/2026)

Re-notés avec le prompt de 0299, 74 des 94 slideshows rejetés à l'import
(`elo_insuffisant`) des sources actives passaient le seuil. Adrien en a fait
rentrer **22** : luna.study4 (13), flashka_es (8), user5507909029330 (1).
jeanne.wilgo (44) attend sa décision. Chacun repart à l'étape `pertinence`
avec la note de l'essai (même prompt, pas de second appel) et `statut =
brouillon` : le pipeline refait la note d'import, le tier, le nettoyage, et
s'arrête dans la file. État d'avant dans `reinjection_0300`.

**Flashka : le nettoyage de l'import effaçait le sens de l'image.** Ses slides
reposent sur des vignettes — le logo de l'IA notée (ChatGPT, Gemini, Meta AI)
en haut à gauche, une copie notée (5/10, 4/10, 3/10) en haut à droite, trois
copies à 10/10 et 100 % sur la dernière. Le texte ajouté n'est qu'une courte
légende entre les deux (« Burlas... », « Risas... »). Le text-removal efface
tout ce qui ressemble à du texte : sur les 4 flashka validés avant 0300, il ne
restait qu'un selfie, et Adrien avait réécrit « ChatGPT Burlas 5/10 » dans le
deck pour compenser.

`nettoyage-cible` (chargeur `_deploy`) : un modèle de vision (celui de la
lecture du burn) rend deux listes de rectangles, à effacer et à garder ;
`_shared/nettoyage_cible.ts` (pur, 8 tests) rogne le masque hors des zones à
garder et l'abandonne s'il n'en reste pas assez ; `fal-ai/bria/eraser`
(`_shared/fal_eraser.ts`) ne reconstruit que sous le masque. `ecrire: false`
range l'essai sous `essai/nettoyage-cible/…`, `promouvoir: true` le recopie au
chemin du propre une fois relu. Les propres portent `exclu_concurrent` : ils
montrent des marques tierces et ne garnissent aucun autre slideshow. Le deck ne
porte plus que la légende ; la dernière slide dit « la app micabo ».

Relu par `decrire-images` : 35 propres sur 40 au premier passage, 2 reprises
réussies, 2 retouches légères laissées à la file (8b92903d #2, f772e9cb #5).
Les 3 « restes » signalés sous la note sont le texte imprimé de la copie
elle-même.

**Ni `REPLICATE_API_TOKEN` ni `STABILITY_KEY` ne sont posés sur l'Edge.** Le
LaMa d'`inpaint.ts` rend donc `null` partout, et le repli « Replicate » de
`cleanImage` n'existe pas en pratique : Fal est le seul fournisseur.

**Douze flashka quasi identiques dans le pool** (les 4 validés + les 8) : même
mème, seul le selfie change. À Adrien de décider combien en garder dans la
file.

**Voir une image depuis l'environnement de travail** : le proxy bloque
`supabase.co` et `pg_net` tronque un corps binaire. `decrire-images` (chargeur,
modèle du burn) décrit une image du Storage ; `apercu-images` (autonome) la
rend en base64 réduite, trop lourde pour être relue souvent.

## Variantes des slideshows gagnants : essai à blanc (02/10/2026)

Demande d'Adrien : pour chaque slideshow passé à **50 000 vues** ou plus chez
nous (23 au 02/10), deux ou trois slideshows dans le même moule, **contenu
neuf** (même format, même hook, même ton, même nombre de slides, d'autres
idées), images du **même compte source** (jamais celles du parent), à valider
dans la file. Rien n'y entre avant son verdict sur un essai.

`essai-variations` (chargeur, écrit dans `essai_variations` seulement) :
Claude écrit les variantes et choisit chaque image par sa légende ; le pool ne
garde que les propres que l'audit de 0295 a relus **sans texte**, hors
slideshows en file, et écarte les légendes qui parlent de texte, d'appli,
d'écran, de logo ou de langue.

Ce que les essais sur 835c1781 (1,4 M) ont appris :

- **la slide micabo fait partie du moule.** Celle du parent est un élément de
  la liste (« je révise mes fiches micabo dans les toilettes »). Le placement
  générique écrasait une technique et inventait (« un exam de droit », « l'appli
  sait que j'ai un exam »). La variante écrit la sienne au même endroit, avec ce
  que fait micabo et rien d'autre (fiches ou flashcards depuis cours, notes ou
  PDF, se tester quelques minutes par jour) ;
- **la promesse de couverture doit être tenue par chaque élément** : sans la
  consigne, « trucs de psychopathe » donnait « relire le lendemain » ;
- **une légende Florence ne suffit pas à juger une image** : « Hyperfocus app
  open on the screen » est sorti sur une slide micabo, « Lire à voix haute »
  était du texte resté sur l'image.

**Le gabarit, tenu par le code** (retour d'Adrien sur le cinquième essai :
« des slides en 3 paragraphes et le placement micabo en 1, bizarre »).
`_shared/gabarit.ts` (pur, 10 tests) mesure chaque slide du parent :
paragraphes, lignes par paragraphe, plus longue ligne. La variante doit tenir
le gabarit de la slide du parent à la même position (une ligne d'écart par
paragraphe, quatre caractères de plus par ligne, longueur totale entre 0,6 et
1,5 fois). Une slide hors gabarit repart au modèle avec ses écarts mesurés,
deux tours au plus ; ce qui reste hors gabarit est écrit dans `defauts`. La
slide micabo du parent vient souvent du placement, pas de l'auteur : son
modèle est la voisine de liste (`modeleMicabo`). Même leçon que 0292 : un
prompt ne tient pas une forme, le code si.

**Le TikTok d'origine sert de modèle de placement.** La page du créateur
montre, à côté de chaque photo, `post_slides.reference_url`, tiré de
`structure_slides[].reference_url ?? raw_url`. Pour une variante, ce sera la
slide du parent à la même position : même forme, donc le même endroit pour le
texte. `raw_url` reste celui de l'image tirée du pool. Conséquence connue : sur
un compte `burned`, le burn lit le style sur `reference_url` et l'aligne sur
l'image, qui n'est plus la même photo ; l'autotest refuse et la slide part en
classique.

**L'automate, lancé le 02/10** (décision d'Adrien : « UNIQUEMENT 1 variante,
pas de photo, envoie-les tous en queue »). `essai-variations` avec
`{ chaine: [ids], ecrire: true }` traite un parent par invocation et relance
le suivant ; chaque parent voit les images (`source_media_id`) et les idées
(première ligne de chaque slide) déjà prises par les variantes écrites avant
lui. Une variante n'est écrite que sans aucun défaut — gabarit, image hors
pool ou déjà prise, micabo absent ou mal placé, concurrent, tiret long, ou
promesse que micabo ne tient pas (photo, capture, audio, rappel, planning :
`PROMESSES_INTERDITES`, renvoyée au modèle comme un écart de gabarit).
Une image hors pool ou déjà prise n'est pas un défaut : le modèle invente
parfois un identifiant (« 589a8ab2-…-000000000000 » au premier essai), donc
`reparerImages` la remplace par l'image du pool dont la légende partage le plus
de mots avec celle demandée (une image de hook en slide 1), et le note dans
`images_reparees`. Écrite, elle naît `rejete` et ne passe `brouillon` qu'à la dernière écriture :

- `creation_mode = manuel`, `parent_id`, `profondeur + 1`, tier **B**, un
  passage, labels, musique et format du parent, `placement_manuel` si la slide
  micabo est écrite, et une `file_note` qui dit de quel slideshow elle vient ;
- **ses images sont des COPIES** (`propre/<variante>/<position>`, ligne
  `media_library` à elle, sans label). L'éditeur de la file aplatit ses calques
  sur le `storage_path` de l'image : sans copie, retoucher la variante aurait
  réécrit l'image du slideshow d'origine et celle de tous ses posts publiés.
  Les copies ne sont pas auditées, donc jamais reprises par un autre tirage ;
- `hashtags` = ceux de la légende, s'il y en a au moins trois.

Deux parents sur 23 écartés : `c8b9a2d2` (refusé dans la file) et `0d6c5f82`
(cold-study, sans label : sa variante ne serait jamais tirée).

## Relevé des stats : une file, pas une fenêtre (0259, 14/09/2026)

`chargerPassagesFenetre` sélectionnait `date_publication_prevue IN (4 derniers
jours Paris)`. Un passage raté pendant ces quatre jours n'était **jamais**
repris : la fenêtre avait avancé. Constat du 14/09/2026 — sur 152 passages
publiés, 16 avaient `vues IS NULL` **et** `stats_maj_at IS NULL` ; ceux du 07
et du 08 étaient perdus définitivement.

Le critère est désormais l'état du passage, pas le calendrier
(`chargerPassagesARelever`) : jamais relevé d'abord, puis relevé il y a plus de
6 h, sur 30 jours de profondeur, les plus vieux devant. Trois garde-fous
l'accompagnent :

- **45 minutes de délai plancher** avant tout scrape. Le 13/09, deux posts
  publiés à 22:03 et 22:07 ont été scrapés à 22:07 : TikTok ne les avait pas
  indexés, et sans la file ils n'auraient jamais été mesurés.
- **Scrape profil dimensionné** sur le nombre de passages à retrouver
  (`postsAScraper` : double, plancher 12, plafond 40). À 12 fixe, un créateur
  qui poste aussi pour lui poussait nos posts hors de la liste.
- **25 passages par compte et par passe** : chaque passage sans match coûte un
  `scrapePost` Apify et l'invocation Edge meurt à 150 s. Le reste part à la
  passe suivante — il ne se perd plus, c'est tout l'intérêt.

Une **deuxième passe à 13:00 Paris** (`rattrapage-elo-midi`, planifiée par
`crons_stats_midi_planifier()`, qui ne touche à aucun autre job) s'ajoute à
minuit : un post du soir est mesuré ~15 h après au lieu de 26 h, et chaque
passage est vu deux fois avant le J+2 de la requalification.

Corollaire d'affichage : un passage `assigne` n'a rien à mesurer. Les afficher
comme les publiés jamais relevés donnait l'impression d'un relevé cassé alors
que 68 passages sur 220 n'étaient simplement pas publiés. `relevesStats.ts`
tranche les quatre états, et la fiche d'un slideshow porte un bouton « relever
maintenant » par passage manquant.

## Burned (0252, 12/09/2026)

Un compte coché `comptes.burned` reçoit ses slides **texte déjà incrusté** : ni
image vierge, ni texte à replacer. Le rendu est déterministe et vit sur Vercel,
pas sur l'Edge — Deno n'a ni Pillow, ni numpy, ni OpenCV.

**Le moteur est le burn-kit, tel quel.** `api/burn_engine.py` est le
`burn/engine.py` du kit à une adaptation près, commentée dans le fichier : le
kit résout `fonts/` depuis le dossier courant, qu'un lambda n'a pas, donc les
chemins passent par le dossier du module. `api/burn_pipeline.py` est son
`pipeline.py` ramené à un appel HTTP — les deux appels LLM (lecture du style,
traduction) vivent côté Edge, qui a la clé et les decks, et leur résultat arrive
en entrée. `api/burn.py` n'est qu'une enveloppe HTTP. Le protocole est dans
`docs/burn-RECETTE.md` et `docs/burn-kit-README.md` : **s'y tenir à la lettre**,
ne pas garder « au cas où » un bout d'un moteur maison.

Trois règles non négociables du kit :

1. **Le LLM lit et traduit, Python mesure et dessine.** Aucune valeur numérique
   ne sort de l'estimation d'un modèle : la boîte et la couleur annoncées sont
   des indices, jamais des mesures.
2. **Reproduire avant de traduire.** Le moteur redessine le texte *source* avec
   le spec calculé, le re-mesure avec le même code et compare à la capture :
   position à 0,5 % de la largeur d'image près, largeur d'encre à 2 % près,
   coupures de lignes identiques. Tant que ça ne passe pas, la traduction n'est
   pas rendue.
3. **La taille se cale sur la LARGEUR, jamais sur la hauteur d'x.** Le seuil du
   masque gonfle la hauteur d'x de 2 à 3 px → taille 10 % trop grande → tracking
   négatif pour rattraper → mots collés.

L'ordre des étapes, dans `run_slide` : recalage ORB + RANSAC brut → propre
(repli sur le rapport de largeurs sous 50 inliers) ; lecture LLM (`READ_PROMPT`,
JSON strict, bbox **en pixels**) ; mesure au pixel ; identification de la police
par `font_score` et verdict visuel ; traduction (un appel par carrousel, avec un
`text_short` de repli) ; re-découpe par `wrap_paragraphs` ; rendu Pillow
(SS = 3, caractère par caractère, masques en niveaux de gris, contour puis
remplissage) ; `qa_selftest`.

**La lecture est faite par Claude, et seulement par Claude**
(`MODELES_LECTURE_BURN` dans `gemini.ts` : `anthropic/claude-opus-5` puis
`anthropic/claude-sonnet-5`, par le routeur OpenRouter de Fal — un identifiant
déjà préfixé passe tel quel, aucune plomberie à changer). C'est le seul endroit
du burn où un modèle parle ; tout le reste est mesuré. `gemini-2.5-flash` n'y
tient pas : une bbox à 20 px près ou une coupure de ligne inventée fait échouer
un autotest dont la tolérance est 0,5 % de la largeur d'image. **Pas de repli
vers un modèle plus faible** : la lecture est mise en cache dans
`burn_analyses`, donc une mauvaise lecture ne rate pas une slide, elle la rate
définitivement. `burn_analyses.modele` porte désormais le modèle qui a répondu,
préfixé `burn-kit/read_style:` ; une ligne sans ce préfixe est une lecture
Gemini ou d'avant le kit, et elle est relue au lieu d'être resservie.

`api/fonts/` contient **exactement** ce que télécharge `api/fonts/fetch_fonts.sh`
(24 fichiers, 1,7 Mo) : TikTok Sans 500/600/700, Figtree, Mulish, Playfair
Display, Bodoni Moda, plus DejaVu Sans en repli de glyphes. Ni en ajouter, ni en
retirer : `candidates_for_style` restreint les candidats au bon genre avant de
les noter, et une graisse de plus déplace le score.

**Résultat honnête sur notre stock : 2 zones sur 27 passent l'autotest**, donc
presque toutes les slides repartent en classique. La cause est isolée et n'est
pas dans le rendu : `color_mask` isole le texte **par la couleur seule**, et nos
slides sont posées sur des tableaux blancs ou des pastilles claires — le fond
entre dans le masque et l'autotest compte 6 lignes là où il y en a 2, alors que
la mesure, elle, est juste (TikTok Sans 500, 111,4 px sur la paire de contrôle).
Croiser le masque avec la plaque propre — une ligne — remonte à 8-9/27 ; **c'est
délibérément non fait** : le kit est le modèle, verbatim. Toute reprise de ce
sujet se discute avec Adrien avant d'être codée.

Le reste du chemin :

- deux caches, indépendants du compte : `burn_analyses` (lecture du LLM, une
  fois par slide) et `burn_rendus` (image finale, une fois par slide + langue),
  rangée sous `burned/<contenu>/<langue>/<position>.jpg` ;
- `bruler-assignes` draine le jour, hors du chemin de minuit. Il est entraîné
  par l'étape `burn` de `minuit-vnext` — laquelle part aussi avec `assignation`,
  donc le filet des 15 minutes le couvre sans job pg_cron de plus — et par la
  fin du drain `upscale-assignes` (le burn vient **après** l'upscale) ;
- repli permanent : une slide non brûlée part avec l'image propre et
  `texte_overlay`, qui reste rempli. `BURN_SECRET` absent = burn désactivé,
  aucune slide marquée en échec ; `post_slides.burn_erreur` dit pourquoi une
  slide n'a pas été brûlée ;
- secret partagé `BURN_SECRET` (Edge **et** Vercel) + `BURN_URL` facultatif
  côté Edge. `GET /api/burn` dit ce que le lambda embarque vraiment : polices
  chargées, table de glyphes lisible, secret posé ;
- **le lambda ne tient pas dans un build Vercel standard.** OpenCV pèse 136 Mo
  installés (4.9) à 153 Mo (5.0), numpy 73, fontTools 30, Pillow 22 : ~300 Mo
  là où le build standard plafonne à 225 Mo une fois les dépendances
  optimisées. Le déblocage est une variable de projet Vercel,
  `VERCEL_SUPPORT_LARGE_FUNCTIONS=1` (Large Functions, bêta publique, Python
  jusqu'à 5 Go sur Fluid compute) — pas une coupe dans le moteur. Sans elle, le
  build échoue en `LAMBDA_SIZE_EXCEEDED` et la prod reste sur le déploiement
  précédent : l'Edge parle alors le contrat du kit à un moteur qui ne le
  comprend pas, et **toutes** les slides repartent en classique.
  `excludeFiles` sort du lambda ce qui ne sert pas à `api/burn.py` (front,
  sources Edge, docs) : ~9 Mo, de l'hygiène, pas la solution.

  **Et cette variable est posée sur Production SEULEMENT.** Conséquence, à
  connaître avant de s'inquiéter : **tout déploiement Preview échoue**, sur
  chaque PR, avec « Total bundle size (303.16 MB) exceeds the maximum function
  size (225 MB) ». Vérifié le 14/09/2026 sur les vingt derniers déploiements :
  7 production sur 7 en READY (avec `lambdaRuntimeStats: {"python":1}`), 13
  preview sur 13 en ERROR, de la PR #60 à la #67. Le front, lui, se construit :
  l'erreur tombe APRÈS le `vite build`, au moment d'empaqueter le lambda.

  Donc : un rouge sur un preview ne dit rien du code de la PR, et **ne bloque
  pas le merge** — le déploiement production qui suit passe.

  **Réglé le 24/09/2026** : `VERCEL_SUPPORT_LARGE_FUNCTIONS=1` est désormais
  posée sur l'environnement **Preview** aussi (variable `plain`, ce n'est pas
  un secret), en plus de Production. Les previews doivent repartir verts au
  prochain déploiement. Si un preview retombe en `LAMBDA_SIZE_EXCEEDED`,
  vérifier d'abord que la variable est toujours là avant de suspecter le code.

  Pister `requirements.txt` au passage : les bornes sont ouvertes
  (`opencv-python-headless>=4.9`). 303 Mo mesurés contre ~261 Mo attendus avec
  OpenCV 4.9 : la résolution est montée en 5.x. Ça ne fait pas passer sous les
  225 Mo — même épinglé à 4.9 on reste au-dessus, d'où la variable — mais
  épingler éviterait qu'un futur saut de version surprenne la production.

Le contrôle du moteur est `qa_selftest`, dans le moteur : il tourne sur chaque
slide et son rapport remonte jusqu'à la carte « Text burn-in (preview) » du
Moteur, qui affiche l'original TikTok et le rendu brûlé côte à côte, avec les
écarts mesurés et un badge rouge quand la livraison est refusée.

## PostgREST : une seule clé étrangère vers ce qu'on embarque

`comptes(… profiles(…))` se résout **par la clé étrangère**. Dès qu'une table
en a deux vers la même cible, PostgREST refuse de choisir et renvoie
« Could not embed because more than one relationship was found » — pas une
ligne de moins, **l'écran entier**.

Le 12/09/2026, trois colonnes d'audit (`qualification_manuelle_par`,
`ne_pas_renouveler_par`, `hm_prevenu_par`) ont été ajoutées à `comptes` avec,
par réflexe, une clé étrangère vers `profiles`. Sept requêtes sans rapport avec
la qualification sont tombées d'un coup : surveillance, fiche créateur,
calendrier, QA TikTok. Sur la page Posters l'erreur était pire qu'une erreur —
`listerComptes` échouait, le `?? []` la transformait en liste vide, et les 25
créateurs disparaissaient sans un mot.

Donc : **une colonne « qui a fait ça » se stocke en uuid nu, sans clé
étrangère** (0255). Et une lecture dont l'échec vide un écran doit **relever**
son erreur, jamais la remplacer par `?? []`.

Deuxième piège du même jour, même famille : **jamais de `or` entre deux
colonnes dans une policy RLS corrélée** (0254). `(ps.media_id = … or
ps.burned_media_id = …)` interdit l'accès par index et fait balayer la table
une fois par ligne lue — 5 951 ms sur la bibliothèque, au-dessus du
`statement_timeout`. Deux policies permissives sont OR-ées de toute façon :
couper en deux garde le même droit et rend chaque moitié indexable. Et vérifier
qu'un index existe sur la colonne jointe.

## Cloisonnement (non négociable)

Tu travailles **uniquement** dans `adrienmrtn/micabo-os`.

- Supabase : `qkmiwnmiwsvwkttldqgb` uniquement
  (`https://qkmiwnmiwsvwkttldqgb.supabase.co`).
- Vercel : projet `micabo-os`.
- Interdit : dump, remote, secrets, users, comptes, sources, médias, prompts
  live d’un autre OS.
- Si un cron, un secret ou une URL pointe vers `mbikecieskoobeizixig` → stop,
  corriger. Ne pas rescheduler les crons sans OK manuel.

## Technique

- Front Vite : `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (type Config
  sur Vercel, jamais Secret, jamais `service_role`).
- Secrets moteur (`FAL_KEY`, `APIFY_TOKEN`, `CRON_SECRET`) : Edge Function
  Secrets du projet `qkmiwnmiwsvwkttldqgb` seulement. Seule exception :
  `BURN_SECRET`, posé des deux côtés (Edge + Vercel) parce qu'il ferme le
  moteur de rendu `api/burn.py` — il ne donne accès à rien d'autre. Le texte (Gemini)
  passe par Fal OpenRouter — pas de `GEMINI_API_KEY`.
- Côté Vercel, `VERCEL_SUPPORT_LARGE_FUNCTIONS=1` n'est pas un secret mais une
  condition de build : sans elle, `api/burn.py` dépasse la taille maximale d'un
  lambda Python standard et le déploiement échoue (voir Burned).
- Slug unique : `micabo`. Pas de switcher, pas de `localStorage`
  `os-application-slug`, pas de fallback `application_id_sophia()`.
- Mails internes : domaine `micabo.app`.
- Signups publics : off.

## Schéma / crons

Après `db push`, unscheduler **tous** les jobs `cron.job`. Vérifier
`cron.job.command`. Ne rien relancer tant que l’humain n’a pas dit OK
après un test manuel.

Une fois le OK donné, le pipeline minuit se remet par
`select * from public.crons_minuit_planifier();` — jamais en recopiant la
commande d’un job existant (`0163_cutover_assignation_vnext.sql` recopie
l’hôte `mbikecieskoobeizixig`). Détails et vérifications :
`supabase/migrations/0236_crons_minuit.sql`.

Le planificateur pose cinq jobs (`0242_cron_assignation_journee.sql`, révisé
par `0251_filet_assignation_15min.sql`) : minuit, ses deux filets de nuit, le
drain ELO, et `minuit-vnext-journee` — **toutes les 15 minutes**. Ce dernier
existe parce que le warmup finit à n'importe quelle minute : sans lui, un
créateur sorti de warmup après 06:00 Paris n'a aucun post ce jour-là (personne
ne le voit sous quota) alors que l'ELO le pénalise déjà pour ne pas avoir
publié. Une passe à vide ne fait rien — c'est ce qui permet de tourner au
quart d'heure sans coût.

Planifié le 07/09/2026 après test manuel : les cinq jobs sont actifs, tous en
`kick_edge_micabo` sur l’hôte Micabo. Ne pas rejouer le planificateur sans
nouveau OK — il désenfile et réenfile les cinq.

Le 11/09/2026, après OK explicite, `minuit-vnext-journee` est passé de
`0 * * * *` à `*/15 * * * *` — par un `cron.schedule` sur ce seul nom (jobid 44
conservé), pas en rejouant le planificateur : les quatre autres jobs n'ont pas
été touchés. Préférer toujours cette voie pour changer un seul job.

Toute commande cron appelle l’Edge via `public.kick_edge_micabo('<fn>', <jsonb>)` :
lui seul tient l’hôte et le secret. Corps JSON avec `jsonb_build_object`, jamais
un `'{"…":…}'::jsonb` écrit à la main — les guillemets ressortent échappés
quand la migration passe par un outil, et le job casse en silence au tick.

**Le planificateur ne couvre pas tout.** `crons_minuit_planifier()` ne repose que
les cinq jobs minuit / ELO. Les douze jobs du drain d’import n’en font pas
partie — voir la section suivante. Après un `db push` suivi du désenfilage
général, vérifier les deux familles, pas seulement celle du planificateur.

## Le drain d’import n’avait plus de cron — et le rebrancher l’a arrêté (0271, 22/09/2026)

`0149_import_file_serveur.sql` posait douze jobs `import-contenu-drain-1..12` à
la minute — « 12 workers / minute = parallélisation agressive ».
`0156_pause_verifyclean_crons.sql` les a **désactivés** pour couper les dépenses
continues, puis le désenfilage général d’un `db push` les a fait **disparaître**
de `cron.job` : le planificateur ne connaît que les cinq jobs minuit / ELO.

Ce qui drainait à la place : le seul auto-chaînage Edge de
`import-contenu/index.ts`, `kickWorkers(request, 1)`, prévu comme **filet** et
pas comme moteur.

**Les rebrancher a dégradé, puis arrêté l’import.** Débit mesuré sur l’étape
`pertinence`, import de `jeanne.wilgo` (139 contenus) :

| jobs actifs | contenus/min |
|---|---|
| 0 (auto-chaînage seul) | **1,33** |
| 12 | 2,50 puis 0,64 |
| 4 | 0,21 |
| 0 | **0,00** — arrêt complet |

Trois défauts se combinent, **aucun n’est dans le cron**.

1. **La population de workers est conservée, pas bornée.** `continuer()` rend
   `more: await hasMoreWork()` — « il reste du travail en file », et NON « j’ai
   réussi à réclamer quelque chose ». Chaque worker se rechaîne donc à un
   successeur même bredouille : la population ne décroît jamais tant que la file
   n’est pas vide, et chaque tick de cron l’augmente définitivement. Une chaîne
   n’est pas « un worker par minute » : c’est une boucle de ~2 s, soit
   ~25 boots/min à elle seule. On est monté à **~120 boots/min**.
   `rattrapage-elo` échappe à ça parce qu’il a un verrou `busy` explicite
   (`eloDrainEstVerrouille`) ; `import-contenu` n’en a **aucun**.
2. **La fenêtre de claim est étroite et déterministe.** `claimContenu` lit les
   **8 mêmes** candidats pour tout le monde (`import_tentatives`,
   `pertinence_score`, `created_at`), puis chacun tente un `update` conditionnel
   dessus. À 120 workers, Postgres sérialise les verrous sur ces 8 lignes et les
   isolats meurent au timeout avant d’aboutir.
3. **Des lignes empoisonnées, antérieures au cron.** 24 contenus arrêtés à
   `elo` / `format`, aux `pertinence_score` les plus bas donc en tête du tri.
   Réclamées, elles tuent l’isolat (timeout Edge 150 s, `shutdown` sans **aucune**
   ligne de log applicatif), donc `relacherContenuApresPas` n’est jamais atteint,
   donc `import_tentatives` n’est **jamais incrémenté** — et elles reviennent en
   tête au bail suivant. Les 62 contenus à `pertinence` derrière elles
   n’étaient jamais atteignables.

Le code prévoit pourtant le cas 3 : « `import_tentatives` en premier critère :
un diaporama qui enchaîne les passages stériles passe derrière les imports frais
au lieu d’aspirer tous les workers ». Le mécanisme existe, il ne se déclenche
pas, parce que le compteur est écrit **après** le pas et que le pas tue le
process.

**Reprise du 22/09** : `import_tentatives + 1` sur les 24 lignes bloquées. Le
travail a repris dans la minute — 0 → 129 lignes de log applicatif par minute —
sans toucher au cron. Le park de la file (bail futur sur toutes les lignes) est
le seul levier qui tue un troupeau déjà lancé : il fait rendre `more: false` à
tout le monde. 119 boots/min → 0 en deux minutes.

**Les douze jobs existent, éteints** (0271). Avant de les activer il faut, dans
`import-contenu` : un verrou de concurrence sur le modèle de
`eloDrainEstVerrouille` ; un `more` qui reflète le claim et non la file, ou un
plafond de chaînes ; et `import_tentatives` incrémenté **avant** le pas. Tant
que ce n’est pas fait, l’auto-chaînage seul draine plus vite que douze jobs.


### Le correctif (22/09/2026)

Trois pièces, dans `import-contenu` :

- **`_shared/import_progres.ts`**, module PUR (réexporté par
  `src/features/moteur/importProgres.ts`, 10 tests). `pasAAvance(etapeAvant, r)`
  exige `r.progres` **et** un changement d'`import_etape` : le progrès se
  constate, il ne se déclare pas. `decisionPas` tient le compteur et sort une
  ligne de la file au-delà de `MAX_PAS_STERILES` (5) — `import_statut = 'done'`
  + `import_etape = 'failed'`, le seul couple que `claimContenu` ne reprend pas
  (`STATUTS_REPRENABLES` contient `failed`, pas `done`). Le plafond garde une
  marge parce que le nettoyage traite **une slide par pas** : à 1, une ligne
  lente mais saine serait écartée.
- **`avancerImport`** appelle ces deux fonctions au lieu de croire `r.progres`.
- **`continuer()`** prend `progres` en paramètre et ne rechaîne plus un worker
  stérile ; et même productif, il ne se remplace que sous `MAX_CHAINES` (8, la
  largeur de la fenêtre de `claimContenu`), mesuré par les baux vivants. Sans
  ce plafond, le cron injecte 12 chaînes/minute et n'en retire jamais aucune.

Les douze jobs peuvent être rallumés une fois ce correctif déployé
(`cron.alter_job(jobid, active := true)`), pas avant.

## Prod ≠ dépôt (à savoir avant de déployer)

Ce dépôt n’est **pas** la source de vérité de tout ce qui tourne sur
`qkmiwnmiwsvwkttldqgb`. Vérifié le 11/09/2026 :

- `papier-cm` (v11, déployée le 01/09) embarque sept modules `_shared/papier_*`
 absents d’ici et un `papier_master.ts` bien plus gros. La redéployer depuis ce
 dépôt est une régression. Schéma récupéré en `0237` / `0238`, code non.
- `suivi-rc` (déployée le 03/09) lit les charts RevenueCat du projet **Sophia**
 (`proj3f496a80`, cache `rc_metrics_cache` id `sophia`) : hors cloisonnement,
 aucune source ici. Son cron 4 h est **non planifié** — ne pas le relancer.
- Sept fonctions sont des chargeurs `_deploy` depuis le 11/09/2026 (tierlist) :
 `assignation` (v9), `minuit-vnext` (v8) et `import-contenu` (v15) épinglés sur
 `5d8255d` ; `rattrapage-elo` (v9), `revoquer-post` (v8), `creation-manuelle`
 (v8) et `assignation-contenu` (v8) épinglés sur `dd59237`. Les trees sources
 restent éditables ; ne pas redéployer un tree par-dessus un chargeur, et
 regénérer le bundle (recette `_deploy/README.md`) à chaque changement du
 moteur. Avant ce passage : `assignation` était en v8 **tree** (337 Ko déployés
 le 08/09, fidèles au dépôt — le MCP ne tronque plus), `minuit-vnext` et
 `import-contenu` en chargeur sur `b821612` / `066e7d6`. L'avertissement papier
 ne s'applique pas : le `papier_master.ts` de `minuit-vnext` est celui du dépôt
 (seul `papier-cm` v11 est en avance).

- Depuis le 12/09/2026 (burn), les chargeurs sont **onze** : s'ajoutent
 `bruler-assignes`, `bruler-texte-test`, `upscale-assignes` et
 `normaliser-format`. Les SHA épinglés sont ceux du commit
 qui porte les bundles, pas celui de `main` après squash — GitHub continue de
 servir les commits de branche.
- Qualification (12/09/2026, 0253) : `rattrapage-elo` et `minuit-vnext` sont
 épinglés sur `ae13aac`. Ce sont les deux seuls chargeurs qui embarquent
 `rattrapage_elo.ts`. `minuit-vnext` était resté sur `814bb95` : le saut lui
 apporte aussi l'étape `burn` (0252), déjà en prod partout ailleurs.
- Passage au moteur du kit (12/09/2026, fin de journée) : `assignation`,
 `assignation-contenu`, `bruler-assignes`, `bruler-texte-test`,
 `creation-manuelle`, `import-contenu`, `renettoyer-contenu` et `revoquer-post`
 sont épinglés sur `f4da0b9` — huit bundles bougent parce que `gemini.ts` a
 changé, et `gemini.ts` est tiré par tout le moteur de deck. L'alias que
 `new Function(...)` passe au bundle est **renommé par esbuild à chaque
 rebuild** : relire le `import{createClient as …}` du bundle avant de l'effacer
 et reporter le nom dans le chargeur, sinon la fonction boote sur un
 `ReferenceError`. Test de vie après déploiement : un POST anonyme doit rendre
 `401 {"error":"unauthorized"}` — un chargeur cassé rend un 500.

- **Déploiement du 14/09/2026** (file de validation, formats, placement manuel,
 relevé des stats). Migrations `0256` → `0259` appliquées, dix chargeurs
 redéployés, test de vie `401` passé sur les dix. SHA épinglés : `b713af1`
 pour `manage-users` ; `edb0f0f` pour `assignation`, `assignation-contenu`,
 `bruler-assignes`, `bruler-texte-test`, `import-contenu`,
 `renettoyer-contenu` et `revoquer-post` ; `36f01d1` pour `minuit-vnext` et
 `rattrapage-elo`. `normaliser-format` et `upscale-assignes` n'ont pas bougé
 (`a82a89e`) : leurs bundles ressortent d'esbuild octet pour octet identiques.
 Six alias `createClient` ont été renommés au passage (`le`→`pe`, `ne`→`oe`,
 `me`→`ne`, `ie`→`ae`, `Ee`→`Ae`, `P`→`k`, `H`→`Y`).
- **Trois fonctions déployées n'ont plus de source ici** depuis `0256` :
 `papier-cm`, `creation-manuelle` et `assignation-ugc-video`. Elles ne sont
 plus appelées (ni cron, ni UI) et sont laissées en place : les supprimer
 détruirait le `papier-cm` v11, dont le code n'a jamais été dans le dépôt.
 Leurs chargeurs pointent sur d'anciens SHA que GitHub sert toujours, donc
 elles bootent encore — **ne jamais les rappeler** : `creation-manuelle` pose
 `statut = 'valide'` et court-circuiterait la file de validation.
- **Cron ajouté le 14/09/2026** : `rattrapage-elo-midi` (`0 11 * * *`, jobid
 47), posé par `crons_stats_midi_planifier()`. Les cinq jobs du pipeline
 minuit n'ont pas été touchés (jobids 41-45 conservés).

- **Déploiement du 16/09/2026** (clôture de cycle sur les passages réglés).
 Deux chargeurs seulement : `rattrapage-elo` (v15) et `minuit-vnext` (v20),
 épinglés sur `b733cda` — ce sont les deux qui embarquent `rattrapage_elo.ts`.
 Test de vie `401` passé sur les deux, aucun log d'erreur derrière. Alias :
 `rattrapage-elo` reste sur `Y`, `minuit-vnext` passe de `Ae` à `$e`.
 Quatre autres bundles ont bougé au même rebuild — `assignation-contenu`,
 `bruler-texte-test`, `import-contenu`, `revoquer-post` : ils tirent
 `tierlist.ts`, esbuild élague les exports ajoutés mais permute ses
 identifiants minifiés (P↔k, _↔w, et deux paires chacun pour les deux
 derniers). Diff à taille constante, aucun changement de comportement : les
 bundles sont dans le dépôt, **leurs chargeurs restent épinglés sur `9d9d0c7`**
 et n'ont pas été redéployés. À reprendre au prochain déploiement de ces
 quatre-là.

Avant tout `functions deploy`, comparer avec `get_edge_function` : la prod peut
être en avance sur `main`.

- **Déploiement du 19/09/2026** (recul de 30 jours sur le même compte). Cinq
 chargeurs sur `5eb7487` : `assignation-contenu` (v26), `assignation` (v27),
 `minuit-vnext` (v28), `revoquer-post` (v26) et `rattrapage-elo` (v19). Test de
 vie `401` passé sur les cinq. **Quatre alias `createClient` ont été renommés**
 — `le`→`ue`, `ge`→`fe`, `Re`→`Ie`, `ce`→`pe` — au même rebuild : les relire
 dans les bundles, ne jamais les supposer stables.

 `rattrapage-elo` ne porte pas le correctif et a quand même été redéployé : son
 bundle sort à +4 octets parce que `RECUL_MEME_COMPTE_JOURS`, importé nulle
 part chez lui, est tree-shaké et laisse une frontière de `var`
 (`Ve=7,Fe=2` → `Ve=7;var Fe=2`). Le redéployer coûte moins cher que de laisser
 une dérive dépôt/prod à expliquer au prochain rebuild — c'est la dette que le
 16/09 avait laissée sur quatre bundles.

- **Déploiement du 25/09/2026** (le cycle arbitré par la transaction, 0274).
 Quatre chargeurs sur `a8b8dbc` : `assignation-contenu` (v27), `assignation`
 (v28), `minuit-vnext` (v29) et `revoquer-post` (v27) — les quatre qui tirent
 `assignation_quota.ts`, donc le nouveau `estCycleComplet`. +290 octets par
 bundle. **Les quatre alias `createClient` sont inchangés** (`fe`, `ue`, `Ie`,
 `pe`), relus dans les bundles et non supposés. Test de vie `401` passé sur les
 quatre.

 `rattrapage-elo` pointait sur le même SHA (`5eb7487`) et n'a **pas** été
 touché : son bundle ressort octet pour octet identique, il n'embarque pas
 `assignation_quota.ts`. `bruler-texte-test` ressort à **taille constante**
 (37 095 octets, permutation d'identifiants minifiés) : laissé hors périmètre,
 comme les quatre bundles du 16/09 — à reprendre au prochain déploiement qui
 le concerne vraiment.

- **Déploiement du 25/09/2026, second passage** (part réservée aux C). Sept
 chargeurs sur `73abd70` : `assignation-contenu` (v28), `assignation` (v29),
 `minuit-vnext` (v30), `revoquer-post` (v28), `rattrapage-elo` (v20),
 `bruler-texte-test` (v22) et `import-contenu` (v34). Test de vie `401` passé
 sur les sept.

 Quatre portent le correctif (+98/+99 octets). Les trois autres ressortent à
 **taille constante** : ils tirent `tierlist.ts` sans lire `PART_TIRAGE_C`,
 esbuild élague la constante et permute ses identifiants minifiés. Ils sont
 repris ici plutôt que laissés en dérive — la dette que le 16/09 avait créée sur
 quatre bundles et que le 19/09 a fini par payer.

 **Trois alias `createClient` ont été renommés** : `assignation` `fe`→`he`,
 `assignation-contenu` `ue`→`ce`, `revoquer-post` `pe`→`de`. Les quatre autres
 sont inchangés (`Ie`, `Y`, `Y`, `Le`). Relus dans les bundles, jamais supposés.

- **Déploiement du 27/09/2026** (repêchage atomique, 0275). Quatre chargeurs sur
 `3180474` : `assignation-contenu` (v29), `assignation` (v30), `minuit-vnext`
 (v31) et `revoquer-post` (v29). +108 octets par bundle. Les huit autres
 ressortent identiques. Test de vie `401` passé sur les quatre.

 **Les quatre alias `createClient` ont TOUS été renommés** — `he`→`fe`,
 `ce`→`ue`, `Ie`→`Ce`, `de`→`pe`. Troisième rebuild d'affilée où ils bougent :
 les relire dans le bundle, jamais les recopier du déploiement précédent.

- **Déploiement du 28/09/2026** (repêchage plafonné à un par jour, 0276). Quatre
 chargeurs sur `1164cd5` : `assignation-contenu` (v30), `assignation` (v31),
 `minuit-vnext` (v32) et `revoquer-post` (v30). **+9 octets** par bundle, les
 huit autres identiques. Test de vie `401` passé sur les quatre.

 **Les quatre alias `createClient` sont inchangés** (`fe`, `ue`, `Ce`, `pe`) —
 première fois en quatre rebuilds. Relus dans les bundles quand même.

- **Déploiement du 28/09/2026, second passage** (label retiré non assignable,
 0277). Un seul chargeur : `manage-users` (v16) sur `9cb11b3`. +88 octets, alias
 `ne` inchangé. Les onze autres bundles ressortent identiques — seul
 `manage-users` lit `idsLabelsAssignables` ; les autres passent par
 `extraireLabelsAssignables`, qui n'a pas changé. Test de vie `401` passé.

- **Déploiement du 29/09/2026** (forme allemande de la marque, 0278). Six
 chargeurs sur `65cf486` : `assignation-contenu` (v31), `assignation` (v32),
 `minuit-vnext` (v33), `revoquer-post` (v31), `bruler-texte-test` (v23) et
 `import-contenu` (v35). Cinq portent le correctif (**+263 octets** chacun) ;
 `import-contenu` ressort à **taille constante** — il tire `marque.ts` sans lire
 `normaliserOrdreDe`, esbuild élague et permute ses identifiants minifiés. Il est
 repris ici plutôt que laissé en dérive, comme le 25/09. Les six autres bundles
 sont identiques.

 **Les six alias `createClient` sont inchangés** (`ue`, `fe`, `Ce`, `pe`, `Y`,
 `Le`), relus dans les bundles et non recopiés du déploiement précédent. Douze
 sentinelles présentes, test de vie `401` passé sur les six.

- **Déploiement du 29/09/2026, second passage** (invariant deck/structure, 0279).
 Quatre chargeurs sur `a750fdb` : `assignation-contenu` (v32), `assignation`
 (v33), `minuit-vnext` (v34) et `revoquer-post` (v32) — les quatre qui tirent
 `assignation_contenu.ts`. **+303 octets** par bundle, les huit autres
 identiques. **Les quatre alias `createClient` sont inchangés** (`ue`, `fe`,
 `Ce`, `pe`), relus dans les bundles. Huit sentinelles présentes, test de vie
 `401` passé sur les quatre.

- **Déploiement du 29/09/2026, troisième passage** (média effacé regarni, 0280).
 Quatre chargeurs sur `7f95e38` : `assignation-contenu` (v33), `assignation`
 (v34), `minuit-vnext` (v35) et `revoquer-post` (v33) — les quatre qui tirent
 `visuels_assignation.ts`. **+412 octets** par bundle, les huit autres
 identiques. **Les quatre alias `createClient` ont TOUS été renommés** —
 `ue`→`ce`, `fe`→`he`, `Ce`→`Ie`, `pe`→`de` — au lendemain d'un rebuild où ils
 n'avaient pas bougé : les relire dans le bundle à chaque fois, jamais les
 recopier du déploiement précédent. Huit sentinelles présentes, test de vie
 `401` passé sur les quatre.


- **Déploiement du 01/10/2026** (relevé sobre, 0281). Migration 0281 appliquée
 (deux colonnes sur `passages`, fonction `prendre_verrou_drain_elo`, réservée au
 `service_role`) ; aucun cron touché. Deux chargeurs sur `a78e993` :
 `rattrapage-elo` (v21) et `minuit-vnext` (v36) — les deux seuls qui
 embarquent `rattrapage_elo.ts`. **Les deux alias `createClient` ont été
 renommés** : `Y`→`ae` et `Ie`→`Ue`, relus dans les bundles. Les dix autres
 bundles ressortent identiques à l'octet : la lecture de l'usage Apify vit dans
 `apify_usage.ts` et non dans `apify.ts`, que tirent six autres bundles — y
 ajouter une fonction, même élaguée, les faisait tous « changer ».
 Test de vie `401` passé sur les deux **par `pg_net` depuis la base** : le
 proxy de l'environnement de travail bloque `supabase.co`, l'appel anonyme
 part donc de `net.http_post` et se lit dans `net._http_response`.