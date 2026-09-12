"""Contrôles du moteur de rendu — `python3 api/_burn_core_test.py`.

Pas de dépendance de test : le module s'appelle tout seul et lève au premier
écart. Ce qui est vérifié ici, c'est ce qui casserait silencieusement un burn :
le recalage, la calibration sur les largeurs mesurées, la découpe des lignes.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import _burn_core as bc  # noqa: E402


def test_recalage_rogne_les_cotes() -> None:
    # Brut 828×1082 (0.765) → propre 1760×2368 (0.743) : recadrage en largeur.
    r = bc.recaler((828, 1082), (1760, 2368))
    assert r.oy == 0, r
    assert 11.5 < r.ox < 12.5, r
    assert abs(r.echelle - 2.1885) < 0.001, r
    # Le centre reste le centre.
    x, y = r.vers_propre(414, 541)
    assert abs(x - 880) < 1 and abs(y - 1184) < 1, (x, y)


def test_recalage_rogne_le_haut_et_le_bas() -> None:
    r = bc.recaler((1000, 1000), (1000, 500))
    assert r.ox == 0 and r.oy == 250, r
    assert r.echelle == 1.0, r


def test_recalage_identique() -> None:
    r = bc.recaler((900, 1600), (900, 1600))
    assert (r.ox, r.oy, r.echelle) == (0.0, 0.0, 1.0), r


def test_calibration_retrouve_les_largeurs() -> None:
    """Deux lignes rendues à taille connue doivent redonner cette taille."""
    taille, tracking = 96, -1.5
    police = bc.charger_police(True, taille)
    lignes = ["Méthodes de révision", "surpuissante en fonction", "de ton cas"]
    mesures = [bc.largeur_ligne(police, l, tracking, 0.0) for l in lignes]

    trouve = bc.calibrer(True, list(zip(lignes, mesures)))
    assert trouve is not None
    assert abs(trouve[0] - taille) <= 1, trouve
    assert abs(trouve[1] - tracking) < 0.35, trouve

    # Et le rendu recalculé retombe sur les largeurs mesurées.
    police2 = bc.charger_police(True, trouve[0])
    for ligne, attendu in zip(lignes, mesures):
        obtenu = bc.largeur_ligne(police2, ligne, trouve[1], 0.0)
        assert abs(obtenu - attendu) / attendu < 0.02, (ligne, obtenu, attendu)


def test_calibration_ignore_les_lignes_courtes() -> None:
    # Une seule ligne exploitable : pas de système à deux inconnues, mais
    # toujours une taille plausible.
    police = bc.charger_police(True, 80)
    texte = "une ligne bien assez longue"
    largeur = bc.largeur_ligne(police, texte, 0.0, 0.0)
    trouve = bc.calibrer(True, [(texte, largeur), ("ok", 40.0)])
    assert trouve is not None and abs(trouve[0] - 80) <= 2, trouve


def test_coupure_respecte_la_largeur() -> None:
    police = bc.charger_police(True, 60)
    texte = "Super powerful revision methods based on your situation"
    lignes = bc.couper_lignes(police, texte, 600, 0.0, 70)
    assert len(lignes) > 1
    for l in lignes:
        mots = l.split()
        if len(mots) > 1:  # un mot seul a le droit de dépasser
            assert bc.largeur_ligne(police, l, 0.0, 70) <= 600, l
    assert " ".join(" ".join(lignes).split()) == texte


def test_coupure_garde_les_paragraphes() -> None:
    police = bc.charger_police(True, 40)
    lignes = bc.couper_lignes(police, "un\ndeux", 10_000, 0.0, 40)
    assert lignes == ["un", "deux"], lignes


def test_segmentation_emoji() -> None:
    assert bc.segmenter("caso 🔥") == [("texte", "caso "), ("emoji", "🔥")]
    assert bc.nb_glyphes("caso 🔥") == 6
    assert bc.segmenter("abc") == [("texte", "abc")]


def test_masque_blanc_ecarte_les_couleurs_franches() -> None:
    import numpy as np

    crop = np.zeros((2, 3, 3), dtype=np.uint8)
    crop[:, 0] = (255, 255, 255)  # lettre blanche
    crop[:, 1] = (190, 120, 60)   # bois : saturé, écarté
    crop[:, 2] = (150, 150, 150)  # gris moyen : trop loin du blanc
    masque = bc.masque_texte(crop, "#FFFFFF")
    assert masque[:, 0].all() and not masque[:, 1:].any(), masque


def test_ecart_avec_le_propre_ecarte_le_blanc_qui_n_est_pas_du_texte() -> None:
    """Une nappe blanche est blanche, mais elle n'est pas du texte.

    L'image propre a été débarrassée du texte et d'elle seule : ce qui est
    présent dans les deux images ne peut pas être une lettre.
    """
    from PIL import Image

    brut = Image.new("RGB", (60, 40), (40, 38, 45))
    brut.paste((252, 252, 252), (2, 2, 20, 38))   # nappe blanche, dans les deux
    brut.paste((255, 255, 255), (30, 10, 50, 30))  # le « texte », dans le brut
    propre = brut.copy()
    propre.paste((40, 38, 45), (30, 10, 50, 30))   # texte retiré au nettoyage

    paire = bc.preparer(brut, propre)
    couleur_seule = bc.masque_texte(paire.recale, "#FFFFFF")
    assert couleur_seule.sum() > 1000, couleur_seule.sum()  # nappe + texte

    masque, _ = bc.masque_zone(paire, (0, 0, 60, 40), "#FFFFFF")
    ys, xs = masque.nonzero()
    assert (ys.min(), ys.max(), xs.min(), xs.max()) == (10, 29, 30, 49), masque.sum()


def test_bandes_ecartent_le_bruit() -> None:
    import numpy as np

    masque = np.zeros((60, 200), dtype=bool)
    masque[10:30, 20:180] = True  # une vraie ligne
    masque[40:42, 20:180] = True  # un reste de détourage
    bandes = bc.mesurer_bandes(masque)
    assert len(bandes) == 1, bandes
    assert (bandes[0].y0, bandes[0].y1, bandes[0].x0, bandes[0].x1) == (10, 30, 20, 180)


def test_taille_pour_encre_est_monotone() -> None:
    petite = bc.taille_pour_encre(True, "Hxp", 40)
    grande = bc.taille_pour_encre(True, "Hxp", 80)
    assert petite < grande
    police = bc.charger_police(True, grande)
    assert abs(bc.hauteur_encre(police, "Hxp") - 80) <= 2


if __name__ == "__main__":
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    for test in tests:
        test()
        print(f"ok  {test.__name__}")
    print(f"\n{len(tests)} contrôles passés.")
