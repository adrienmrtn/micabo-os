# Recette du burn parfait

Protocole complet pour reproduire un texte de slide TikTok sur une image propre,
dans une autre langue, sans que la différence se voie.

Entrée : une capture de la slide originale (texte inclus) + la même image sans texte.
Sortie : l'image propre avec le texte traduit, même police, même taille, même
position, même couleur, même contour, mêmes coupures de lignes.

Le code de référence est dans `burn_engine.py`. Ce document dit quoi appeler, dans
quel ordre, avec quels seuils, et où sont les pièges.

---

## Principe directeur

Le LLM lit et traduit. Python mesure et dessine. Aucune valeur numérique ne doit
sortir de l'estimation d'un modèle : tout ce qui est taille, position, couleur,
espacement se mesure sur les pixels. Le LLM ne sert qu'à ce qu'un humain ferait
avec ses yeux et sa langue : lire le texte, décrire le style en mots, traduire,
valider le rendu final.

Résultat : le rendu est déterministe et reproductible. Deux exécutions sur les
mêmes entrées donnent le même fichier au pixel près.

---

## Pipeline en 8 étapes

| # | Étape | Qui | Sortie |
|---|-------|-----|--------|
| 1 | Recalage capture vers image propre | Python (OpenCV) | échelle + translation |
| 2 | Lecture du texte et du style | LLM vision | JSON descriptif |
| 3 | Mesure pixel des lignes | Python (numpy) | géométrie exacte |
| 4 | Identification de la police | Python + LLM vision | fichier de police + taille + tracking |
| 5 | Traduction | LLM | texte cible |
| 6 | Re-découpage des lignes | Python | lignes finales |
| 7 | Rendu | Python (Pillow) | PNG final |
| 8 | Contrôle qualité | Python + LLM vision | verdict et corrections |

---

## Étape 1. Recalage

La capture est recadrée, redimensionnée, parfois zoomée par rapport à l'image
propre. Il faut la transformation avant toute mesure.

```python
from burn_engine import align
t = align("clean.png", "screenshot.png")   # {"scale":…, "tx":…, "ty":…, "inliers":…}
```

ORB + `estimateAffinePartial2D` avec RANSAC. Un point (x, y) de la capture devient
`(scale*x + tx, scale*y + ty)` dans l'image propre.

**Seuil.** Au-dessus de 300 inliers, fiable. En dessous de 50, ne pas s'en servir :
comparer les rapports largeur/hauteur des deux images. S'ils sont égaux, c'est le
même cadrage, et l'échelle pure `largeur_propre / largeur_capture` avec translation
nulle est plus juste que le résultat d'ORB.

**Piège.** Une capture d'interface TikTok contient des éléments qui n'existent pas
dans l'image propre : barre du bas, points de carrousel, pseudo, boutons. ORB s'en
accommode, mais ne jamais mesurer du texte dans ces zones.

---

## Étape 2. Lecture du texte et du style par le LLM

Un seul appel vision par slide. Demander un JSON strict.

Prompt système :

```
Tu analyses une capture d'écran de slide TikTok. Tu décris le texte ajouté par le
créateur, pas l'image de fond, et jamais l'interface de l'application (pseudo,
date, légende, points de carrousel, boutons, barre du bas).

Réponds en JSON strict, sans commentaire :
{
  "blocks": [
    {
      "id": "titre",
      "text": "texte exact, retours à la ligne notés \n, ligne vide = paragraphe",
      "role": "titre | sous-titre | puces | légende",
      "style": "sans | serif | serif italique | manuscrit",
      "weight": "normal | medium | gras",
      "case": "minuscules | capitales | normal",
      "color_hint": "blanc | jaune pâle | bleu clair | …",
      "outline": true | false,
      "highlight": true | false,
      "align_hint": "gauche | centre | droite",
      "bbox_hint": [x0, y0, x1, y1]
    }
  ]
}

Recopie le texte tel quel, fautes comprises.
```

`bbox_hint` est approximatif. Il sert seulement à borner la zone de mesure de
l'étape 3, ce qui évite d'aller chercher des pixels de la même couleur ailleurs
dans la photo.

Modèle conseillé : Sonnet. Haiku fait des fautes de recopie sur les textes longs.

---

## Étape 3. Mesure pixel

C'est l'étape qui fait la qualité du résultat. Tout se joue ici.

### 3.1 Masque de couleur

Partir du `color_hint` et de la zone `bbox_hint`, échantillonner la couleur
dominante, puis construire un masque par distance à cette couleur.

```python
mask = color_mask(img, (253, 245, 175), tol=45)
mask[:y0] = False; mask[y1:] = False        # borner par le bbox_hint
mask[:, :x0] = False; mask[:, x1:] = False
```

Couleur exacte : médiane des pixels du masque après érosion de 2 ou 3 itérations.
L'érosion enlève l'anticrénelage, qui tire la médiane vers la couleur du fond.

### 3.2 Lignes

`group_rows(mask, gap=6)` donne les bandes horizontales. Une bande = une ligne.

### 3.3 Faux positifs

Toujours passer par `column_runs`. Un t-shirt jaune, un reflet sur l'eau, un logo
vert ont la même couleur que le texte. Ils apparaissent comme des segments isolés,
séparés du texte par un grand vide horizontal. Garder le groupe de segments
contigus, jeter les orphelins.

Sur une des slides testées, cette seule erreur faisait passer la largeur d'une
ligne de 648 px à 1019 px, et cassait tout le calage de police.

### 3.4 Géométrie verticale

`line_metrics` donne, par ligne :

- haut d'ascendante : première rangée allumée ;
- haut d'x : rangée où le compte de pixels explose (toutes les minuscules
  commencent à la même hauteur) ;
- ligne de base : dernière rangée où le compte est encore élevé, avant
  l'effondrement dû aux seules descendantes.

L'interligne est l'écart entre deux lignes de base successives. Le mesurer sur la
première et la dernière ligne, puis diviser, plutôt que sur deux lignes voisines :
l'erreur se divise d'autant.

### 3.5 Alignement

Comparer la dispersion des bords gauches, des centres et des bords droits.
La plus faible gagne. `detect_alignment` fait ça.

Ne jamais se fier à l'œil : un bloc centré dont les deux lignes ont des longueurs
proches ressemble à un bloc aligné à gauche.

### 3.6 Contour

Balayer une rangée qui traverse une hampe verticale. Compter les pixels sombres
avant le remplissage. C'est la demi-épaisseur du contour. Dans Pillow,
`stroke_width` s'ajoute vers l'extérieur, donc on passe cette valeur telle quelle.

### 3.7 Tailles multiples dans un même bloc

Vérifier la hauteur d'x ligne par ligne. Sur une des slides, le sous-titre en deux
lignes avait deux tailles différentes (32 px puis 24 px). Les traiter comme deux
blocs séparés.

---

## Étape 4. Identification de la police

### 4.1 Bibliothèque de candidats

Récupérer les polices libres au format woff via npm, puis convertir en ttf.

```bash
npm pack @fontsource/tiktok-sans        # TikTok Sans, libre depuis 2025
tar xzf fontsource-tiktok-sans-*.tgz
```

```python
from fontTools.ttLib import TTFont
f = TTFont("tiktok-sans-latin-600-normal.woff"); f.flavor = None; f.save("tts600.ttf")
```

Correspondances utiles :

| Style vu sur la slide | Police libre à utiliser |
|---|---|
| Sans TikTok "Classic" | TikTok Sans (fontsource, graisses 300 à 900) |
| Sans géométrique proche de Proxima Nova | Figtree, Mulish |
| Serif gras type Bookman | TeX Gyre Bonum Bold (paquet TeX Live) |
| Serif gras type Century Schoolbook | TeX Gyre Schola Bold |
| Serif italique élégant | Playfair Display Italic, Bodoni Moda Italic |
| Flèches, symboles absents | DejaVu Sans en repli glyphe par glyphe |

### 4.2 Score automatique

Pour chaque candidat, calculer deux tailles :

- la taille qui reproduit la largeur mesurée d'une ligne, sans tracking ;
- la taille qui reproduit la hauteur d'x mesurée.

Leur rapport dit si les proportions de la police collent au modèle.

```python
font_score("tts600.ttf", "and things", target_width=871, target_x_height=101)
# {"size_from_width": 171.2, "size_from_x_height": 190.1, "ratio": 0.900}
```

Un rapport dans 0,95 à 1,05 est bon. Le meilleur rapport parmi les candidats gagne.

### 4.3 Verdict visuel obligatoire

Le score ne distingue pas deux polices de mêmes proportions. Rendre le texte
original avec chaque candidat, empiler les images sous la capture de référence,
regarder. Les lettres qui trahissent : `g` (une ou deux boucles), `y` (queue droite
ou bouclée), `t` (sommet coupé droit ou en biais), `a` (une ou deux étages),
terminaisons en goutte.

### 4.4 Taille et tracking : la règle qui compte

**Fixer la taille par la largeur, avec tracking à zéro. Ne pas fixer la taille par
la hauteur d'x.**

Le seuil du masque gonfle la hauteur d'x de 2 à 3 px de chaque côté, sur du texte
adouci par la compression. Une taille calée sur cette hauteur est trop grande de
8 à 10 %, et il faut alors un tracking très négatif pour retomber sur la bonne
largeur. Ce tracking écrase les espaces entre les mots et donne `andthings`.

```python
size, ratios = fit_size_zero_tracking("tts600.ttf", [
    ("activites", 710), ("and things", 871), ("to boost a", 850), ("dopamine", 839),
])
# ratios cohérents entre eux = mesure saine ; un ratio isolé = ligne mal mesurée
```

N'introduire du tracking que si, à taille calée, l'erreur de largeur dépasse 3 %
sur plusieurs lignes, et le garder entre -0,05 et +0,15 em.

---

## Étape 5. Traduction

Un seul appel LLM pour tout le carrousel, pour que le vocabulaire reste cohérent
d'une slide à l'autre.

```
Traduis en français ces textes de slides TikTok.

Contraintes :
- registre parlé, tutoiement, comme un créateur qui s'adresse à son audience ;
- longueur proche de l'anglais, à 10 % près ; préfère le mot court ;
- garde la casse d'origine : si tout est en minuscules, reste en minuscules ;
- garde les emojis, les flèches, les nombres, la ponctuation de structure ;
- typographie française : apostrophes ’, guillemets « » avec espaces insécables,
  et pas d'espace avant la virgule ;
- ne traduis pas les termes techniques passés en français tels quels
  (deep work, dopamine) ;
- réponds en JSON : {"blocks":[{"id":"titre","text":"…"}]}.

Pour chaque bloc, donne aussi une variante plus courte, "text_short", utilisable si
le texte déborde.
```

La variante courte est ce qui évite un aller-retour quand le français ne rentre pas.

---

## Étape 6. Re-découpage des lignes

L'app d'origine coupe les lignes sur une largeur de boîte inconnue. On l'encadre :

- borne basse : la ligne la plus large du texte original ;
- borne haute : cette même ligne plus l'espace plus le premier mot de la ligne
  suivante, puisque ce mot n'y tenait pas.

Prendre le milieu de l'intervalle, appliquer `wrap` au texte français. Vérifier
qu'en re-découpant le texte anglais avec cette valeur, on retombe exactement sur les
coupures d'origine. Si oui, la boîte est bonne.

Si le texte français déborde de l'image malgré tout, dans cet ordre :

1. essayer `text_short` ;
2. accepter une ligne de plus, en remontant le bloc d'un demi-interligne pour qu'il
   reste centré au même endroit ;
3. réduire la taille de 10 à 15 %, jamais plus, et le dire dans le rapport.

Ne jamais laisser une ligne sortir du cadre, ni recouvrir un visage.

---

## Étape 7. Rendu

```python
render_spec("clean.png", spec, "out.png")
```

Les points qui font la différence :

- **Supersampling ×3.** Dessiner dans une image 3 fois plus grande, réduire en
  LANCZOS. Sans ça, les bords sont durs et le contour bave.
- **Dessin caractère par caractère.** Seule façon d'appliquer un tracking. Ne pas
  oublier de retirer le décalage d'encre du premier glyphe, sinon l'alignement à
  gauche est faux de quelques pixels.
- **Calques masque en niveaux de gris, puis composition.** Contour d'abord,
  remplissage ensuite. Dessiner directement en couleur donne des liserés.
- **Ombre.** Flou gaussien du masque de remplissage, opacité 0,35 à 0,5, décalage
  de 0 à 3 px. La plupart des styles TikTok sans contour ont cette ombre discrète.
- **Position.** Ancrer sur la ligne de base, jamais sur le haut du texte. Les
  accents français montent plus haut que les capitales anglaises, et un ancrage par
  le haut décale toute la ligne.

Le style spec est un JSON :

```json
{
  "blocks": [{
    "lines": ["activités et", "trucs pour", "un pic de", "dopamine"],
    "font": "fonts/tts600.ttf",
    "size": 172.0,
    "track": 0.0,
    "color": [253, 245, 175],
    "align": "left",
    "anchor_x": 40.2,
    "baseline": 993.5,
    "pitch": 227.5,
    "stroke": 0.0,
    "stroke_color": [0, 0, 0],
    "shadow": {"alpha": 0.4, "blur": 4, "dx": 0, "dy": 2}
  }]
}
```

---

## Étape 8. Contrôle qualité

### 8.1 Test de non-régression, automatique

Rendre le texte **anglais d'origine** avec le style spec calculé, sur l'image
propre. Mesurer ce rendu avec exactement le même code qu'à l'étape 3. Comparer aux
mesures de la capture.

Tolérances sur une image de 2000 px de large :

| Grandeur | Tolérance | Action si dépassée |
|---|---|---|
| Ligne de base | 8 px | ajuster `baseline` et `pitch` |
| Bord gauche ou centre | 8 px | ajuster `anchor_x` ou l'alignement |
| Largeur de ligne | 2 % | ajuster la taille, puis le tracking |
| Coupures de lignes | identiques | ajuster la largeur de boîte |

Tant que ce test ne passe pas, ne pas rendre le français. C'est le test qui a permis
de valider les six slides de référence : coupures identiques, positions à 5 px près,
largeurs à moins de 2 %.

### 8.2 Vérification visuelle par le LLM

Empiler capture d'origine, rendu anglais et rendu français, et demander :

```
Trois versions de la même slide : l'original, ma reproduction en anglais, ma version
française. Réponds en JSON.
1. La reproduction anglaise est-elle indiscernable de l'original ? Sinon, qu'est-ce
   qui cloche : police, taille, position, couleur, contour, espacement ?
2. La version française a-t-elle un défaut visible : débordement, chevauchement d'un
   visage, ligne orpheline, accent coupé, texte illisible sur le fond ?
{"en_ok": bool, "issues": [...], "fr_ok": bool, "fr_issues": [...]}
```

---

## Pièges rencontrés, par ordre de coût

1. **Pixels parasites de la même couleur.** Vêtement, reflet, logo. Corrigé par
   `column_runs`. C'est l'erreur la plus coûteuse : elle fausse la police.
2. **Hauteur d'x gonflée par le seuil du masque.** Corrigé en calant la taille sur
   la largeur, tracking à zéro.
3. **Tracking négatif qui mange les espaces entre les mots.** Symptôme direct du
   point précédent.
4. **Bloc centré pris pour un bloc aligné à gauche.** Corrigé par la dispersion des
   centres.
5. **Deux tailles dans un même bloc.** Vérifier la hauteur d'x de chaque ligne.
6. **Glyphes absents de la police.** Les flèches `→` ne sont pas dans TikTok Sans.
   Repli par glyphe, jamais de substitution silencieuse d'un caractère.
7. **Apostrophes droites en français.** Utiliser `’`. Détail, mais ça se voit.
8. **Français plus long de 15 à 20 %.** Anticipé par la variante courte et la règle
   de débordement.
9. **Capture d'interface prise pour du contenu.** Le pseudo et la date ne sont pas
   du texte de slide.

---

## Dépendances

```bash
pip install pillow opencv-python-headless numpy scipy fonttools anthropic
```

Polices : fontsource via npm pour les Google Fonts, paquet TeX Gyre pour les
clones de Bookman et Century Schoolbook, DejaVu Sans pour le repli.
Toutes libres, redistribuables, licence SIL OFL ou GUST.

## Coût

Trois appels LLM par carrousel de six slides : lecture du style, traduction,
vérification. Environ 32 000 tokens en entrée et 3 500 en sortie, soit 0,10 $ avec
Sonnet, 0,05 $ avec Haiku. Le reste est du calcul local, gratuit.

## Ce qui reste manuel

Le choix de la police quand deux candidats se valent au score. Le verdict visuel
final. La formulation française quand le sens prime sur la longueur.
