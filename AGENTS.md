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
  pas le merge** — le déploiement production qui suit passe. Pour avoir des
  previews verts, ajouter `VERCEL_SUPPORT_LARGE_FUNCTIONS=1` à
  l'environnement **Preview** du projet Vercel (Settings → Environment
  Variables), en plus de Production.

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
