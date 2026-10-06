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
4. **Textes** FR / DE dans `post_<id>.py` : soulignés entre crochets, la slide
   publicitaire d'origine remplacée par la slide micabo et la capture de
   l'appli dans la langue.
5. **Rendu + retrait des métadonnées** (`sans_meta.py` : tous les segments
   APPn sauf APP14, et COM — EXIF, XMP, ICC, JFIF, C2PA).
6. **Import** par la fonction Edge `import-texte-incruste` : elle relit les
   images (URL Apify lue avec le jeton), retire encore les métadonnées, range
   dans `medias/incruste/<contenu>/<langue>/<n>.jpg` et crée le slideshow EN
   FILE de validation en une transaction (`creer_contenu_texte_incruste`).

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
- Marque : « l’appli micabo » (fr), « die micabo-App » (de), toujours en
  minuscules. Aucun tiret long.
- Neutre en genre en français (« tu galères », « c’était pareil pour moi ») :
  les créateurs ne sont pas tous des créatrices.
- Une ligne ne doit jamais toucher une photo : si la traduction s'allonge, on
  descend la photo d'un interligne (slide 3) plutôt que de serrer le texte.

## Relancer le post 7691007701127564576

```
python3 -I docs/white-post/post_7691007701127564576.py <slides_origine/> <capture_fr.jpg> <capture_de.jpg> <sortie/>
```

`slides_origine/` contient `s1.jpg` … `s6.jpg` tels que scrapés.
