"""
Burn déterministe du texte sur une slide propre.

Le LLM lit et traduit. Python mesure et dessine. Aucune valeur numérique ne
sort de l'estimation d'un modèle : taille, position, couleur, espacement se
mesurent sur les pixels de la slide d'origine. Mêmes entrées, même PNG.

Ce que le moteur mesure, dans l'ordre :

  1. le recalage brut → propre (analytique : le pipeline recadre en « cover »
     centré puis redimensionne, la transformation est connue) ;
  2. le masque du texte : couleur ET écart avec l'image propre, qui a
     justement été débarrassée de ce texte ;
  3. les lignes, débarrassées des pixels parasites de la même couleur — un
     vêtement clair ou un reflet ferait passer une ligne de 648 à 1019 px et
     casserait tout le calage ;
  4. par ligne : hauteur d'x, ligne de base, largeur d'encre ;
  5. la taille, calée sur la LARGEUR d'encre à interlettrage nul — le seuil du
     masque gonfle la hauteur d'x de 2 à 3 px, une taille calée dessus est
     trop grande de 8 à 10 % et le tracking négatif qui rattrape mange les
     espaces entre les mots ;
  6. la graisse, choisie entre deux candidates par cohérence largeur/hauteur ;
  7. l'interligne de base à base, la boîte de coupe, l'alignement, le contour.

Puis il se contrôle : il redessine le texte D'ORIGINE avec ces réglages et
re-mesure avec le même code. Les écarts partent dans le rapport.
"""

from __future__ import annotations

import io
import os
import re
import urllib.request
from dataclasses import dataclass, field

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

DOSSIER_POLICES = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fonts")
#: TikTok Sans, toute la famille livrée par fontsource. N'en embarquer que deux
#: obligeait le moteur à choisir la moins mauvaise et à compenser avec une
#: taille fausse : sur la paire de contrôle, la bonne graisse est la 500, que
#: je n'avais pas.
GRAISSES = (300, 400, 500, 600, 700, 800, 900)
POLICES = tuple(f"TikTokSans-{g}.ttf" for g in GRAISSES)


def graisse(nom: str) -> str:
    """« TikTokSans-500.ttf » → « 500 »."""
    return nom.rsplit("-", 1)[-1].removesuffix(".ttf")
POLICE_700 = "TikTokSans-700.ttf"
POLICE_600 = "TikTokSans-600.ttf"
#: Repli glyphe par glyphe : TikTok Sans n'a que 225 caractères, pas de flèches.
POLICE_REPLI = "DejaVuSans.ttf"

# Emojis Apple, même CDN que la preview du navigateur.
CDN_EMOJI = "https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15.1.2/img/apple/64"
RE_EMOJI = re.compile("((?:[\U0001F000-\U0001FAFF☀-➿⬀-⯿][️‍]*)+)")

#: Le texte est dessiné à cette échelle puis réduit — bords nets.
SUPERSAMPLE = 3
#: Distance de Chebyshev max à la couleur du texte.
TOL_COULEUR = 45
#: Écart minimal brut/propre (somme des canaux) pour qu'un pixel compte comme
#: du texte effacé. Mesuré sur la paire de contrôle : les lettres dépassent
#: largement ce seuil même posées sur un tableau blanc, parce que l'image
#: propre a été repeinte à leur place, pas simplement éclaircie.
ECART_TEXTE_MIN = 120
#: Un emoji occupe un carré de ce côté, proportionnel à la hauteur d'x.
EMOJI_FRAC = 1.6
#: Interligne de repli quand la zone n'a qu'une ligne (× hauteur d'x).
INTERLIGNE_FRAC = 2.6
#: Interlettrage plausible, en em. Au-delà, c'est la mesure qui est fausse.
TRACKING_MIN_EM, TRACKING_MAX_EM = -0.05, 0.15
#: En deçà, on ne corrige pas l'interlettrage : l'écart est dans le bruit.
ERREUR_LARGEUR_MIN = 0.03
#: Contour de repli quand le LLM annonce un liseré que la mesure ne trouve pas.
CONTOUR_FRAC = 0.06


# ---------------------------------------------------------------------------
# Police : repli glyphe par glyphe
# ---------------------------------------------------------------------------

_cache_cmap: dict[str, set[int]] = {}
_cache_police: dict[tuple[str, int], ImageFont.FreeTypeFont] = {}


def _cmap(nom: str) -> set[int] | None:
    """Codes couverts par une police, ou None si on ne peut pas les lire.

    fontTools donne la table exacte. S'il manque — un `requirements.txt`
    incomplet a déjà coûté une panne du moteur — on rend None : le repli se
    fera alors glyphe par glyphe en comparant le dessin à celui d'un caractère
    connu pour être absent. Une dépendance qui manque doit dégrader le rendu,
    jamais l'arrêter.
    """
    if nom not in _cache_cmap:
        try:
            from fontTools.ttLib import TTFont

            with TTFont(os.path.join(DOSSIER_POLICES, nom), lazy=True) as f:
                _cache_cmap[nom] = set(f.getBestCmap().keys())
        except Exception:
            _cache_cmap[nom] = None
    return _cache_cmap[nom]


def _charger(nom: str, taille: int) -> ImageFont.FreeTypeFont:
    cle = (nom, taille)
    if cle not in _cache_police:
        _cache_police[cle] = ImageFont.truetype(
            os.path.join(DOSSIER_POLICES, nom), max(1, taille)
        )
    return _cache_police[cle]


#: Zone à usage privé : aucune police ne la couvre, son dessin est donc
#: exactement celui du glyphe « caractère inconnu » de la police.
_INCONNU = "\ue000"
_cache_absent: dict[tuple[int, str], bool] = {}


def _absent_du_dessin(police: ImageFont.FreeTypeFont, c: str) -> bool:
    """Repli sans fontTools : ce qui se dessine comme l'inconnu est absent."""
    cle = (id(police), c)
    if cle not in _cache_absent:
        try:
            dessin, inconnu = police.getmask(c), police.getmask(_INCONNU)
            _cache_absent[cle] = (
                dessin.size == inconnu.size and bytes(dessin) == bytes(inconnu)
            )
        except Exception:
            _cache_absent[cle] = False
    return _cache_absent[cle]


class Police:
    """Une police, plus un repli pour les glyphes qu'elle n'a pas.

    Une flèche absente doit sortir dans la police de repli, jamais en tofu et
    jamais remplacée en silence par un autre caractère.
    """

    def __init__(self, nom: str, taille: float):
        self.nom = nom
        self.taille = max(1, int(round(taille)))
        self.principale = _charger(nom, self.taille)
        self.repli = _charger(POLICE_REPLI, self.taille)
        self.connus = _cmap(nom)

    def pour(self, c: str) -> ImageFont.FreeTypeFont:
        if self.connus is not None:
            return self.principale if ord(c) in self.connus else self.repli
        return self.repli if _absent_du_dessin(self.principale, c) else self.principale

    def avance(self, c: str) -> float:
        return self.pour(c).getlength(c)

    def hauteur_x(self) -> float:
        return -self.principale.getbbox("x", anchor="ls")[1]


def segmenter(texte: str) -> list[tuple[str, str]]:
    """Découpe en morceaux ('texte' | 'emoji')."""
    return [
        ("emoji" if RE_EMOJI.fullmatch(p) else "texte", p)
        for p in RE_EMOJI.split(texte)
        if p
    ]


def disposer(
    police: Police, texte: str, tracking: float, emoji: float
) -> tuple[list[tuple[str, str, float]], float, float]:
    """Position de chaque glyphe, largeur d'ENCRE et bord gauche de l'encre.

    C'est l'encre qui se mesure sur une image, pas la somme des avances : le
    dernier glyphe traîne son approche droite. Confondre les deux fausse la
    taille de quelques pour cent, systématiquement dans le même sens.
    """
    items: list[tuple[str, str, float]] = []
    x = 0.0
    for genre, morceau in segmenter(texte):
        if genre == "emoji":
            items.append(("emoji", morceau, x))
            x += emoji + tracking
            continue
        for c in morceau:
            items.append(("texte", c, x))
            x += police.avance(c) + tracking

    gauche = droite = None
    for genre, contenu, gx in items:
        if genre == "emoji":
            g, d = gx, gx + emoji
        elif contenu == " ":
            continue
        else:
            boite = police.pour(contenu).getbbox(contenu, anchor="ls")
            g, d = gx + boite[0], gx + boite[2]
        gauche = g if gauche is None else min(gauche, g)
        droite = d if droite is None else max(droite, d)
    if gauche is None:
        return items, 0.0, 0.0
    return items, droite - gauche, gauche


def largeur_encre(police: Police, texte: str, tracking: float, emoji: float) -> float:
    return disposer(police, texte, tracking, emoji)[1]


def couper_lignes(
    police: Police, texte: str, largeur_max: float, tracking: float, emoji: float
) -> list[str]:
    """Retour à la ligne gourmand, comme une zone de texte d'application.

    Les paragraphes vides sont conservés : dans l'image d'origine, un saut de
    paragraphe occupe une ligne pour de bon. Le supprimer tassait le bloc et
    faisait glisser tout ce qui suit vers le haut.
    """
    lignes: list[str] = []
    for paragraphe in texte.split("\n"):
        if not paragraphe.strip():
            lignes.append("")
            continue
        courante = ""
        for mot in paragraphe.split():
            essai = f"{courante} {mot}".strip()
            if not courante or largeur_encre(police, essai, tracking, emoji) <= largeur_max:
                courante = essai
            else:
                lignes.append(courante)
                courante = mot
        lignes.append(courante)
    while lignes and not lignes[0]:
        lignes.pop(0)
    while lignes and not lignes[-1]:
        lignes.pop()
    return lignes or [texte.strip()]


# ---------------------------------------------------------------------------
# Recalage brut → propre
# ---------------------------------------------------------------------------


@dataclass
class Recalage:
    """Portion du brut qui a survécu au recadrage, et l'échelle appliquée."""

    ox: float
    oy: float
    echelle: float

    def vers_propre(self, x: float, y: float) -> tuple[float, float]:
        return ((x - self.ox) * self.echelle, (y - self.oy) * self.echelle)


def recaler(taille_brut: tuple[int, int], taille_propre: tuple[int, int]) -> Recalage:
    """Transformation brut → propre, analytique.

    Inutile de la chercher par points d'intérêt : le pipeline la connaît. Il
    recadre en « cover » centré sur le ratio dominant du post, puis
    redimensionne sans jamais agrandir. À ratios égaux, la formule dégénère
    d'elle-même en échelle pure, translation nulle — ce que ferait un ORB bien
    réglé, sans son bruit ni sa dépendance.
    """
    bw, bh = taille_brut
    pw, ph = taille_propre
    if bw <= 0 or bh <= 0 or pw <= 0 or ph <= 0:
        return Recalage(0.0, 0.0, 1.0)
    r_cible, r_source = pw / ph, bw / bh
    if r_source > r_cible:  # le recadrage a rogné les côtés
        cw, ch = bh * r_cible, float(bh)
    else:  # il a rogné le haut et le bas
        cw, ch = float(bw), bw / r_cible
    return Recalage((bw - cw) / 2, (bh - ch) / 2, pw / cw)


@dataclass
class Paire:
    """Le brut ramené dans le cadre de l'image propre, et leur écart."""

    propre: Image.Image
    recale: np.ndarray
    ecart: np.ndarray
    recalage: Recalage
    taille_brut: tuple[int, int]

    def rect(self, zone: dict) -> tuple[int, int, int, int]:
        bw, bh = self.taille_brut
        xf, yf = float(zone.get("x", 0.0)), float(zone.get("y", 0.0))
        wf, hf = float(zone.get("w", 1.0)), float(zone.get("h", 1.0))
        x0, y0 = self.recalage.vers_propre(xf * bw, yf * bh)
        x1, y1 = self.recalage.vers_propre((xf + wf) * bw, (yf + hf) * bh)
        W, H = self.propre.size
        # La boîte du LLM est approximative : on l'élargit d'un cheveu pour ne
        # pas couper une ascendante au ras, pas plus — chaque pixel de marge
        # est une chance d'attraper du texte qui n'est pas celui de la zone.
        marge = max(6.0, (y1 - y0) * 0.02)
        return (
            max(0, min(W - 1, int(x0 - marge))),
            max(0, min(H - 1, int(y0 - marge))),
            max(1, min(W, int(x1 + marge))),
            max(1, min(H, int(y1 + marge))),
        )


def preparer(brut: Image.Image, propre: Image.Image) -> Paire:
    """Recale le brut sur l'image propre et calcule leur écart pixel à pixel."""
    brut = brut.convert("RGB")
    propre = propre.convert("RGB")
    r = recaler(brut.size, propre.size)
    bw, bh = brut.size
    recale = brut.resize(
        propre.size, Image.LANCZOS, box=(r.ox, r.oy, bw - r.ox, bh - r.oy)
    )
    # Cumul des trois canaux, pas leur maximum : un texte clair sur fond clair
    # ne se sépare que de quelques niveaux par canal, mais trois fois.
    ecart = np.abs(
        np.asarray(recale).astype(np.int16) - np.asarray(propre).astype(np.int16)
    ).sum(axis=2)
    return Paire(propre, np.asarray(recale), ecart, r, brut.size)


# ---------------------------------------------------------------------------
# Masque du texte
# ---------------------------------------------------------------------------


def hex_vers_rgb(couleur: str | None) -> tuple[int, int, int]:
    m = re.fullmatch(r"#?([0-9a-fA-F]{6})", (couleur or "").strip())
    if not m:
        return (255, 255, 255)
    n = int(m.group(1), 16)
    return ((n >> 16) & 255, (n >> 8) & 255, n & 255)


def masque_couleur(img: np.ndarray, cible: tuple[int, int, int], tol: int = TOL_COULEUR):
    """Pixels proches d'une couleur, en distance de Chebyshev."""
    return np.abs(img.astype(np.int16) - np.array(cible, dtype=np.int16)).max(axis=2) <= tol


def _voisinage(masque: np.ndarray, rayon: int, erosion: bool) -> np.ndarray:
    out = masque
    for _ in range(rayon):
        décalés = [
            np.roll(out, 1, axis=0), np.roll(out, -1, axis=0),
            np.roll(out, 1, axis=1), np.roll(out, -1, axis=1),
        ]
        out = np.logical_and.reduce([out, *décalés]) if erosion else np.logical_or.reduce([out, *décalés])
    return out


def eroder(masque: np.ndarray, rayon: int = 2) -> np.ndarray:
    return _voisinage(masque, rayon, True)


def dilater(masque: np.ndarray, rayon: int = 1) -> np.ndarray:
    return _voisinage(masque, rayon, False)


def couleur_exacte(crop: np.ndarray, masque: np.ndarray) -> tuple[int, int, int] | None:
    """Médiane des pixels du texte, après érosion.

    L'érosion enlève l'anticrénelage des bords, qui tire la médiane vers la
    couleur du fond — un blanc devient gris, un jaune devient terne.
    """
    coeur = eroder(masque, 2)
    if coeur.sum() < 24:
        coeur = masque
    if coeur.sum() == 0:
        return None
    pixels = crop[coeur]
    return tuple(int(v) for v in np.median(pixels, axis=0))


def couleur_du_texte(
    crop: np.ndarray, efface: np.ndarray, indice: tuple[int, int, int]
) -> tuple[int, int, int]:
    """Couleur réelle du texte, prise dans les pixels que le nettoyage a effacés.

    Le LLM donne une intention — « blanc », « orange » — pas une valeur : un
    orange annoncé #FF8C00 vaut #E8791A à l'écran, et une tolérance serrée
    autour de l'indice ne trouve alors plus rien. Parmi les pixels qui ont
    disparu au nettoyage, le remplissage est l'extrême : le plus clair si le
    texte est clair, le plus sombre s'il est sombre.
    """
    if not efface.any():
        return indice
    lum = crop.astype(np.int16).sum(axis=2)
    valeurs = lum[efface]
    clair = sum(indice) > 380
    seuil = np.percentile(valeurs, 92 if clair else 8)
    coeur = efface & ((lum >= seuil) if clair else (lum <= seuil))
    if coeur.sum() < 40:
        return indice
    return tuple(int(v) for v in np.median(crop[coeur], axis=0))


def masque_zone(paire: Paire, rect: tuple[int, int, int, int], couleur: str | None):
    """Pixels du texte : de la bonne couleur ET absents de l'image nettoyée.

    L'image propre a été débarrassée de ce texte et d'elle seule : ce qui est
    présent dans les deux ne peut pas être une lettre. C'est le filtre le plus
    sûr — sauf sur un texte clair posé sur un fond clair, où l'écart devient
    trop faible pour discriminer ; on retombe alors sur la couleur seule, et
    c'est le rejet des orphelins qui fait le tri.
    """
    x0, y0, x1, y1 = rect
    crop = paire.recale[y0:y1, x0:x1]
    efface = paire.ecart[y0:y1, x0:x1] > ECART_TEXTE_MIN
    exacte = couleur_du_texte(crop, efface, hex_vers_rgb(couleur))
    couleurs = masque_couleur(crop, exacte)
    filtre = couleurs & efface
    if filtre.sum() < couleurs.sum() * 0.15:
        return couleurs, crop, exacte
    return filtre, crop, exacte


# ---------------------------------------------------------------------------
# Lignes : bandes, rejet des parasites, géométrie verticale
# ---------------------------------------------------------------------------


@dataclass
class Ligne:
    """Une ligne de texte mesurée, en pixels de l'image propre."""

    y0: int
    y1: int
    x0: int
    x1: int
    base: float
    haut_x: float

    @property
    def largeur(self) -> float:
        return float(self.x1 - self.x0)

    @property
    def hauteur_x(self) -> float:
        return float(self.base - self.haut_x)

    @property
    def centre(self) -> float:
        return (self.x0 + self.x1) / 2


def bandes_horizontales(masque: np.ndarray, ecart: int = 6) -> list[tuple[int, int]]:
    """Bandes de rangées allumées. Une bande = une ligne de texte."""
    rangees = np.where(masque.any(axis=1))[0]
    if len(rangees) == 0:
        return []
    groupes, debut, precedent = [], rangees[0], rangees[0]
    for r in rangees[1:]:
        if r - precedent > ecart:
            groupes.append((int(debut), int(precedent)))
            debut = r
        precedent = r
    groupes.append((int(debut), int(precedent)))
    return groupes


def segments(masque: np.ndarray, y0: int, y1: int, ecart: int) -> list[tuple[int, int]]:
    """Segments horizontaux d'une bande, séparés par au moins `ecart` colonnes."""
    colonnes = np.where(masque[y0 : y1 + 1].any(axis=0))[0]
    if len(colonnes) == 0:
        return []
    runs, debut, precedent = [], colonnes[0], colonnes[0]
    for c in colonnes[1:]:
        if c - precedent > ecart:
            runs.append((int(debut), int(precedent)))
            debut = c
        precedent = c
    runs.append((int(debut), int(precedent)))
    return runs


def nettoyer_orphelins(
    masque: np.ndarray, y0: int, y1: int
) -> tuple[int, int] | None:
    """Étendue horizontale du texte, sans les pixels parasites de même couleur.

    Un vêtement clair, un reflet, un logo ont la couleur du texte. Ils
    apparaissent comme des segments isolés, séparés du texte par un grand vide.
    C'est l'erreur la plus coûteuse du burn : sur une slide de référence elle
    faisait passer une ligne de 648 à 1019 px, et la police calée dessus était
    fausse pour toute la slide.

    Les mots d'une même ligne sont séparés d'une espace, jamais d'un vide de
    l'ordre de la hauteur de la ligne : c'est ce qui sépare un mot d'un intrus.
    """
    hauteur = max(1, y1 - y0)
    runs = segments(masque, y0, y1, ecart=max(6, int(hauteur * 0.9)))
    if not runs:
        return None
    # Chaque groupe pèse son encre : le texte en a bien plus qu'un reflet.
    poids = [
        (int(masque[y0 : y1 + 1, a : b + 1].sum()), a, b) for a, b in runs
    ]
    _, a, b = max(poids)
    # On raccroche les groupes voisins qui pèsent leur part : un mot court en
    # fin de ligne reste du texte.
    total = max(p for p, _, _ in poids)
    for p, ga, gb in poids:
        if p >= total * 0.08 and min(abs(ga - b), abs(a - gb)) <= hauteur * 2.2:
            a, b = min(a, ga), max(b, gb)
    return a, b


def geometrie_ligne(masque: np.ndarray, y0: int, y1: int) -> tuple[float, float]:
    """Ligne de base et haut d'x d'une ligne.

    Le haut d'x est la rangée où le nombre de pixels explose : toutes les
    minuscules commencent à la même hauteur. La ligne de base est la dernière
    rangée où il est encore élevé, avant l'effondrement dû aux seules
    descendantes.
    """
    profil = masque[y0 : y1 + 1].sum(axis=1).astype(float)
    if profil.max() <= 0:
        return float(y1), float(y0)
    pic = profil.max()
    haut_x = y0 + int(np.argmax(profil > pic * 0.45))
    sous = np.where(profil > pic * 0.30)[0]
    base = y0 + int(sous.max())
    return float(base), float(haut_x)


def separer_soudees(
    masque: np.ndarray, bandes: list[tuple[int, int]]
) -> list[tuple[int, int]]:
    """Recoupe les bandes qui portent visiblement plusieurs lignes.

    Un contour épais comble l'espace entre deux lignes serrées et les soude en
    une seule bande. Le compte ne tombe alors plus juste — « 10 lignes lues
    pour 9 mesurées » — et tout le bloc glisse d'un interligne.

    La hauteur médiane des autres bandes dit combien de lignes une bande trop
    haute contient ; la coupure se fait là où l'encre est la plus rare, au
    voisinage de la position attendue.
    """
    hauteurs = sorted(y1 - y0 for y0, y1 in bandes)
    if not hauteurs:
        return bandes
    mediane = hauteurs[len(hauteurs) // 2]
    if mediane < 8:
        return bandes
    sorties: list[tuple[int, int]] = []
    for y0, y1 in bandes:
        hauteur = y1 - y0
        parts = int(round(hauteur / mediane))
        if parts < 2 or hauteur < mediane * 1.55:
            sorties.append((y0, y1))
            continue
        profil = masque[y0 : y1 + 1].sum(axis=1)
        coupes = [0]
        for k in range(1, parts):
            vise = int(hauteur * k / parts)
            fenetre = max(2, int(hauteur / parts * 0.25))
            bas, haut = max(1, vise - fenetre), min(hauteur, vise + fenetre)
            coupes.append(bas + int(np.argmin(profil[bas:haut])))
        coupes.append(hauteur)
        for a, b in zip(coupes, coupes[1:]):
            if b - a >= mediane * 0.45:
                sorties.append((y0 + a, y0 + b))
    return sorties


def mesurer_lignes(masque: np.ndarray, dx: int = 0, dy: int = 0) -> list[Ligne]:
    """Toutes les lignes d'un masque : triées, recoupées, nettoyées, mesurées.

    L'ordre compte. On écarte d'abord le bruit sur l'ENCRE — les restes de
    détourage sont nombreux et minuscules, ils domineraient toute médiane de
    hauteur — et seulement ensuite on recoupe les bandes trop hautes, une fois
    que la hauteur de référence est celle des vraies lignes.
    """
    bandes = [(y0, y1) for y0, y1 in bandes_horizontales(masque) if y1 - y0 >= 4]
    if not bandes:
        return []
    encres = [int(masque[y0 : y1 + 1].sum()) for y0, y1 in bandes]
    plancher = max(encres) * 0.15
    solides = [b for b, e in zip(bandes, encres) if e >= plancher]
    if not solides:
        return []

    lignes: list[Ligne] = []
    for y0, y1 in separer_soudees(masque, solides):
        etendue = nettoyer_orphelins(masque, y0, y1)
        if etendue is None:
            continue
        x0, x1 = etendue
        base, haut_x = geometrie_ligne(masque[:, x0 : x1 + 1], y0, y1)
        lignes.append(
            Ligne(
                y0=y0 + dy, y1=y1 + dy, x0=x0 + dx, x1=x1 + 1 + dx,
                base=base + dy, haut_x=haut_x + dy,
            )
        )
    return [l for l in lignes if l.largeur > 8]


@dataclass
class Pastille:
    """Boîte pleine posée derrière une ligne de texte (style TikTok « fond »)."""

    couleur: tuple[int, int, int]
    marge_x: float
    marge_y: float
    rayon: float


def region_pleine(masque: np.ndarray, y0: int, y1: int) -> np.ndarray:
    """Surface de la pastille : chaque rangée comblée d'un bord à l'autre.

    Le masque de la pastille est troué — ce sont les lettres. Reboucher rangée
    par rangée redonne la boîte, coins arrondis compris, sans aller chercher
    une bibliothèque de morphologie.
    """
    region = np.zeros_like(masque)
    for y in range(y0, min(y1 + 1, masque.shape[0])):
        colonnes = np.where(masque[y])[0]
        if colonnes.size:
            region[y, colonnes[0] : colonnes[-1] + 1] = True
    return region


def _geometrie_pastille(
    region: np.ndarray, lettres: np.ndarray, y0: int, y1: int
) -> tuple[float, float, float] | None:
    """Marges et rayon d'une pastille, depuis sa surface et ses lettres."""
    ys, xs = np.nonzero(lettres[y0 : y1 + 1])
    if ys.size < 30:
        return None
    largeurs = region[y0 : y1 + 1].sum(axis=1)
    pleine = largeurs.max()
    if pleine <= 0:
        return None
    colonnes = np.where(region[y0 : y1 + 1].any(axis=0))[0]
    bx0, bx1 = int(colonnes[0]), int(colonnes[-1])
    marge_x = min(xs.min() - 0, bx1 - bx0 - xs.max())
    marge_y = min(ys.min(), (y1 - y0) - ys.max())
    # Un coin arrondi de rayon r rétrécit la première rangée de 2r.
    haut = largeurs[1] if len(largeurs) > 1 else largeurs[0]
    rayon = max(0.0, float(pleine - haut) / 2)
    return float(max(0, marge_x)), float(max(0, marge_y)), min(rayon, (y1 - y0) / 2)


def demonter_pastille(
    crop: np.ndarray, masque: np.ndarray, bandes: list[tuple[int, int]]
) -> tuple[np.ndarray, tuple[int, int, int], Pastille] | None:
    """Le LLM a donné la couleur de la BOÎTE : sort les lettres de dedans.

    C'est elle qui saute aux yeux, pas les lettres — le LLM annonce donc
    souvent « blanc » pour un texte noir sur pastille blanche. Une ligne de
    texte noircit un tiers de sa boîte, une pastille la remplit : la différence
    est franche, et le négatif à l'intérieur donne les lettres.
    """
    lettres = np.zeros_like(masque)
    marges_x, marges_y, rayons, dedans = [], [], [], []
    for y0, y1 in bandes:
        if y1 - y0 < 10:
            continue
        region = region_pleine(masque, y0, y1)
        surface = region[y0 : y1 + 1]
        # Une ligne de texte noircit un tiers de sa surface ligne à ligne, une
        # pastille les trois quarts : le seuil tombe dans un vrai creux, il
        # n'est pas un réglage à ajuster au cas par cas.
        if surface.sum() < 400 or masque[y0 : y1 + 1].sum() / surface.sum() < 0.62:
            continue
        creux = surface & ~masque[y0 : y1 + 1]
        creux = creux & eroder(region, 3)[y0 : y1 + 1]
        if creux.sum() < 40:
            continue
        lettres[y0 : y1 + 1] = creux
        dedans.append(crop[y0 : y1 + 1][creux])
        mesure = _geometrie_pastille(region, lettres, y0, y1)
        if mesure:
            marges_x.append(mesure[0])
            marges_y.append(mesure[1])
            rayons.append(mesure[2])
    if not dedans or not marges_x:
        return None
    return (
        lettres,
        tuple(int(v) for v in np.median(np.concatenate(dedans), axis=0)),
        Pastille(
            couleur=tuple(int(v) for v in np.median(crop[masque], axis=0)),
            marge_x=float(np.median(marges_x)),
            marge_y=float(np.median(marges_y)),
            rayon=float(np.median(rayons)),
        ),
    )


def pastille_derriere(
    crop: np.ndarray, lettres: np.ndarray, lignes: list["Ligne"], dx: int, dy: int
) -> Pastille | None:
    """Le LLM a donné la couleur des LETTRES : cherche la boîte derrière elles.

    Le pourtour immédiat d'un texte posé sur photo est bariolé ; posé sur une
    pastille, il est d'un seul ton. C'est ce que regarde cette fonction, et
    c'est ce qui distingue les deux cas sans rien demander de plus au LLM.
    """
    if not lignes:
        return None
    hauteur = float(np.median([l.hauteur_x for l in lignes]))
    autour = dilater(lettres, max(2, int(hauteur * 0.35))) & ~lettres
    if autour.sum() < 200:
        return None
    pixels = crop[autour]
    if float(pixels.std(axis=0).mean()) > 20:
        return None  # fond bariolé : c'est une photo, pas une pastille
    fond = tuple(int(v) for v in np.median(pixels, axis=0))

    region = masque_couleur(crop, fond, tol=38) | lettres
    marges_x, marges_y, rayons = [], [], []
    for ligne in lignes:
        y0, y1 = ligne.y0 - dy, ligne.y1 - dy
        pleine = region_pleine(region, max(0, y0 - int(hauteur)), min(region.shape[0] - 1, y1 + int(hauteur)))
        mesure = _geometrie_pastille(pleine, lettres, max(0, y0 - int(hauteur)), min(region.shape[0] - 1, y1 + int(hauteur)))
        if mesure:
            marges_x.append(mesure[0])
            marges_y.append(mesure[1])
            rayons.append(mesure[2])
    if not marges_x:
        return None
    # Une « pastille » aussi large que l'image est un mur, pas une boîte.
    if float(np.median(marges_x)) > crop.shape[1] * 0.25:
        return None
    return Pastille(
        couleur=fond,
        marge_x=float(np.median(marges_x)),
        marge_y=float(np.median(marges_y)),
        rayon=float(np.median(rayons)),
    )


def lignes_de_la_zone(
    lignes: list[Ligne],
    rect: tuple[int, int, int, int],
    origine: list[str],
    nom_police: str = POLICE_700,
) -> list[Ligne]:
    """Parmi les lignes trouvées, celles qui sont vraiment celles de la zone.

    La boîte du LLM est approximative et les zones se touchent : la mesure
    ramasse volontiers la ligne du bloc voisin, et un décalage d'une seule
    ligne fait glisser tout le bloc d'un interligne.

    Le bon critère n'est ni la position ni la régularité, c'est l'ÉCHELLE : le
    bon alignement est celui où toutes les lignes s'accordent sur un seul
    facteur entre leur largeur mesurée et la largeur naturelle de leur texte.
    Un décalage d'une ligne fait diverger ces rapports aussitôt.
    """
    attendu = len(origine)
    if attendu <= 0 or len(lignes) <= attendu:
        return lignes
    police = Police(nom_police, SONDE)
    naturelles = [largeur_encre(police, t, 0.0, 0.0) for t in origine]
    centre_zone = (rect[1] + rect[3]) / 2
    hauteur_zone = max(1.0, float(rect[3] - rect[1]))
    meilleur = None
    for debut in range(len(lignes) - attendu + 1):
        fenetre = lignes[debut : debut + attendu]
        rapports = [
            ligne.largeur / naturelle
            for ligne, naturelle, texte in zip(fenetre, naturelles, origine)
            if naturelle > 0 and len(texte) > 3
        ]
        if len(rapports) >= 2:
            dispersion = float(np.std(rapports)) / max(1e-6, float(np.mean(rapports)))
        else:
            dispersion = 1.0
        distance = abs((fenetre[0].base + fenetre[-1].base) / 2 - centre_zone) / hauteur_zone
        note = dispersion + distance * 0.5
        if meilleur is None or note < meilleur[0]:
            meilleur = (note, fenetre)
    return meilleur[1] if meilleur else lignes


def alignement(lignes: list[Ligne]) -> str:
    """Gauche, centre ou droite : la dispersion la plus faible gagne.

    Ne jamais s'en remettre à l'œil : un bloc centré dont les lignes ont des
    longueurs proches ressemble à un bloc ferré à gauche.
    """
    if len(lignes) < 2:
        return "center"
    etendue = lambda v: max(v) - min(v)
    scores = {
        "left": etendue([l.x0 for l in lignes]),
        "center": etendue([l.centre for l in lignes]),
        "right": etendue([l.x1 for l in lignes]),
    }
    return min(scores, key=scores.get)


def interligne(lignes: list[Ligne]) -> float:
    """Écart de ligne de base à ligne de base.

    Mesuré de la première à la dernière puis divisé : l'erreur se divise
    d'autant. Entre deux lignes voisines, elle resterait entière.
    """
    if len(lignes) < 2:
        return lignes[0].hauteur_x * INTERLIGNE_FRAC if lignes else 0.0
    return (lignes[-1].base - lignes[0].base) / (len(lignes) - 1)


#: Largeur de la bande fouillée autour des lettres, en pixels.
HALO = 14


def mesurer_contour(crop: np.ndarray, masque: np.ndarray, *_ignore) -> float:
    """Épaisseur du liseré sombre, par le rapport aire / périmètre.

    Un contour d'épaisseur w autour d'une forme de périmètre P couvre à peu
    près P × w pixels : le rapport donne w directement. Cet estimateur ne
    dépend pas du chemin suivi depuis une lettre — donc ni des lettres qui se
    touchent, ni de la rampe d'anticrénelage, qu'il compte simplement pour
    moitié.

    Il reste biaisé (le seuil du masque ronge le bord des lettres), mais le
    même estimateur sert sur l'original et sur le rendu de contrôle : c'est là
    que le biais s'annule, pas ici.
    """
    if masque.sum() < 40:
        return 0.0
    perimetre = masque & ~eroder(masque, 1)
    p = int(perimetre.sum())
    if p < 20:
        return 0.0
    halo = dilater(masque, HALO) & ~masque
    if not halo.any():
        return 0.0
    sombre = crop.astype(np.int16).sum(axis=2) < 230
    # Un fond déjà sombre rendrait la mesure absurde. On le juge LOIN des
    # lettres : tout près, c'est le contour lui-même qui noircit, et s'en
    # servir comme garde-fou reviendrait à écarter les contours épais, ceux
    # qu'on cherche justement à mesurer.
    loin = dilater(masque, HALO * 2) & ~dilater(masque, HALO)
    if loin.any() and float((sombre & loin).sum()) / float(loin.sum()) > 0.6:
        return 0.0
    return float((sombre & halo).sum()) / p


# ---------------------------------------------------------------------------
# Calibration : taille, graisse, interlettrage
# ---------------------------------------------------------------------------

SONDE = 100.0


def taille_par_largeur(
    nom: str, echantillons: list[tuple[str, float]]
) -> tuple[float, list[float]] | None:
    """Taille qui reproduit les largeurs mesurées, à interlettrage NUL.

    Surtout pas par la hauteur d'x : le seuil du masque la gonfle de deux ou
    trois pixels de chaque côté sur du texte adouci par la compression. Une
    taille calée dessus est trop grande de 8 à 10 %, et le tracking négatif
    qu'il faut alors pour retomber sur la bonne largeur colle les mots entre
    eux. La largeur, elle, porte des dizaines de glyphes : le seuil s'y dilue.
    """
    police = Police(nom, SONDE)
    emoji = police.hauteur_x() * EMOJI_FRAC
    ratios = []
    for texte, cible in echantillons:
        largeur = largeur_encre(police, texte, 0.0, emoji)
        if largeur > 0 and cible > 0:
            ratios.append(cible / largeur)
    if not ratios:
        return None
    # Une ligne mal mesurée donne un ratio isolé : la médiane l'ignore, et on
    # écarte franchement ce qui s'en éloigne de plus de 8 %.
    mediane = float(np.median(ratios))
    gardes = [r for r in ratios if abs(r - mediane) / mediane <= 0.08] or [mediane]
    return SONDE * float(np.mean(gardes)), [round(r, 3) for r in ratios]


def choisir_graisse(
    echantillons: list[tuple[str, float]], hauteur_x: float
) -> tuple[str, float, dict[str, float]]:
    """Entre deux graisses, celle dont les proportions collent au modèle.

    Pour chaque candidate : la taille déduite de la largeur, et celle déduite
    de la hauteur d'x. Leur rapport dit si la police a les bonnes proportions.
    Le score ne distingue pas deux polices de mêmes proportions — ici il ne
    tranche qu'entre deux graisses de la même famille, ce qu'il sait faire.
    """
    scores: dict[str, float] = {}
    tailles: dict[str, float] = {}
    for nom in (POLICE_700, POLICE_600):
        par_largeur = taille_par_largeur(nom, echantillons)
        if par_largeur is None:
            continue
        taille, _ = par_largeur
        sonde = Police(nom, 1000)
        par_hauteur = hauteur_x / (sonde.hauteur_x() / 1000.0) if hauteur_x > 0 else taille
        tailles[nom] = taille
        scores[nom] = abs(taille / par_hauteur - 1.0) if par_hauteur > 0 else 1.0
    if not scores:
        return POLICE_700, 0.0, {}
    gagnante = min(scores, key=scores.get)
    return gagnante, tailles[gagnante], {k: round(v, 3) for k, v in scores.items()}


def ajuster_tracking(
    police: Police, echantillons: list[tuple[str, float]], emoji: float
) -> float:
    """Interlettrage, seulement si la taille seule n'explique pas les largeurs.

    Un tracking introduit pour rattraper trois pour cent d'erreur est du bruit
    déguisé en réglage ; au-delà, c'est une vraie caractéristique du texte.
    """
    erreurs, ecarts = [], []
    for texte, cible in echantillons:
        largeur = largeur_encre(police, texte, 0.0, emoji)
        glyphes = sum(1 for _ in _glyphes(texte))
        if largeur <= 0 or glyphes < 2:
            continue
        erreurs.append(abs(cible - largeur) / cible)
        ecarts.append((cible - largeur) / (glyphes - 1))
    if not ecarts or float(np.median(erreurs)) < ERREUR_LARGEUR_MIN:
        return 0.0
    tracking = float(np.median(ecarts))
    return max(TRACKING_MIN_EM * police.taille, min(TRACKING_MAX_EM * police.taille, tracking))


def _glyphes(texte: str):
    for genre, morceau in segmenter(texte):
        if genre == "emoji":
            yield morceau
        else:
            yield from morceau


def boite_de_coupe(
    police: Police, lignes_origine: list[str], tracking: float, emoji: float
) -> float:
    """Largeur de la zone de texte de l'application d'origine.

    Elle est inconnue, mais encadrée : au moins la ligne la plus large, au plus
    cette ligne augmentée du premier mot de la suivante — ce mot n'y tenait
    pas. On prend la valeur de l'intervalle qui redonne EXACTEMENT les coupures
    d'origine ; si aucune ne le fait, le milieu.
    """
    largeurs = [largeur_encre(police, l, tracking, emoji) for l in lignes_origine]
    if not largeurs:
        return 0.0
    basse = max(largeurs)
    i = int(np.argmax(largeurs))
    haute = basse * 1.12
    if i + 1 < len(lignes_origine):
        suite = lignes_origine[i + 1].split()
        if suite:
            haute = largeur_encre(
                police, f"{lignes_origine[i]} {suite[0]}", tracking, emoji
            )
    if haute <= basse:
        haute = basse * 1.12

    texte = " ".join(lignes_origine)
    for part in (0.5, 0.35, 0.65, 0.2, 0.8):
        essai = basse + (haute - basse) * part
        if couper_lignes(police, texte, essai, tracking, emoji) == lignes_origine:
            return essai
    return (basse + haute) / 2


# ---------------------------------------------------------------------------
# Le style d'une zone : ce que la mesure a conclu
# ---------------------------------------------------------------------------


@dataclass
class Style:
    """Contrat entre la mesure et le rendu. Tout est en pixels du propre."""

    police: str
    taille: float
    tracking: float
    couleur: tuple[int, int, int]
    alignement: str
    ancre_x: float
    base: float
    interligne: float
    largeur_boite: float
    contour: float = 0.0
    couleur_contour: tuple[int, int, int] = (0, 0, 0)
    pastille: "Pastille | None" = None
    ombre: dict = field(default_factory=dict)
    hauteur_x: float = 0.0
    mesure: bool = True
    lignes_origine: list[str] = field(default_factory=list)
    lignes_mesurees: list[Ligne] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)
    #: Masque mesuré sur l'original, et de quoi le recomparer après rendu.
    reference: np.ndarray | None = None
    rect: tuple[int, int, int, int] = (0, 0, 0, 0)
    echantillons: list[tuple[str, float]] = field(default_factory=list)

    @property
    def emoji(self) -> float:
        return self.hauteur_x * EMOJI_FRAC


def analyser_zone(paire: Paire, zone: dict, gras: bool = True) -> Style:
    """Mesure une zone de la slide d'origine et en tire un style."""
    rect = paire.rect(zone)
    x0, y0, x1, y1 = rect
    notes: list[str] = []
    origine = (zone.get("texte") or "").strip()
    # Les paragraphes vides sont gardés : dans l'image, un saut de paragraphe
    # occupe une ligne. Les retirer tassait le bloc rendu contre le mesuré et
    # faisait échouer l'appariement sur toutes les slides bavardes.
    lignes_origine = [l.strip() for l in origine.split("\n")]
    while lignes_origine and not lignes_origine[0]:
        lignes_origine.pop(0)
    while lignes_origine and not lignes_origine[-1]:
        lignes_origine.pop()
    pleines = [l for l in lignes_origine if l]

    if x1 - x0 < 8 or y1 - y0 < 8:
        return _style_de_repli(paire, rect, zone, gras, ["zone trop petite"])

    masque, crop, couleur = masque_zone(paire, rect, zone.get("couleur"))
    pastille = demonter_pastille(crop, masque, bandes_horizontales(masque))
    if pastille is not None:
        masque, couleur, boite = pastille
        notes.append(
            f"texte sur pastille {'#%02X%02X%02X' % boite.couleur} "
            f"(marges {boite.marge_x:.0f}×{boite.marge_y:.0f}, rayon {boite.rayon:.0f})"
        )
    toutes = mesurer_lignes(masque, dx=x0, dy=y0)
    if not toutes:
        return _style_de_repli(paire, rect, zone, gras, ["aucun pixel de texte mesurable"])
    lignes = lignes_de_la_zone(toutes, rect, pleines, POLICE_700 if gras else POLICE_600)
    if len(lignes) < len(toutes):
        notes.append(f"{len(toutes) - len(lignes)} ligne(s) hors zone écartée(s)")

    # L'autre sens : le LLM a donné la couleur des lettres, et il y a peut-être
    # une pastille derrière elles.
    pastille_mesuree = (
        pastille[2] if pastille is not None
        else pastille_derriere(crop, masque, lignes, x0, y0)
    )
    if pastille is None and pastille_mesuree is not None:
        notes.append(
            f"pastille détectée derrière le texte "
            f"{'#%02X%02X%02X' % pastille_mesuree.couleur} "
            f"(marges {pastille_mesuree.marge_x:.0f}×{pastille_mesuree.marge_y:.0f}, "
            f"rayon {pastille_mesuree.rayon:.0f})"
        )

    hauteur_x = float(np.median([l.hauteur_x for l in lignes]))

    # Deux tailles dans un même bloc : la hauteur d'x le dit. On cale sur le
    # groupe dominant plutôt que sur une moyenne qui ne conviendrait à aucun.
    groupe = [l for l in lignes if abs(l.hauteur_x - hauteur_x) <= hauteur_x * 0.18]
    if len(groupe) < len(lignes):
        notes.append(
            f"tailles multiples dans la zone ({len(lignes) - len(groupe)} ligne(s) à l'écart)"
        )

    # La calibration apparie ligne d'origine et ligne mesurée : sans
    # correspondance une pour une, elle mesurerait n'importe quoi.
    appariables = len(pleines) == len(lignes)
    if not appariables:
        notes.append(
            f"{len(pleines)} ligne(s) lues par le LLM pour {len(lignes)} mesurée(s)"
        )
    echantillons = [
        (pleines[i], lignes[i].largeur)
        for i in range(len(lignes))
        if appariables
        and len(pleines[i]) > 3
        and not RE_EMOJI.search(pleines[i])
        and lignes[i] in groupe
    ]

    if echantillons:
        nom, taille, scores = choisir_graisse(echantillons, hauteur_x)
        del scores  # le recouvrement des masques tranchera mieux, après rendu
    else:
        nom = POLICE_700 if gras else POLICE_600
        sonde = Police(nom, 1000)
        taille = hauteur_x / (sonde.hauteur_x() / 1000.0)
        notes.append("taille calée sur la hauteur d'x, faute de lignes appariables")

    police = Police(nom, taille)
    emoji = hauteur_x * EMOJI_FRAC
    tracking = ajuster_tracking(police, echantillons, emoji) if echantillons else 0.0

    align = alignement(lignes)
    ancre_x = (
        min(l.x0 for l in lignes)
        if align == "left"
        else max(l.x1 for l in lignes)
        if align == "right"
        else float(np.mean([l.centre for l in lignes]))
    )

    contour = 0.0 if pastille_mesuree is not None else mesurer_contour(crop, masque)
    if contour <= 0 and pastille_mesuree is None and zone.get("ombre"):
        contour = hauteur_x * CONTOUR_FRAC
        notes.append("contour non mesuré, repli sur le signalement du LLM")

    largeur_boite = (
        boite_de_coupe(police, pleines, tracking, emoji)
        if appariables and len(pleines) > 1
        else max(l.largeur for l in lignes) * 1.06
    )

    style = Style(
        police=nom,
        taille=taille,
        tracking=tracking,
        couleur=couleur,
        alignement=align,
        ancre_x=ancre_x,
        base=lignes[0].base,
        interligne=interligne(lignes),
        largeur_boite=largeur_boite,
        contour=contour,
        pastille=pastille_mesuree,
        # Sans contour ni pastille, un texte clair sur photo tient par une
        # ombre discrète — avec pastille, le fond fait déjà ce travail.
        ombre={} if contour > 0 or pastille_mesuree is not None else {"alpha": 0.38, "blur": max(2, hauteur_x * 0.06), "dx": 0, "dy": max(1, hauteur_x * 0.03)},
        hauteur_x=hauteur_x,
        mesure=True,
        lignes_origine=lignes_origine,
        lignes_mesurees=lignes,
        notes=notes,
    )
    haut = int(max(0, min(l.y0 for l in lignes) - y0 - hauteur_x))
    bas = int(min(masque.shape[0], max(l.y1 for l in lignes) - y0 + hauteur_x))
    borne = np.zeros_like(masque)
    borne[haut:bas] = masque[haut:bas]
    style.reference = borne
    style.rect = rect
    style.echantillons = echantillons
    return style


def _style_de_repli(
    paire: Paire, rect: tuple[int, int, int, int], zone: dict, gras: bool, notes: list[str]
) -> Style:
    """Rien de mesurable : on se cale sur la boîte donnée par le LLM."""
    x0, y0, x1, y1 = rect
    nb = max(1, int(zone.get("nbLignes") or 1))
    inter = (y1 - y0) / nb
    hauteur_x = inter / INTERLIGNE_FRAC
    nom = POLICE_700 if gras else POLICE_600
    sonde = Police(nom, 1000)
    return Style(
        police=nom,
        taille=hauteur_x / (sonde.hauteur_x() / 1000.0),
        tracking=0.0,
        couleur=hex_vers_rgb(zone.get("couleur")),
        alignement="center",
        ancre_x=(x0 + x1) / 2,
        base=y0 + inter * 0.78,
        interligne=inter,
        largeur_boite=float(x1 - x0),
        contour=hauteur_x * CONTOUR_FRAC if zone.get("ombre") else 0.0,
        ombre={} if zone.get("ombre") else {"alpha": 0.38, "blur": 3, "dx": 0, "dy": 2},
        hauteur_x=hauteur_x,
        mesure=False,
        notes=notes,
    )


# ---------------------------------------------------------------------------
# Rendu
# ---------------------------------------------------------------------------

_cache_emoji: dict[str, Image.Image | None] = {}


def image_emoji(sequence: str) -> Image.Image | None:
    cle = "-".join(f"{ord(c):x}" for c in sequence if c not in ("️",))
    if not cle:
        return None
    if cle in _cache_emoji:
        return _cache_emoji[cle]
    img: Image.Image | None = None
    for candidat in dict.fromkeys([cle, cle.split("-")[0]]):
        try:
            with urllib.request.urlopen(f"{CDN_EMOJI}/{candidat}.png", timeout=8) as r:
                img = Image.open(io.BytesIO(r.read())).convert("RGBA")
            break
        except Exception:
            continue
    _cache_emoji[cle] = img
    return img


def _bases(style: Style, nb: int) -> list[float]:
    """Ligne de base de chaque ligne, ancrée sur celle de l'original.

    Ancrer par le haut du texte serait faux : les accents français montent plus
    haut que les capitales anglaises et décaleraient toute la ligne. Quand la
    traduction prend une ligne de plus, le bloc remonte d'un demi-interligne
    pour rester centré au même endroit.
    """
    origine = len(style.lignes_origine) or nb
    decalage = -(nb - origine) * style.interligne / 2
    return [style.base + decalage + i * style.interligne for i in range(nb)]


def calques(
    taille: tuple[int, int], lignes: list[str], style: Style, rapide: bool = False
) -> tuple[Image.Image, Image.Image, Image.Image]:
    """Masques du remplissage et du contour, plus le calque des emojis.

    On ne dessine jamais en couleur directement : des masques en niveaux de
    gris, dessinés trois fois plus grand puis réduits, donnent des bords nets
    et un contour qui ne mange pas le remplissage.
    """
    W, H = taille
    # Le supersampling ne sert qu'à la netteté des bords ; pendant la recherche
    # de taille, seule la forme compte et chaque rendu est payé douze fois.
    s = 1 if rapide else SUPERSAMPLE
    remplissage = Image.new("L", (W * s, H * s), 0)
    contour = Image.new("L", (W * s, H * s), 0)
    fond = Image.new("L", (W * s, H * s), 0)
    emojis = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    dr = ImageDraw.Draw(remplissage)
    dc = ImageDraw.Draw(contour)
    df = ImageDraw.Draw(fond)

    police = Police(style.police, style.taille * s)
    emoji_px = style.emoji
    trait = int(round(style.contour * s))

    for ligne, base in zip(lignes, _bases(style, len(lignes))):
        if not ligne:
            continue
        items, largeur, gauche = disposer(
            police, ligne, style.tracking * s, emoji_px * s
        )
        if style.alignement == "left":
            depart = style.ancre_x * s - gauche
        elif style.alignement == "right":
            depart = style.ancre_x * s - largeur - gauche
        else:
            depart = style.ancre_x * s - largeur / 2 - gauche
        y = base * s
        if style.pastille is not None:
            # La boîte se cale sur l'encre de SA ligne, comme dans l'original :
            # une pastille par ligne, jamais un bandeau unique.
            p = style.pastille
            haut = y - (style.hauteur_x + p.marge_y) * s
            bas = y + (style.hauteur_x * 0.32 + p.marge_y) * s
            df.rounded_rectangle(
                [depart + gauche - p.marge_x * s, haut,
                 depart + gauche + largeur + p.marge_x * s, bas],
                radius=max(0.0, p.rayon * s),
                fill=255,
            )
        for genre, contenu, x in items:
            if genre == "emoji":
                vignette = image_emoji(contenu)
                if vignette is not None:
                    cote = max(1, int(round(emoji_px)))
                    emojis.alpha_composite(
                        vignette.resize((cote, cote), Image.LANCZOS),
                        (
                            int(round((depart + x) / s)),
                            int(round(base - emoji_px * 0.82)),
                        ),
                    )
                continue
            if contenu == " ":
                continue
            f = police.pour(contenu)
            if trait:
                dc.text(
                    (depart + x, y), contenu, font=f, anchor="ls", fill=255,
                    stroke_width=trait, stroke_fill=255,
                )
            dr.text((depart + x, y), contenu, font=f, anchor="ls", fill=255)

    return (
        remplissage.resize((W, H), Image.LANCZOS),
        contour.resize((W, H), Image.LANCZOS),
        emojis,
        fond.resize((W, H), Image.LANCZOS),
    )


def dessiner(
    fond: Image.Image, lignes: list[str], style: Style, rapide: bool = False
) -> Image.Image:
    """Incruste les lignes sur l'image, ombre puis contour puis remplissage."""
    W, H = fond.size
    remplissage, contour, emojis, pastilles = calques((W, H), lignes, style, rapide)
    img = fond.convert("RGBA")

    if style.pastille is not None:
        img = Image.composite(
            Image.new("RGBA", (W, H), style.pastille.couleur + (255,)), img, pastilles
        )

    if style.ombre:
        o = style.ombre
        ombre = remplissage.filter(ImageFilter.GaussianBlur(float(o.get("blur", 3))))
        ombre = ombre.point(lambda v: int(v * float(o.get("alpha", 0.38))))
        ombre = ombre.transform(
            ombre.size, Image.AFFINE,
            (1, 0, -float(o.get("dx", 0)), 0, 1, -float(o.get("dy", 2))),
        )
        img = Image.composite(Image.new("RGBA", (W, H), (0, 0, 0, 255)), img, ombre)

    if style.contour > 0:
        img = Image.composite(
            Image.new("RGBA", (W, H), style.couleur_contour + (255,)), img, contour
        )
    img = Image.composite(Image.new("RGBA", (W, H), style.couleur + (255,)), img, remplissage)
    img.alpha_composite(emojis)
    return img


# ---------------------------------------------------------------------------
# Contrôle : redessiner l'original et re-mesurer avec le même code
# ---------------------------------------------------------------------------


def _decale(style: Style, dx: float, dy: float) -> Style:
    """Le même style, exprimé dans le repère d'un recadrage."""
    copie = Style(**{**style.__dict__})
    copie.ancre_x -= dx
    copie.base -= dy
    return copie


def _mesurer_rendu(
    paire: Paire,
    style: Style,
    lignes: list[str],
    rect: tuple[int, int, int, int],
    rapide: bool = False,
) -> tuple[list[Ligne], float, np.ndarray]:
    """Dessine ces lignes sur l'image propre et les re-mesure comme l'original.

    Sur le vrai fond, avec le même estimateur : c'est la seule comparaison qui
    ait un sens. Les biais du seuillage — qui gonflent la hauteur d'x et
    mangent le bord des lettres — sont les mêmes des deux côtés et s'annulent.
    """
    x0, y0, x1, y1 = rect
    fond = paire.propre.crop(rect)
    rendu = dessiner(fond, lignes, _decale(style, x0, y0), rapide)
    arr = np.asarray(rendu.convert("RGB"))
    # Même filtre que sur l'original : couleur ET écart avec l'image propre.
    # Sans lui, un tableau blanc derrière le texte entrerait dans la mesure de
    # contrôle alors qu'il est écarté de la mesure de référence, et les deux ne
    # seraient plus comparables.
    ecart = np.abs(arr.astype(np.int16) - np.asarray(fond.convert("RGB")).astype(np.int16)).sum(axis=2)
    masque = masque_couleur(arr, style.couleur) & (ecart > ECART_TEXTE_MIN)
    mesurees = mesurer_lignes(masque)
    return mesurees, mesurer_contour(arr, masque), masque


def calibrer_contour(
    paire: Paire, style: Style, rect: tuple[int, int, int, int], cible: float
) -> float:
    """Épaisseur de contour qui, une fois rendue, se mesure comme l'original.

    Mesurée directement, l'épaisseur est surestimée : la marche depuis le bord
    de la lettre traverse d'abord la rampe d'anticrénelage. Plutôt que de
    corriger ce biais à la main, on rend deux essais et on interpole — le biais
    est dans les deux mesures et disparaît.
    """
    if cible <= 0 or not style.lignes_origine:
        return 0.0
    essais: list[tuple[float, float]] = []
    for facteur in (0.75, 0.35):
        essai = max(0.5, cible * facteur)
        style.contour = essai
        _, mesure, _ = _mesurer_rendu(paire, style, style.lignes_origine, rect)
        essais.append((essai, mesure))
    (s1, m1), (s2, m2) = essais
    if abs(m1 - m2) < 1e-6:
        return max(0.0, cible * 0.5)
    pente = (s1 - s2) / (m1 - m2)
    trouve = s2 + (cible - m2) * pente
    return float(max(0.0, min(cible * 1.5, trouve)))


def ressemblance(reference: np.ndarray, rendu: np.ndarray) -> float:
    """Recouvrement des deux masques de texte (intersection sur union).

    Le score de proportions ne distingue pas deux polices de mêmes largeurs ;
    le recouvrement, lui, compare les formes là où elles sont — c'est le
    verdict visuel, rendu chiffrable et reproductible.
    """
    inter = int((reference & rendu).sum())
    union = int((reference | rendu).sum())
    return inter / union if union else 0.0


def _juger(
    paire: Paire, style: Style, rect: tuple[int, int, int, int], rapide: bool = True
) -> tuple[float, float]:
    """Rend le texte d'origine et note le résultat : largeur d'abord, forme ensuite.

    Les deux critères ne mesurent pas la même chose. La largeur des lignes est
    ce qui décide de la livraison ; le recouvrement dit si les FORMES sont les
    bonnes, ce que la largeur ne voit pas. On garde donc la largeur comme juge
    et le recouvrement comme départage — l'inverse faisait retenir une graisse
    plus jolie au recouvrement mais fausse de trois pour cent en largeur.
    """
    rendues, _, masque = _mesurer_rendu(
        paire, style, style.lignes_origine, rect, rapide=rapide
    )
    recouvrement = ressemblance(style.reference, masque)
    if len(rendues) != len(style.lignes_mesurees) or not rendues:
        return 1.0, recouvrement
    pire = max(
        abs(r.largeur - ref.largeur) / max(1.0, ref.largeur)
        for r, ref in zip(rendues, style.lignes_mesurees)
    )
    return pire, recouvrement


def _taille_de_depart(nom: str, style: Style) -> float:
    """Taille d'entrée d'une graisse : par les largeurs si on peut, sinon par
    la hauteur d'x — qu'on sait un peu grande, et que la recherche corrigera."""
    par_largeur = taille_par_largeur(nom, style.echantillons)
    if par_largeur is not None:
        return par_largeur[0]
    sonde = Police(nom, 1000)
    hauteur = sonde.hauteur_x() / 1000.0
    return style.hauteur_x / hauteur if hauteur > 0 else style.taille


def caler_par_ressemblance(
    paire: Paire, style: Style, rect: tuple[int, int, int, int]
) -> dict[str, str]:
    """Graisse et taille qui reproduisent le mieux le texte d'origine.

    L'appariement ligne à ligne suppose que le LLM a lu exactement autant de
    lignes qu'il y en a : sur les slides denses c'est faux une fois sur deux.
    On redessine donc le texte d'origine avec ses propres coupures et on
    regarde ce qui tombe juste — aucun appariement nécessaire.

    En deux temps, pour le coût : un essai par graisse à sa taille calculée,
    puis la recherche fine sur la seule qui gagne. Sept recherches complètes
    coûteraient soixante rendus par zone.
    """
    if style.reference is None or not style.lignes_origine:
        return {}

    notes: dict[str, str] = {}
    classement: list[tuple[float, float, str, float]] = []
    for nom in POLICES:
        essai = Style(**{**style.__dict__})
        essai.police = nom
        essai.taille = _taille_de_depart(nom, style)
        largeur, forme = _juger(paire, essai, rect)
        notes[graisse(nom)] = f"{largeur * 100:.1f}%/{forme:.2f}"
        # Largeur d'abord ; à largeur comparable, la meilleure forme.
        classement.append((round(largeur, 3), -forme, nom, essai.taille))
    classement.sort()

    _, _, nom, depart = classement[0]
    essai = Style(**{**style.__dict__})
    essai.police = nom

    meilleur = None
    for facteur in (0.94, 0.97, 1.0, 1.03, 1.06):
        essai.taille = depart * facteur
        largeur, forme = _juger(paire, essai, rect)
        note = (round(largeur, 4), -forme)
        if meilleur is None or note < meilleur[0]:
            meilleur = (note, essai.taille, largeur, forme)

    (_, taille, largeur, forme) = meilleur
    notes[graisse(nom)] = f"{largeur * 100:.1f}%/{forme:.2f}"
    # Une forme au ras des pâquerettes veut dire que le masque de référence
    # n'est pas du texte : mieux vaut la taille calculée qu'une taille tirée
    # d'un nuage.
    if forme < 0.18:
        style.notes.append(
            f"recouvrement trop faible ({forme:.2f}) — taille laissée au calcul"
        )
        return notes
    style.police, style.taille = nom, taille
    return notes


def controler(
    paire: Paire, style: Style, rect: tuple[int, int, int, int]
) -> dict:
    """Redessine le texte D'ORIGINE avec le style calculé et compare.

    C'est le seul juge honnête : un style incapable de reproduire le texte
    qu'il vient de mesurer ne reproduira pas la traduction non plus. Les écarts
    partent dans le rapport plutôt que d'attendre l'œil d'un créateur.
    """
    if not style.lignes_origine or not style.lignes_mesurees:
        return {"fait": False, "ok": False}
    rendues, _, _ = _mesurer_rendu(paire, style, style.lignes_origine, rect)
    if len(rendues) != len(style.lignes_mesurees):
        return {
            "fait": True,
            "ok": False,
            "detail": f"{len(rendues)} ligne(s) rendues pour {len(style.lignes_mesurees)} mesurées",
        }

    x0, y0 = rect[0], rect[1]
    d_base, d_bord, d_largeur = [], [], []
    for rendue, ref in zip(rendues, style.lignes_mesurees):
        d_base.append((rendue.base + y0) - ref.base)
        d_bord.append(
            (rendue.x0 + x0) - ref.x0 if style.alignement == "left"
            else (rendue.x1 + x0) - ref.x1 if style.alignement == "right"
            else (rendue.centre + x0) - ref.centre
        )
        d_largeur.append((rendue.largeur - ref.largeur) / max(1.0, ref.largeur))

    pire_pos = max(max(abs(v) for v in d_base), max(abs(v) for v in d_bord))
    pire_largeur = max(abs(v) for v in d_largeur)
    return {
        "fait": True,
        "ok": pire_pos <= max(8.0, paire.propre.width * 0.005) and pire_largeur <= 0.02,
        "baseline": round(float(np.mean(d_base)), 1),
        "bord": round(float(np.mean(d_bord)), 1),
        "largeur": round(float(np.mean(d_largeur)) * 100, 2),
        "pireLargeur": round(pire_largeur * 100, 2),
        "pirePosition": round(pire_pos, 1),
    }


# ---------------------------------------------------------------------------
# Entrée publique
# ---------------------------------------------------------------------------


def _tient_dans_le_cadre(lignes: list[str], style: Style, taille: tuple[int, int]) -> bool:
    W, H = taille
    police = Police(style.police, style.taille)
    bases = _bases(style, len(lignes))
    if bases[0] - style.hauteur_x * 1.4 < 0 or bases[-1] + style.hauteur_x * 0.6 > H:
        return False
    for ligne, _ in zip(lignes, bases):
        largeur = largeur_encre(police, ligne, style.tracking, style.emoji)
        gauche = (
            style.ancre_x if style.alignement == "left"
            else style.ancre_x - largeur if style.alignement == "right"
            else style.ancre_x - largeur / 2
        )
        if gauche < 0 or gauche + largeur > W:
            return False
    return True


def _mettre_en_lignes(texte: str, style: Style, taille: tuple[int, int]) -> tuple[list[str], list[str]]:
    """Coupe la traduction sur la boîte mesurée, sans jamais déborder du cadre.

    Une ligne de plus est préférable à un texte rétréci ; un texte rétréci est
    préférable à une ligne qui sort de l'image. Dans tous les cas on le dit.
    """
    notes: list[str] = []
    police = Police(style.police, style.taille)
    lignes = couper_lignes(police, texte, style.largeur_boite, style.tracking, style.emoji)
    if _tient_dans_le_cadre(lignes, style, taille):
        return lignes, notes

    # Resserrer la boîte fait passer à la ligne plus tôt : le bloc rentre en
    # largeur au prix d'une ligne de plus, ce que l'ancrage sur la base absorbe.
    for facteur in (0.9, 0.8, 0.7):
        essai = couper_lignes(
            police, texte, style.largeur_boite * facteur, style.tracking, style.emoji
        )
        if _tient_dans_le_cadre(essai, style, taille):
            notes.append(f"boîte resserrée à {int(facteur * 100)} % pour tenir dans le cadre")
            return essai, notes

    for reduction in (0.92, 0.85):
        petit = Police(style.police, style.taille * reduction)
        essai = couper_lignes(
            petit, texte, style.largeur_boite, style.tracking * reduction, style.emoji * reduction
        )
        sauve = (style.taille, style.tracking, style.hauteur_x)
        style.taille, style.tracking = style.taille * reduction, style.tracking * reduction
        style.hauteur_x *= reduction
        if _tient_dans_le_cadre(essai, style, taille):
            notes.append(f"taille réduite de {int((1 - reduction) * 100)} % pour tenir dans le cadre")
            return essai, notes
        style.taille, style.tracking, style.hauteur_x = sauve

    notes.append("le texte déborde malgré tout — à relire")
    return lignes, notes


def bruler(
    brut: Image.Image,
    propre: Image.Image,
    zones: list[dict],
    textes: list[str],
    gras: bool = True,
) -> tuple[Image.Image, list[dict]]:
    """Rend l'image propre avec le texte traduit incrusté. Déterministe."""
    paire = preparer(brut, propre)
    sortie = paire.propre.convert("RGBA")
    rapport: list[dict] = []

    for zone, texte in zip(zones, textes):
        if not (texte or "").strip():
            continue
        rect = paire.rect(zone)
        style = analyser_zone(paire, zone, gras=gras)
        style.contour = calibrer_contour(paire, style, rect, style.contour)
        scores = caler_par_ressemblance(paire, style, rect)
        if scores:
            style.notes.append(
                f"graisse {graisse(style.police)} retenue "
                + "(écart de largeur / recouvrement : "
                + " · ".join(f"{k} {v}" for k, v in scores.items()) + ")"
            )
        controle = controler(paire, style, rect)
        lignes, notes = _mettre_en_lignes(texte, style, paire.propre.size)
        # Le moteur dessine toujours et dit ce qu'il vaut ; c'est l'appelant qui
        # décide de livrer ou non. Ne rien dessiner rendait l'aperçu de test
        # inutilisable : une image propre étiquetée « brûlée », sans rien à
        # regarder pour comprendre ce qui cloche.
        fiable = bool(controle.get("ok"))
        sortie = dessiner(sortie, lignes, style)
        rapport.append(
            {
                "role": zone.get("role"),
                "mesure": style.mesure,
                "police": style.police.replace(".ttf", ""),
                "taille": round(style.taille, 1),
                "tracking": round(style.tracking, 2),
                "hauteurX": round(style.hauteur_x, 1),
                "contour": round(style.contour, 2),
                "interligne": round(style.interligne, 1),
                "alignement": style.alignement,
                "largeurBoite": round(style.largeur_boite, 1),
                "couleur": "#%02X%02X%02X" % style.couleur,
                "ombre": bool(style.ombre),
                "lignesOrigine": len(style.lignes_mesurees),
                "lignes": lignes,
                "controle": controle,
                "fiable": fiable,
                "notes": style.notes + notes,
            }
        )

    return sortie.convert("RGB"), rapport


def burn_livrable(rapport: list[dict]) -> bool:
    """Toutes les zones ont passé leur contrôle : l'image est bonne à livrer.

    L'image existe dans tous les cas — c'est ce qui permet de la regarder pour
    comprendre. Seule la production s'interdit de la servir quand ce drapeau
    est faux, et la slide part alors en classique.
    """
    return bool(rapport) and all(z.get("fiable") for z in rapport)
