# burn-kit

Reprise exacte de ce que j'ai fait à la main sur tes six slides, en code qui tourne.
Entrée : la slide d'origine avec son texte, plus la même image sans texte.
Sortie : la même image avec le texte traduit, même police, même taille, même
position, mêmes coupures de lignes.

Testé : sur la slide bibliothèque, le kit retrouve tout seul taille 59,75 px,
contour 3,88 px, alignement centré, interligne 79,2 px et ligne de base 1122.
À la main j'avais trouvé 60 / 3,9 / centré / 79,3 / 1123. L'autotest passe avec
1,4 px d'écart de position et 1,3 % d'écart de largeur.

---

## 1. Pourquoi ton résultat actuel est raté

Ce que montre ta capture, dans l'ordre de gravité.

**a. Aucun garde-fou de cadre.** Sur la slide 3, le texte sort de l'image des deux
côtés : « et good rades: do 5-minute tudy sessions tay focused ». Un rendu qui peut
déborder finit toujours par déborder. Dans le kit, `fit_to_frame()` est obligatoire
avant tout rendu : il re-découpe et réduit la taille par pas de 6 % jusqu'à ce que
chaque ligne tienne, avec une marge de 4 %. Si même la variante courte ne rentre
pas, il lève une erreur au lieu de produire une image cassée.

**b. La taille ne vient pas d'une mesure.** Tes tailles n'ont aucun rapport d'une
slide à l'autre. Soit elles sont en dur, soit elles viennent du LLM. Un modèle ne
sait pas donner une taille en pixels : il n'a pas accès aux pixels, il regarde une
image redimensionnée. Dans le kit, la taille sort de `fit_size_zero_tracking()`,
qui la déduit de la largeur mesurée des lignes d'origine.

**c. Un spec calculé sur une résolution, appliqué à une autre.** C'est ce qui
donne du texte géant. Ta capture d'écran TikTok fait 1080 de large, ta photo
propre 2368. Facteur 2,2. Sans recalage, tout est faux d'un facteur 2. Dans le kit,
`align()` calcule ce facteur et toutes les positions passent par `to_clean()`.

**d. Pas de re-découpage des lignes.** Le texte est coupé n'importe où. Le kit
déduit la largeur de boîte des coupures d'origine, puis re-découpe le texte cible
dedans avec `wrap_paragraphs()`.

**e. Le texte d'origine est encore là.** Sur ta slide 1, on lit le français et
l'anglais superposés. Il faut la plaque propre. Si tu ne l'as pas,
`--inpaint` efface le texte d'origine, mais ça ne marche que sur fond simple.

**f. Position ancrée au centre par défaut.** Le kit détecte l'alignement en
comparant la dispersion des bords gauches, des centres et des bords droits, puis
ancre sur le bord mesuré.

---

## 2. Installation

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
bash fetch_fonts.sh          # télécharge les polices libres dans fonts/
export ANTHROPIC_API_KEY=sk-ant-...
```

`fetch_fonts.sh` a besoin de npm pour les polices Google, et du paquet système
`texlive-fonts-extra` pour les clones de Bookman et Century Schoolbook.

---

## 3. Modèles

Identifiants API exacts, vérifiés dans la doc :

| Rôle | Modèle | Pourquoi |
|---|---|---|
| Lecture du texte et du style | `claude-sonnet-5` | recopie fiable, respecte le JSON |
| Traduction | `claude-sonnet-5` | même appel pour tout le carrousel |
| QA visuelle | `claude-sonnet-5` | compare original, reproduction, traduction |
| Option économique | `claude-haiku-4-5-20251001` | fautes de recopie sur les textes longs |
| Option lourde | `claude-opus-5` | seulement si Sonnet cale |

Ce qu'on demande au LLM : le texte, le rôle, le genre de police, une couleur
approximative, une boîte approximative. Rien d'autre. Aucune taille, aucune
position, aucun interligne. C'est la règle qui fait la différence entre ton
résultat et le mien.

---

## 4. Utilisation

```bash
python -m burn.pipeline \
  --shot   slides/01_en.png \
  --clean  slides/01_clean.png \
  --lang   français \
  --out    out/01_fr.png \
  --fonts  fonts \
  --workdir work
```

Sans plaque propre :

```bash
python -m burn.pipeline --shot 01_en.png --inpaint --lang français --out 01_fr.png
```

Depuis ton app web :

```python
from burn.pipeline import run_slide
res = run_slide(shot, clean, "français", out, fonts="fonts", workdir="work", do_qa=False)
if not res["selftest"]["pass"]:
    raise RuntimeError("style mal mesuré, ne pas publier")
```

Sortie dans `work/` : `.read.json` (ce que le LLM a lu), `.spec.json` (le style
mesuré), `.qa.json` (l'autotest), `.repro.png` (la reproduction dans la langue
d'origine). Quand une slide rate, ces quatre fichiers disent laquelle des étapes
a lâché.

---

## 5. Les trois règles non négociables

1. **Le LLM lit, Python mesure.** Aucun nombre ne vient du modèle.
2. **Reproduire avant de traduire.** On rend le texte d'origine avec le style
   calculé et on compare à la capture. Tolérances : 0,5 % de la largeur d'image
   pour les positions, 2 % pour les largeurs, coupures identiques. Tant que ça ne
   passe pas, on ne rend pas la traduction. `qa_selftest()` fait ce test.
3. **Caler la taille sur la largeur, pas sur la hauteur des lettres.** Le seuil du
   masque gonfle la hauteur de 2 à 3 px, la taille part 10 % trop grande, et le
   tracking négatif qui compense colle les mots entre eux.

---

## 6. Le contrat entre les étapes

```json
{"blocks": [{
  "id": "titre",
  "font": "fonts/tts600.ttf",
  "size": 59.75,
  "track": 0.0,
  "color": [255, 255, 255],
  "align": "center",
  "anchor_x": 880.1,
  "baseline": 1122.0,
  "pitch": 79.2,
  "stroke": 3.88,
  "stroke_color": [0, 0, 0],
  "shadow": {"alpha": 0.4, "blur": 4, "dx": 0, "dy": 2},
  "box_width": 856.7,
  "lines": ["Comment piéger ton cerveau", "pour devenir obsédé par les", "études"]
}]}
```

Tout est en pixels de l'image propre. `render_spec()` ne fait que dessiner ça.
Tu peux stocker ce JSON en base et re-rendre dans dix langues sans refaire la
mesure ni rappeler le LLM.

---

## 7. Ce que le kit ne fait pas encore

- Les surlignages, ces rectangles arrondis derrière le texte avec des coins
  rentrants entre les lignes. Le champ `highlight` est lu mais pas rendu.
- Les polices manuscrites et les styles néon de TikTok.
- Le texte en arc ou en rotation.
- L'inpainting sur fond détaillé. Sur une photo chargée, ça se voit.

## 8. Coût

Trois appels par slide dans le pire cas, deux en production (lecture et traduction,
la QA visuelle une fois sur cinq). Environ 0,02 $ par slide avec Sonnet. Le reste
est du calcul local.
