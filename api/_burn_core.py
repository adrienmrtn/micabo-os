"""
Burn déterministe du texte sur une slide propre.

L'analyse (où est le texte, sa couleur, le nombre de lignes) vient d'un LLM
vision côté Edge. Ce module ne devine rien : il MESURE le texte d'origine sur
l'image brute — hauteur d'encre, largeur de chaque ligne, interligne, épaisseur
du contour — puis redessine le texte traduit avec les mêmes réglages sur
l'image propre. Mêmes entrées, même PNG, à chaque exécution.

Le brut et l'image propre n'ont ni la même taille ni le même ratio : le
pipeline recadre en « cover » centré puis redimensionne (jamais
d'agrandissement). Le recalage est donc analytique, pas une mise en
correspondance de points.
"""

from __future__ import annotations

import io
import os
import re
import urllib.request
from dataclasses import dataclass, field

import numpy as np
from PIL import Image, ImageDraw, ImageFont

DOSSIER_POLICES = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fonts")
POLICE_700 = "TikTokSans-700.ttf"
POLICE_600 = "TikTokSans-600.ttf"

# Emojis Apple, même CDN que la preview du navigateur.
CDN_EMOJI = "https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15.1.2/img/apple/64"
RE_EMOJI = re.compile("((?:[\U0001F000-\U0001FAFF☀-➿⬀-⯿][️‍]*)+)")

#: Le texte est dessiné à cette échelle puis réduit — bords nets.
SUPERSAMPLE = 4
#: Contour par défaut quand la mesure ne le donne pas, en fraction de l'encre.
CONTOUR_FRAC = 0.055
#: Interligne de repli quand la zone n'a qu'une ligne.
INTERLIGNE_FRAC = 1.30
#: Un emoji occupe un carré de ce côté, proportionnel à l'encre de la ligne.
EMOJI_FRAC = 1.22
#: Écart minimal brut/propre pour qu'un pixel compte comme du texte effacé.
ECART_TEXTE_MIN = 120
#: TikTok coupe un peu après la plus longue ligne observée.
MARGE_WRAP = 1.06
#: Interlettrage plausible, en fraction de la taille de police.
TRACKING_MAX_FRAC = 0.09


# --------------------------------------------------------------------------
# Recalage brut → propre
# --------------------------------------------------------------------------


@dataclass
class Recalage:
    """Portion du brut qui a survécu au recadrage, et l'échelle appliquée."""

    ox: float
    oy: float
    echelle: float

    def vers_propre(self, x: float, y: float) -> tuple[float, float]:
        return ((x - self.ox) * self.echelle, (y - self.oy) * self.echelle)


def recaler(taille_brut: tuple[int, int], taille_propre: tuple[int, int]) -> Recalage:
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


# --------------------------------------------------------------------------
# Mesure du texte d'origine
# --------------------------------------------------------------------------


@dataclass
class Bande:
    """Une ligne de texte repérée sur le brut, en pixels du brut."""

    y0: int
    y1: int
    x0: int
    x1: int

    @property
    def hauteur(self) -> int:
        return self.y1 - self.y0

    @property
    def largeur(self) -> int:
        return self.x1 - self.x0

    @property
    def centre_x(self) -> float:
        return (self.x0 + self.x1) / 2


@dataclass
class Reglages:
    """Ce que la mesure a conclu pour une zone, en pixels de l'image propre."""

    taille: int
    tracking: float
    contour: float
    interligne: float
    largeur_wrap: float
    alignement: str
    ancre_x: float
    ancre_y: float
    encre: float
    mesure: bool = True
    bandes: list[Bande] = field(default_factory=list)


def _hex_vers_rgb(couleur: str | None) -> tuple[int, int, int]:
    m = re.fullmatch(r"#?([0-9a-fA-F]{6})", (couleur or "").strip())
    if not m:
        return (255, 255, 255)
    n = int(m.group(1), 16)
    return ((n >> 16) & 255, (n >> 8) & 255, n & 255)


def masque_texte(crop: np.ndarray, couleur: str | None) -> np.ndarray:
    """Pixels qui appartiennent au remplissage des lettres."""
    cible = np.array(_hex_vers_rgb(couleur), dtype=np.int16)
    masque = np.abs(crop.astype(np.int16) - cible).sum(axis=2) < 120
    if int(cible.sum()) > 700:
        # Blanc : sans contrainte de saturation, tout fond clair passerait.
        mx = crop.max(axis=2).astype(np.int16)
        mn = crop.min(axis=2).astype(np.int16)
        masque &= (mx - mn) < 42
        masque &= mx > 195
    return masque


def _bande(masque: np.ndarray, y0: int, y1: int) -> Bande:
    colonnes = np.nonzero(masque[y0:y1].sum(axis=0))[0]
    x0 = int(colonnes[0]) if colonnes.size else 0
    x1 = int(colonnes[-1]) + 1 if colonnes.size else 0
    return Bande(y0=y0, y1=y1, x0=x0, x1=x1)


def mesurer_bandes(masque: np.ndarray) -> list[Bande]:
    """Lignes visuelles : suites de rangées qui portent assez de pixels texte."""
    if masque.size == 0:
        return []
    h, w = masque.shape
    par_rangee = masque.sum(axis=1)
    seuil = max(2, int(w * 0.012))
    bandes: list[Bande] = []
    debut: int | None = None
    for y in range(h):
        if par_rangee[y] >= seuil:
            if debut is None:
                debut = y
        elif debut is not None:
            bandes.append(_bande(masque, debut, y))
            debut = None
    if debut is not None:
        bandes.append(_bande(masque, debut, h))
    bandes = [b for b in bandes if b.hauteur >= 6 and b.largeur >= 10]
    if not bandes:
        return []
    # Une bande bien plus fine que les autres, c'est un reste de détourage.
    plancher = max(b.hauteur for b in bandes) * 0.45
    return [b for b in bandes if b.hauteur >= plancher]


def _dilater(masque: np.ndarray, rayon: int) -> np.ndarray:
    out = masque
    for _ in range(rayon):
        out = (
            out
            | np.roll(out, 1, axis=0)
            | np.roll(out, -1, axis=0)
            | np.roll(out, 1, axis=1)
            | np.roll(out, -1, axis=1)
        )
    return out


def mesurer_contour(crop: np.ndarray, masque: np.ndarray) -> float:
    """Épaisseur du liseré sombre autour des lettres, en pixels du brut."""
    if not masque.any():
        return 0.0
    sombre = crop.astype(np.int16).sum(axis=2) < 210
    epaisseur = 0.0
    precedent = masque
    for rayon in range(1, 7):
        courant = _dilater(masque, rayon)
        anneau = courant & ~precedent
        precedent = courant
        if not anneau.any():
            break
        if float((sombre & anneau).sum()) / float(anneau.sum()) < 0.5:
            break
        epaisseur = float(rayon)
    return epaisseur


# --------------------------------------------------------------------------
# Police, largeurs, découpe
# --------------------------------------------------------------------------


def charger_police(gras: bool, taille: int) -> ImageFont.FreeTypeFont:
    nom = POLICE_700 if gras else POLICE_600
    return ImageFont.truetype(os.path.join(DOSSIER_POLICES, nom), max(1, int(taille)))


def segmenter(texte: str) -> list[tuple[str, str]]:
    """Découpe en morceaux ('texte' | 'emoji')."""
    return [
        ("emoji" if RE_EMOJI.fullmatch(p) else "texte", p)
        for p in RE_EMOJI.split(texte)
        if p
    ]


def largeur_ligne(
    font: ImageFont.FreeTypeFont, texte: str, tracking: float, emoji: float
) -> float:
    total, n = 0.0, 0
    for genre, morceau in segmenter(texte):
        if genre == "emoji":
            total += emoji
            n += 1
        else:
            for c in morceau:
                total += font.getlength(c)
                n += 1
    return total + tracking * max(0, n - 1)


def hauteur_encre(font: ImageFont.FreeTypeFont, texte: str) -> float:
    """Hauteur réellement noircie par ce texte — pas la boîte de la police."""
    nettoye = "".join(m for g, m in segmenter(texte) if g == "texte")
    if not nettoye.strip():
        nettoye = "Hx"
    bbox = font.getbbox(nettoye)
    return float(bbox[3] - bbox[1])


def taille_pour_encre(gras: bool, texte: str, cible: float) -> int:
    """Plus petite taille dont l'encre de ce texte atteint la mesure."""
    bas, haut = 6, 600
    while bas < haut:
        milieu = (bas + haut) // 2
        if hauteur_encre(charger_police(gras, milieu), texte) < cible:
            bas = milieu + 1
        else:
            haut = milieu
    return max(6, bas)


def tracking_pour_largeur(
    font: ImageFont.FreeTypeFont, texte: str, cible: float, emoji: float
) -> float:
    n = sum(1 for g, m in segmenter(texte) for _ in (m if g == "texte" else "e"))
    if n < 2:
        return 0.0
    ecart = (cible - largeur_ligne(font, texte, 0.0, emoji)) / (n - 1)
    # Au-delà, c'est la mesure ou la police qui est fausse — on ne force pas.
    return max(-6.0, min(6.0, ecart))


def nb_glyphes(texte: str) -> int:
    return sum(1 if g == "emoji" else len(m) for g, m in segmenter(texte))


def calibrer(
    gras: bool, echantillons: list[tuple[str, float]]
) -> tuple[int, float] | None:
    """Taille et interlettrage qui reproduisent les largeurs mesurées.

    Deux inconnues, une équation par ligne : `largeur = taille × u + tracking ×
    (glyphes − 1)`. Avec deux lignes de longueurs différentes, le système est
    déterminé ; au-delà, on prend les moindres carrés.
    """
    REF = 200
    police = charger_police(gras, REF)
    obs = [
        (largeur_ligne(police, t, 0.0, 0.0) / REF, float(nb_glyphes(t) - 1), w)
        for t, w in echantillons
        if t and len(t) > 3 and not RE_EMOJI.search(t)
    ]
    obs = [o for o in obs if o[0] > 0 and o[1] > 0]
    if not obs:
        return None
    if len(obs) >= 2:
        saa = sum(u * u for u, _, _ in obs)
        sab = sum(u * n for u, n, _ in obs)
        sbb = sum(n * n for _, n, _ in obs)
        saw = sum(u * w for u, _, w in obs)
        sbw = sum(n * w for _, n, w in obs)
        det = saa * sbb - sab * sab
        if abs(det) > 1e-9:
            taille = (saw * sbb - sbw * sab) / det
            tracking = (sbw * saa - saw * sab) / det
        else:
            taille, tracking = sum(w / u for u, _, w in obs) / len(obs), 0.0
    else:
        taille, tracking = obs[0][2] / obs[0][0], 0.0
    # Un interlettrage délirant veut dire que la mesure ou la police est fausse.
    limite = TRACKING_MAX_FRAC * max(1.0, taille)
    if not (-limite <= tracking <= limite) or taille <= 0:
        tracking = max(-limite, min(limite, tracking))
        taille = sum((w - tracking * n) / u for u, n, w in obs) / len(obs)
    taille = max(6, int(round(taille)))
    # Dernier ajustement avec la police à sa taille réelle (le hinting arrondit).
    police = charger_police(gras, taille)
    restes = [
        (w - largeur_ligne(police, t, 0.0, 0.0)) / max(1, nb_glyphes(t) - 1)
        for (t, w), (_, _, _) in zip(
            [e for e in echantillons if e[0] and len(e[0]) > 3 and not RE_EMOJI.search(e[0])],
            obs,
        )
    ]
    tracking = round(sum(restes) / len(restes), 2) if restes else 0.0
    limite = TRACKING_MAX_FRAC * taille
    return taille, max(-limite, min(limite, tracking))


def couper_lignes(
    font: ImageFont.FreeTypeFont, texte: str, largeur_max: float, tracking: float, emoji: float
) -> list[str]:
    """Coupe au mot, sur la largeur mesurée sur le brut — comme TikTok."""
    lignes: list[str] = []
    for paragraphe in texte.split("\n"):
        mots = paragraphe.split()
        if not mots:
            lignes.append("")
            continue
        courante = mots[0]
        for mot in mots[1:]:
            essai = f"{courante} {mot}"
            if largeur_ligne(font, essai, tracking, emoji) <= largeur_max:
                courante = essai
            else:
                lignes.append(courante)
                courante = mot
        lignes.append(courante)
    return lignes


# --------------------------------------------------------------------------
# Emojis
# --------------------------------------------------------------------------

_cache_emoji: dict[str, Image.Image | None] = {}


def image_emoji(sequence: str) -> Image.Image | None:
    points = [c for c in sequence if c not in ("️",)]
    cle = "-".join(f"{ord(c):x}" for c in points)
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


# --------------------------------------------------------------------------
# Analyse d'une zone
# --------------------------------------------------------------------------


@dataclass
class Paire:
    """Le brut ramené dans le cadre de l'image propre, et leur écart."""

    propre: Image.Image
    recale: np.ndarray
    ecart: np.ndarray
    recalage: Recalage
    taille_brut: tuple[int, int]

    def vers_propre_rect(self, zone: dict) -> tuple[int, int, int, int]:
        bw, bh = self.taille_brut
        xf, yf = float(zone.get("x", 0.0)), float(zone.get("y", 0.0))
        wf, hf = float(zone.get("w", 1.0)), float(zone.get("h", 1.0))
        x0, y0 = self.recalage.vers_propre(xf * bw, yf * bh)
        x1, y1 = self.recalage.vers_propre((xf + wf) * bw, (yf + hf) * bh)
        W, H = self.propre.size
        return (
            max(0, min(W - 1, int(x0))),
            max(0, min(H - 1, int(y0))),
            max(1, min(W, int(x1))),
            max(1, min(H, int(y1))),
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
    ecart = np.abs(
        np.asarray(recale).astype(np.int16) - np.asarray(propre).astype(np.int16)
    ).sum(axis=2)
    return Paire(propre, np.asarray(recale), ecart, r, brut.size)


def masque_zone(paire: Paire, rect: tuple[int, int, int, int], couleur: str | None):
    """Pixels du texte : de la bonne couleur ET absents de l'image nettoyée.

    L'image propre a justement été débarrassée de ce texte : l'écart entre les
    deux est le repère le plus sûr — un tableau blanc derrière les lettres ne
    trompe plus la mesure.
    """
    x0, y0, x1, y1 = rect
    crop = paire.recale[y0:y1, x0:x1]
    masque = masque_texte(crop, couleur)
    efface = paire.ecart[y0:y1, x0:x1] > ECART_TEXTE_MIN
    filtre = masque & efface
    # Texte clair sur fond clair : l'écart avec le propre est trop faible pour
    # servir de filtre. On retombe alors sur la couleur seule, moins sûre mais
    # meilleure que pas de mesure du tout.
    if filtre.sum() < masque.sum() * 0.15:
        return masque, crop
    return filtre, crop


def _coherent(gras: bool, taille: int, lignes: list[str], encre: float) -> bool:
    """La taille trouvée par les largeurs doit rester plausible en hauteur."""
    if not lignes or encre <= 0:
        return False
    police = charger_police(gras, taille)
    rendue = max(hauteur_encre(police, l) for l in lignes)
    return 0.7 <= rendue / encre <= 1.45


def analyser_zone(paire: Paire, zone: dict, gras: bool = True) -> Reglages:
    """Mesure la zone et rend des réglages en pixels de l'image propre."""
    rect = paire.vers_propre_rect(zone)
    x0, y0, x1, y1 = rect
    couleur = zone.get("couleur") or "#FFFFFF"
    origine = (zone.get("texte") or "").strip()

    bandes: list[Bande] = []
    contour = 0.0
    if x1 - x0 > 8 and y1 - y0 > 8:
        masque, crop = masque_zone(paire, rect, couleur)
        bandes = mesurer_bandes(masque)
        contour = mesurer_contour(crop, masque)
        for b in bandes:  # repère de l'image propre entière
            b.y0 += y0
            b.y1 += y0
            b.x0 += x0
            b.x1 += x0

    lignes_origine = [l for l in origine.split("\n") if l.strip()]
    if not bandes:
        return _reglages_de_repli(paire, rect, zone, gras)

    # Taille et interlettrage : déduits des largeurs de ligne mesurées, qui
    # portent bien plus d'information que la hauteur (des dizaines de glyphes
    # contre une seule dimension, et sans le flou des bords du détourage).
    ref = max(range(len(bandes)), key=lambda i: bandes[i].largeur)
    encre = float(bandes[ref].hauteur)
    reglage = calibrer(
        gras,
        [
            (lignes_origine[i], float(bandes[i].largeur))
            for i in range(min(len(bandes), len(lignes_origine)))
        ],
    )
    if reglage is None or not _coherent(gras, reglage[0], lignes_origine, encre):
        ref_texte = (
            lignes_origine[ref]
            if ref < len(lignes_origine)
            else (lignes_origine[0] if lignes_origine else "Hx")
        )
        taille = taille_pour_encre(gras, ref_texte, encre)
        tracking = tracking_pour_largeur(
            charger_police(gras, taille),
            ref_texte,
            float(bandes[ref].largeur),
            encre * EMOJI_FRAC,
        )
    else:
        taille, tracking = reglage

    # Interligne : écart médian entre hauts de bandes consécutives.
    if len(bandes) > 1:
        deltas = sorted(bandes[i + 1].y0 - bandes[i].y0 for i in range(len(bandes) - 1))
        interligne = float(deltas[len(deltas) // 2])
    else:
        interligne = encre * INTERLIGNE_FRAC

    if contour <= 0 and zone.get("ombre"):
        contour = encre * CONTOUR_FRAC

    # Alignement : des bords gauches alignés trahissent un fer à gauche.
    if len(bandes) > 1:
        ecart_gauche = max(b.x0 for b in bandes) - min(b.x0 for b in bandes)
        ecart_centre = max(b.centre_x for b in bandes) - min(b.centre_x for b in bandes)
        alignement = "left" if ecart_gauche + 4 < ecart_centre else "center"
    else:
        alignement = "center"

    return Reglages(
        taille=taille,
        tracking=tracking,
        contour=round(contour, 2),
        interligne=round(interligne, 2),
        # TikTok coupe un peu après la plus longue ligne observée.
        largeur_wrap=round(max(b.largeur for b in bandes) * MARGE_WRAP, 1),
        alignement=alignement,
        ancre_x=round(
            min(b.x0 for b in bandes)
            if alignement == "left"
            else sum(b.centre_x for b in bandes) / len(bandes),
            1,
        ),
        ancre_y=round((bandes[0].y0 + bandes[-1].y1) / 2, 1),
        encre=round(encre, 2),
        mesure=True,
        bandes=bandes,
    )


def _reglages_de_repli(
    paire: Paire, rect: tuple[int, int, int, int], zone: dict, gras: bool
) -> Reglages:
    """Rien de mesurable : on se cale sur la boîte donnée par le LLM."""
    x0, y0, x1, y1 = rect
    lignes = max(1, int(zone.get("nbLignes") or 1))
    interligne = (y1 - y0) / lignes
    encre = interligne / INTERLIGNE_FRAC
    return Reglages(
        taille=taille_pour_encre(gras, (zone.get("texte") or "Hx"), encre),
        tracking=0.0,
        contour=encre * CONTOUR_FRAC if zone.get("ombre") else 0.0,
        interligne=round(interligne, 2),
        largeur_wrap=float(x1 - x0),
        alignement="center",
        ancre_x=round((x0 + x1) / 2, 1),
        ancre_y=round((y0 + y1) / 2, 1),
        encre=round(encre, 2),
        mesure=False,
    )


# --------------------------------------------------------------------------
# Rendu
# --------------------------------------------------------------------------


def disposer(
    font: ImageFont.FreeTypeFont, lignes: list[str], reglages: Reglages, emoji: float
) -> tuple[list[tuple[float, float]], tuple[float, float, float, float]]:
    """Point de base de chaque ligne, et la boîte d'encre du bloc entier.

    Le bloc est centré sur l'ancre mesurée sur l'original : la traduction peut
    prendre une ligne de plus sans décoller du sujet de la photo.
    """
    ascent, _ = font.getmetrics()
    hauts, bas, largeurs = [], [], []
    for i, ligne in enumerate(lignes):
        base = i * reglages.interligne
        nettoye = "".join(m for g, m in segmenter(ligne) if g == "texte") or "Hx"
        bbox = font.getbbox(nettoye)
        haut = base - ascent + bbox[1]
        bas_ = base - ascent + bbox[3]
        if RE_EMOJI.search(ligne):  # un emoji déborde de la boîte des lettres
            haut = min(haut, base - emoji * 0.86)
            bas_ = max(bas_, base + emoji * 0.14)
        hauts.append(haut)
        bas.append(bas_)
        largeurs.append(largeur_ligne(font, ligne, reglages.tracking, emoji))
    if not hauts:
        return [], (0.0, 0.0, 0.0, 0.0)
    dy = reglages.ancre_y - (min(hauts) + max(bas)) / 2
    points = []
    for i, largeur in enumerate(largeurs):
        x = (
            reglages.ancre_x - largeur / 2
            if reglages.alignement == "center"
            else reglages.ancre_x
        )
        points.append((x, i * reglages.interligne + dy))
    x0 = min(p[0] for p in points)
    x1 = max(p[0] + w for p, w in zip(points, largeurs))
    return points, (x0, min(hauts) + dy, x1, max(bas) + dy)


def _mise_a_echelle(reglages: Reglages, s: int) -> Reglages:
    return Reglages(
        taille=reglages.taille * s,
        tracking=reglages.tracking * s,
        contour=reglages.contour * s,
        interligne=reglages.interligne * s,
        largeur_wrap=reglages.largeur_wrap * s,
        alignement=reglages.alignement,
        ancre_x=reglages.ancre_x * s,
        ancre_y=reglages.ancre_y * s,
        encre=reglages.encre * s,
    )


def dessiner_zone(
    sortie: Image.Image,
    texte: str,
    reglages: Reglages,
    couleur: str | None = "#FFFFFF",
    gras: bool = True,
) -> list[str]:
    """Incruste le texte sur `sortie` (RGBA) et rend les lignes obtenues.

    Le dessin se fait quatre fois plus grand puis est réduit — les bords sont
    nets — mais seulement sur la boîte du texte : un calque plein format à
    cette échelle coûterait des centaines de mégaoctets.
    """
    s = SUPERSAMPLE
    police = charger_police(gras, reglages.taille)
    emoji = reglages.encre * EMOJI_FRAC
    lignes = couper_lignes(police, texte, reglages.largeur_wrap, reglages.tracking, emoji)
    if not any(l.strip() for l in lignes):
        return []
    _, boite = disposer(police, lignes, reglages, emoji)

    marge = reglages.contour + reglages.taille * 0.25 + 4
    bx0 = int(max(0, boite[0] - marge))
    by0 = int(max(0, boite[1] - marge))
    bx1 = int(min(sortie.width, boite[2] + marge))
    by1 = int(min(sortie.height, boite[3] + marge))
    if bx1 - bx0 < 2 or by1 - by0 < 2:
        return lignes

    grand = _mise_a_echelle(reglages, s)
    grand.ancre_x -= bx0 * s
    grand.ancre_y -= by0 * s
    police_s = charger_police(gras, reglages.taille * s)
    points, _ = disposer(police_s, lignes, grand, emoji * s)

    calque = Image.new("RGBA", ((bx1 - bx0) * s, (by1 - by0) * s), (0, 0, 0, 0))
    draw = ImageDraw.Draw(calque)
    remplissage = _hex_vers_rgb(couleur) + (255,)
    contour = max(0, int(round(grand.contour)))

    # Deux passes : tout le contour noir d'abord, le texte par-dessus. Sinon le
    # contour d'une lettre viendrait mordre la lettre précédente.
    for passe in ("contour", "texte"):
        if passe == "contour" and contour <= 0:
            continue
        for ligne, (x0, base) in zip(lignes, points):
            x = x0
            for genre, morceau in segmenter(ligne):
                if genre == "emoji":
                    if passe == "texte":
                        vignette = image_emoji(morceau)
                        if vignette is not None:
                            cote = max(1, int(round(emoji * s)))
                            calque.alpha_composite(
                                vignette.resize((cote, cote), Image.LANCZOS),
                                (int(round(x)), int(round(base - emoji * s * 0.86))),
                            )
                    x += emoji * s + grand.tracking
                    continue
                for c in morceau:
                    if passe == "contour":
                        draw.text(
                            (x, base),
                            c,
                            font=police_s,
                            fill=(0, 0, 0, 255),
                            anchor="ls",
                            stroke_width=contour,
                            stroke_fill=(0, 0, 0, 255),
                        )
                    else:
                        draw.text(
                            (x, base), c, font=police_s, fill=remplissage, anchor="ls"
                        )
                    x += police_s.getlength(c) + grand.tracking
    sortie.alpha_composite(calque.resize((bx1 - bx0, by1 - by0), Image.LANCZOS), (bx0, by0))
    return lignes


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
        reglages = analyser_zone(paire, zone, gras=gras)
        lignes = dessiner_zone(sortie, texte, reglages, zone.get("couleur"), gras)
        rapport.append(
            {
                "role": zone.get("role"),
                "mesure": reglages.mesure,
                "taille": reglages.taille,
                "tracking": reglages.tracking,
                "contour": reglages.contour,
                "interligne": reglages.interligne,
                "alignement": reglages.alignement,
                "largeurWrap": reglages.largeur_wrap,
                "lignesOrigine": len(reglages.bandes),
                "lignes": lignes,
            }
        )
    return sortie.convert("RGB"), rapport
