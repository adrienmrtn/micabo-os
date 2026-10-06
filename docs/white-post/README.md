# White posts : rendu et import (0306)

Un « white post » est un slideshow au texte **dessiné dans l'image** : fond
blanc (254), texte noir souligné, une petite photo collée. Le modèle est
@amayareading. Le texte étant dans l'image, il n'y a rien à traduire à
l'assignation : on rend **une série d'images par langue**, et l'OS sert à chaque
créateur la série de sa langue (`contenus.texte_incruste`, voir AGENTS.md).

## Chaîne

1. **Scrape** du post par Apify (`clockworks~tiktok-scraper`, `postURLs`,
   `shouldDownloadSlideshowImages: true`). Les images arrivent dans le
   key-value store Apify ; le CDN TikTok n'est pas joignable depuis
   l'environnement de travail.
2. **Mesure** de la mise en page d'origine : `analyse.py` trouve les photos
   (boîtes au pixel près) et les lignes de texte, soulignés compris.
3. **Calibrage** : reproduire d'abord l'ANGLAIS d'origine avec `rendu.py`, et
   comparer (`diff.py`, superposition rouge/cyan). On ne traduit qu'une fois
   l'original reproduit.
4. **Textes** FR / DE / TR dans `post_<id>.py` : soulignés entre crochets, la
   slide publicitaire d'origine remplacée par la slide micabo et la capture de
   l'appli dans la langue. Depuis le deuxième post, `post_lib.py` part de la
   slide d'origine elle-même (`fond_source`) : on n'efface que les blocs de
   texte (`effacer`), les photos restent en place au pixel près, et la slide
   publicitaire reçoit la capture micabo (et la carte App Store si l'original
   en avait une).
5. **Rendu + retrait des métadonnées** (`sans_meta.py` : tous les segments
   APPn sauf APP14, et COM — EXIF, XMP, ICC, JFIF, C2PA).
6. **Import** par la fonction Edge `import-texte-incruste` : elle relit les
   images (URL Apify lue avec le jeton), retire encore les métadonnées, range
   dans `medias/incruste/<contenu>/<langue>/<n>.jpg` et crée le slideshow EN
   FILE de validation en une transaction (`creer_contenu_texte_incruste`).
   Avec `contenu_id`, la même fonction AJOUTE des langues à un white post
   existant (`ajouter_langues_texte_incruste`, 0307) : même nombre d'images que
   sa structure, une langue déjà présente est refusée, le statut ne bouge pas.

## Mesures qui tiennent pour tout le compte

| | valeur |
|---|---|
| Police | **Inter Display Regular** (et non Inter : écart moyen 7,3 contre 10,2 sur la même ligne) |
| Corps | 42 px, interligne 48–48,5 px |
| Titre | 63 px |
| Souligné | épaisseur taille/22 (≈ 1,9 px), à taille × 0,12 sous la ligne de base |
| Texte | noir pur (0, 0, 0) sur fond (254, 254, 254) |
| Image | 1080 × 1342 |

L'anglais d'origine reproduit avec ces valeurs : écart moyen 4,98 sur toute la
slide, bruit JPEG compris. Les photos ne sont jamais rééchantillonnées : elles
sont recopiées octet pour octet depuis la slide d'origine.

## Règles d'écriture

- La langue des posts : minuscules en début de phrase, ton direct, pas de
  formule publicitaire. La slide micabo reprend la structure exacte de la slide
  publicitaire d'origine (le problème, « c'était pareil pour moi jusqu'à… »,
  le bénéfice).
- Marque : « l’appli micabo » (fr), « die micabo-App » (de), « micabo
  uygulaması » (tr, le cas se pose sur le possessif : « micabo uygulamasını
  açıyorum »), toujours en minuscules. Aucun tiret long.
- Traduire le SENS, pas les mots : chaque langue doit sonner comme un post
  écrit dans cette langue (« öfkeliyken karar verme, mutluyken söz verme »,
  pas un calque de l'anglais). Un jeu de mots se refait dans la langue
  (« fühl dich wohl damit, dich unwohl zu fühlen », « rahatsız olmaktan
  rahatsız olma ») ou se laisse tomber.
- Pas de mot orphelin en fin de bloc, pas de nombre séparé de son unité :
  espace insécable (`NB`) entre « 10 » et « min », et devant « : ! ? » en
  français.
- Neutre en genre en français (« tu galères », « c’était pareil pour moi ») :
  les créateurs ne sont pas tous des créatrices.
- Une ligne ne doit jamais toucher une photo : si la traduction s'allonge, on
  descend la photo d'un interligne (slide 3) plutôt que de serrer le texte.
- Alignement d'un bloc : à gauche par défaut, `"align": "right"` (`x` = bord
  droit) ou `"align": "center"` (`x` = axe, chaque ligne centrée dessus).
- Certains posts d'amaya sont dessinés plus petit (38 px, titres 58,5 px :
  7692093201968090401) : on garde la taille mesurée, pas 42 / 63.

## La capture turque

L'appli n'a pas été capturée en turc : `capture_tr.py` reconstruit la capture
à partir de la capture FR, texte par texte, sur son fond exact et dans la même
police (Outfit 700/600/500, DM Sans 500/400, sous-ensembles latin + latin-ext
de fontsource pour ı, ş, ğ). Libellés : Tekrar / Zor / Doğru / Kolay. À
remplacer par une vraie capture dès qu'il y en a une.

```
python3 -I docs/white-post/capture_tr.py <capture_fr.jpg> <dossier_fontsource/> <capture_tr.jpg>
```

## Les posts

| TikTok | sujet | slide micabo | vues source |
|---|---|---|---|
| 7691007701127564576 | dangerously disciplined | réviser tous les jours | 796 800 |
| 7685071416466607382 | destroying your focus | scroller tous les jours | 496 400 |
| 7684726544442346774 | disgustingly productive (7 slides) | teste-toi au lieu de relire | 271 100 |
| 7689918962905124129 | become smart again | révise au lieu de scroller | 187 000 |
| 7686189452963712288 | dangerously intelligent | scrolle moins, retiens plus | 123 200 |
| 7688807102764092705 | top 5 ways to ruin your 20s | l'ironie du post : « n'ouvre surtout pas l'appli micabo » | 471 400 |
| 7685340052989398275 | become smart again (niche #2), sans slide pub | se faire interroger : les trous se voient (slide 5, la photo devient la capture) | 212 800 |
| 7685736268617059616 | 5 signs you've harmed your brain (7 slides) | attention courte, séances courtes | 107 800 |
| 7690642292855672096 | niche traits of successful people | ne plus recopier ses cours en fiches | 91 400 |
| 7683541501007252758 | become smart again (sources) | réviser avant d'oublier : la courbe de l'oubli | 58 100 |
| 7691336990419209505 | habits to stop in your 20s | les temps morts de la journée | 20 000 |
| 7692093201968090401 | become smart again (short-form) | ses propres cours plutôt que des vidéos de révision | 15 500 |
| 7681048823824649494 | fixed my phone addiction | l'appli à la place de TikTok sur l'écran d'accueil | 11 300 |
| 7680975889932225814 | 7 ways to stop doomscrolling (7 slides) | le matin au réveil | 7 955 |
| 7683630825610513686 | the anti-rot routine | le soir, avant de dormir | 7 442 |

Chaque slide micabo prend un angle différent (régularité, scroll, rappel
actif, mémoire) : cinq posts qui diraient la même phrase se verraient. Le
second lot (06/10, dix posts) garde la règle, et la ligne micabo n'y répète
jamais « elle transforme mes cours en flashcards et je révise 10 min par
jour » mot pour mot.

Ce que la slide micabo peut promettre : on y met ses cours, notes ou PDF,
l'appli en fait des flashcards ou des questions, on se teste quelques minutes
par jour. Jamais : bloquer des applis (c'est ReadUp), audio, photo, rappels,
planning, tuteur, note obtenue ou chiffre de résultat.

Quatre posts reprennent la série « become smart again » d'amaya : chacun a
son propre titre (« réveiller ton intelligence », « retrouver un cerveau vif »,
« te remettre à réfléchir », « récupérer ton cerveau »), un même compte les
recevra tous.

Les deux derniers posts du lot ont moins de 10 000 vues d'origine : ils
entrent en C (`VUES_SOURCE_MIN_B_PLUS`). Écartés du catalogue : « 7 figures by
25 » (argent), la tier list du soir (alcool, doses de magnésium) et un post au
texte posé sur la photo, qui n'est pas un white post.

```
python3 -I docs/white-post/post_7691007701127564576.py <slides_origine/> <cap_fr> <cap_de> <cap_tr> <sortie/>
python3 -I docs/white-post/post_<id>.py <slides_origine/> <cap_fr> <cap_de> <cap_tr> [<fiche_app_store>] <sortie/>
```

Le premier lit `s1.jpg` … `s6.jpg` ; les suivants `<id>_<n>.bin`, tels que
rangés par le scrape. La fiche App Store n'est demandée que par les posts dont
la slide publicitaire d'origine avait une carte d'application.
