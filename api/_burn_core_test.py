"""Contrôles du moteur de rendu — `python3 api/_burn_core_test.py`.

Pas de dépendance de test : le module s'appelle tout seul et lève au premier
écart. Ce qui est vérifié ici, c'est ce qui casserait silencieusement un burn.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import numpy as np  # noqa: E402
from PIL import Image, ImageDraw  # noqa: E402

import _burn_core as bc  # noqa: E402


# --- recalage --------------------------------------------------------------


def test_recalage_rogne_les_cotes() -> None:
    r = bc.recaler((828, 1082), (1760, 2368))
    assert r.oy == 0 and 11.5 < r.ox < 12.5, r
    assert abs(r.echelle - 2.1885) < 0.001, r
    x, y = r.vers_propre(414, 541)
    assert abs(x - 880) < 1 and abs(y - 1184) < 1, (x, y)


def test_recalage_degenere_en_echelle_pure() -> None:
    r = bc.recaler((900, 1600), (1800, 3200))
    assert (round(r.ox, 6), round(r.oy, 6), r.echelle) == (0.0, 0.0, 2.0), r


# --- police et mise en ligne ----------------------------------------------


def test_repli_glyphe_par_glyphe() -> None:
    """Une flèche absente de TikTok Sans doit sortir dans la police de repli."""
    p = bc.Police(bc.POLICE_700, 100)
    assert p.pour("a") is p.principale
    assert p.pour("→") is p.repli
    assert p.avance("→") > 0


def test_largeur_est_celle_de_l_encre() -> None:
    """L'encre, pas la somme des avances.

    Sur une image, on mesure le noir, pas les boîtes : les deux diffèrent du
    débord d'encre du premier et du dernier glyphe. L'écart est petit, mais
    systématique et toujours dans le même sens — donc jamais compensé.
    """
    p = bc.Police(bc.POLICE_700, 100)
    avances = sum(p.avance(c) for c in "nnn")
    encre = bc.largeur_encre(p, "nnn", 0.0, 0.0)
    assert encre != avances and abs(encre - avances) < 2, (encre, avances)
    # Une espace finale n'ajoute pas d'encre, mais bien une avance.
    assert bc.largeur_encre(p, "nnn ", 0.0, 0.0) == encre


def test_coupure_garde_les_lignes_vides() -> None:
    """Un saut de paragraphe occupe une ligne dans l'image : il doit survivre."""
    p = bc.Police(bc.POLICE_700, 40)
    assert bc.couper_lignes(p, "un\n\ndeux", 10_000, 0.0, 40) == ["un", "", "deux"]


def test_coupure_respecte_la_largeur() -> None:
    p = bc.Police(bc.POLICE_700, 60)
    texte = "Super powerful revision methods based on your situation"
    lignes = bc.couper_lignes(p, texte, 600, 0.0, 70)
    assert len(lignes) > 1
    for l in lignes:
        if len(l.split()) > 1:  # un mot seul a le droit de dépasser
            assert bc.largeur_encre(p, l, 0.0, 70) <= 600, l
    assert " ".join(" ".join(lignes).split()) == texte


def test_segmentation_emoji() -> None:
    assert bc.segmenter("caso 🔥") == [("texte", "caso "), ("emoji", "🔥")]


# --- mesure ----------------------------------------------------------------


def test_orphelins_ecartes() -> None:
    """Un vêtement clair de la couleur du texte ne doit pas élargir la ligne."""
    masque = np.zeros((60, 900), dtype=bool)
    masque[10:50, 20:400] = True     # la ligne de texte
    masque[20:40, 800:840] = True    # un reflet, loin, isolé
    assert bc.nettoyer_orphelins(masque, 10, 49) == (20, 399)


def test_bandes_triees_par_encre_pas_par_hauteur() -> None:
    """Le bruit est nombreux et minuscule : il ne doit pas servir de norme."""
    masque = np.zeros((400, 600), dtype=bool)
    for y in (10, 120, 230):        # trois vraies lignes
        masque[y : y + 60, 50:550] = True
    for y in (95, 205, 315, 330):   # des restes de détourage
        masque[y : y + 3, 60:70] = True
    assert len(bc.mesurer_lignes(masque)) == 3


def test_geometrie_ligne() -> None:
    """Haut d'x là où les pixels explosent, base là où ils s'effondrent."""
    masque = np.zeros((100, 200), dtype=bool)
    masque[20:70, 10:190] = True   # corps de la ligne
    masque[70:85, 20:30] = True    # une descendante
    base, haut_x = bc.geometrie_ligne(masque, 20, 84)
    assert 66 <= base <= 71, base
    assert haut_x == 20, haut_x


def test_alignement_par_dispersion() -> None:
    gauche = [bc.Ligne(0, 10, 100, 300, 10, 0), bc.Ligne(20, 30, 100, 500, 30, 20)]
    centre = [bc.Ligne(0, 10, 200, 400, 10, 0), bc.Ligne(20, 30, 100, 500, 30, 20)]
    assert bc.alignement(gauche) == "left"
    assert bc.alignement(centre) == "center"


def test_interligne_de_base_a_base() -> None:
    lignes = [bc.Ligne(0, 10, 0, 10, base, 0) for base in (100, 251, 400)]
    assert abs(bc.interligne(lignes) - 150) < 0.01


def test_couleur_mesuree_pas_devinee() -> None:
    """Un orange annoncé #FF8C00 vaut #E8791A à l'écran : on mesure."""
    crop = np.zeros((40, 40, 3), dtype=np.uint8)
    crop[:, :] = (30, 30, 35)
    crop[10:30, 10:30] = (232, 121, 26)
    efface = np.zeros((40, 40), dtype=bool)
    efface[8:32, 8:32] = True
    assert bc.couleur_du_texte(crop, efface, (255, 140, 0)) == (232, 121, 26)


def test_pastille_demontee() -> None:
    """Texte sombre sur boîte claire : la boîte est le masque, pas le texte."""
    img = Image.new("RGB", (400, 120), (40, 40, 45))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([40, 20, 360, 100], radius=18, fill=(255, 255, 255))
    d.rectangle([80, 45, 320, 75], fill=(0, 0, 0))
    crop = np.asarray(img)
    masque = bc.masque_couleur(crop, (255, 255, 255))
    demonte = bc.demonter_pastille(crop, masque, bc.bandes_horizontales(masque))
    assert demonte is not None, "pastille non détectée"
    lettres, couleur, boite = demonte
    assert couleur == (0, 0, 0), couleur
    assert boite.couleur == (255, 255, 255), boite.couleur
    assert lettres[45:75, 80:320].all()
    assert 10 <= boite.rayon <= 30, boite.rayon


# --- rendu et contrôle -----------------------------------------------------


def test_rendu_deterministe() -> None:
    fond = Image.new("RGB", (500, 200), (20, 20, 20))
    style = bc.Style(
        police=bc.POLICE_700, taille=40, tracking=0.0, couleur=(255, 255, 255),
        alignement="center", ancre_x=250, base=120, interligne=50,
        largeur_boite=400, hauteur_x=20, lignes_origine=["essai"],
    )
    a = np.asarray(bc.dessiner(fond, ["essai"], style).convert("RGB"))
    b = np.asarray(bc.dessiner(fond, ["essai"], style).convert("RGB"))
    assert np.array_equal(a, b)


def test_ligne_vide_avance_la_base() -> None:
    style = bc.Style(
        police=bc.POLICE_700, taille=40, tracking=0.0, couleur=(255, 255, 255),
        alignement="left", ancre_x=10, base=100, interligne=50,
        largeur_boite=400, hauteur_x=20, lignes_origine=["a", "", "b"],
    )
    bases = bc._bases(style, 3)
    assert bases == [100, 150, 200], bases


def test_controle_repere_une_taille_fausse() -> None:
    """Le contrôle doit voir une taille de 20 % trop grande."""
    propre = Image.new("RGB", (600, 300), (25, 25, 30))
    style = bc.Style(
        police=bc.POLICE_700, taille=50, tracking=0.0, couleur=(255, 255, 255),
        alignement="center", ancre_x=300, base=180, interligne=70,
        largeur_boite=500, hauteur_x=25, lignes_origine=["mesure exacte"],
    )
    brut = bc.dessiner(propre, style.lignes_origine, style).convert("RGB")
    paire = bc.preparer(brut, propre)
    rect = (0, 0, 600, 300)
    masque, _, _ = bc.masque_zone(paire, rect, "#FFFFFF")
    style.lignes_mesurees = bc.mesurer_lignes(masque)
    assert len(style.lignes_mesurees) == 1

    juste = bc.controler(paire, style, rect)
    assert juste["ok"], juste
    style.taille *= 1.2
    faux = bc.controler(paire, style, rect)
    assert not faux["ok"], faux
    assert faux["largeur"] > 10, faux


if __name__ == "__main__":
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    for test in tests:
        test()
        print(f"ok  {test.__name__}")
    print(f"\n{len(tests)} contrôles passés.")
