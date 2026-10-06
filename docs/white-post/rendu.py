"""Rendu d'une slide « white post » : fond uni, texte noir Inter Display,
soulignés, photos recopiées au pixel depuis la slide d'origine.

Le texte est rendu en sur-échantillonnage (SS = 4) puis réduit en BOX : la
couverture d'aire, comme un rasteriseur de police. Les photos ne sont jamais
rééchantillonnées : elles sont recopiées octet pour octet depuis la source.
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

# Inter Display Regular : c'est la police des white posts d'origine, mesurée au
# pixel (42 px pour le corps, 63 px pour les titres). Fichier de la release
# officielle rsms/inter si le système ne l'a pas.
POLICE = os.environ.get("POLICE_WHITE_POST", "/usr/share/fonts/opentype/inter/InterDisplay-Regular.otf")
SS = 4


def parser(texte: str) -> list[tuple[str, bool]]:
    """« a [b c] d » → [(char, souligné)]. Les crochets ne sont pas imprimés."""
    out: list[tuple[str, bool]] = []
    ul = False
    for ch in texte:
        if ch == "[":
            ul = True
        elif ch == "]":
            ul = False
        else:
            out.append((ch, ul))
    return out


def couper(chars: list[tuple[str, bool]], police: ImageFont.FreeTypeFont, largeur: float) -> list[list[tuple[str, bool]]]:
    """Coupure gloutonne par mots ; « \\n » force une ligne."""
    lignes: list[list[tuple[str, bool]]] = []
    paragraphes: list[list[tuple[str, bool]]] = [[]]
    for c in chars:
        if c[0] == "\n":
            paragraphes.append([])
        else:
            paragraphes[-1].append(c)
    for para in paragraphes:
        # chaque mot garde l'état de l'espace qui le précède : deux passages
        # soulignés voisins (« [a] [b] ») ne doivent pas fusionner.
        mots: list[tuple[bool, list[tuple[str, bool]]]] = [(False, [])]
        for c in para:
            if c[0] == " ":
                mots.append((c[1], []))
            else:
                mots[-1][1].append(c)
        mots = [m for m in mots if m[1]]
        courante: list[tuple[str, bool]] = []
        for sep_ul, m in mots:
            essai = courante + ([(" ", sep_ul)] if courante else []) + m
            if courante and police.getlength("".join(c[0] for c in essai)) > largeur:
                lignes.append(courante)
                courante = list(m)
            else:
                courante = essai
        lignes.append(courante)
    return lignes


def rendre(spec: dict, source: str | None, sortie: str) -> list[dict]:
    W, H = spec.get("w", 1080), spec.get("h", 1342)
    fond = spec.get("bg", 254)
    masque = Image.new("L", (W * SS, H * SS), 0)
    d = ImageDraw.Draw(masque)
    rapport = []
    derniere: dict[str, float] = {}
    for bloc in spec["blocks"]:
        if "after" in bloc:
            # enchaînement : la ligne de base suit la dernière ligne du bloc cité
            bloc = {**bloc, "base": derniere[bloc["after"]] + bloc["gap"]}
        taille = bloc["size"]
        police = ImageFont.truetype(POLICE, taille)
        police_ss = ImageFont.truetype(POLICE, taille * SS)
        lignes = couper(parser(bloc["text"]), police, bloc["w"])
        ep = bloc.get("ul_th", taille / 22)
        dy_ul = bloc.get("ul_dy", taille * 0.12)
        for i, ligne in enumerate(lignes):
            texte = "".join(c[0] for c in ligne)
            base = bloc["base"] + i * bloc["pitch"]
            largeur = police_ss.getlength(texte) / SS
            if bloc.get("align") == "right":
                x = bloc["x"] - largeur
            else:
                x = bloc["x"]
            d.text((x * SS, base * SS), texte, font=police_ss, fill=255, anchor="ls")
            # soulignés : runs de caractères marqués
            j = 0
            while j < len(ligne):
                if ligne[j][1]:
                    k = j
                    while k < len(ligne) and ligne[k][1]:
                        k += 1
                    seg = ligne[j:k]
                    # pas d'espace souligné en bord de run
                    while seg and seg[-1][0] == " ":
                        seg = seg[:-1]
                        k -= 1
                    x0 = x + police_ss.getlength(texte[:j]) / SS
                    x1 = x + police_ss.getlength(texte[:k]) / SS
                    yc = base + dy_ul
                    d.rectangle([x0 * SS, (yc - ep / 2) * SS, x1 * SS, (yc + ep / 2) * SS], fill=255)
                    j = k
                else:
                    j += 1
            rapport.append({"bloc": bloc.get("id", ""), "ligne": texte, "x": round(x, 1), "base": base,
                            "fin": round(x + largeur, 1)})
            derniere[bloc.get("id", "")] = base
    m = masque.resize((W, H), Image.BOX)
    src = Image.open(source).convert("RGB") if source else None
    if spec.get("fond_source") and src is not None:
        # On part de la slide d'origine : tout ce qui n'est pas du texte (photos,
        # logos, pictos) reste au pixel près. Seuls les blocs de texte d'origine
        # sont effacés, puis le nouveau texte est posé dessus.
        img = src.copy()
        dimg = ImageDraw.Draw(img)
        for x0, y0, x1, y1 in spec.get("effacer", []):
            dimg.rectangle([x0, y0, x1, y1], fill=(fond, fond, fond))
    else:
        img = Image.new("RGB", (W, H), (fond, fond, fond))
    noir = Image.new("RGB", (W, H), tuple(spec.get("color", (0, 0, 0))))
    img = Image.composite(noir, img, m)

    if src is not None:
        for p in spec.get("photos", []):
            box = tuple(p["box"])
            dst = tuple(p.get("to", box[:2]))
            img.paste(src.crop(box), dst)

    for im in spec.get("images", []):
        coller_image(img, im)

    img.save(sortie, quality=spec.get("quality", 95), optimize=True, subsampling=0)
    return rapport


def coller_image(img: Image.Image, im: dict) -> None:
    """Capture d'appli : recadrage, mise à l'échelle, coins arrondis, liseré, ombre."""
    src = Image.open(im["path"]).convert("RGB")
    if im.get("crop"):
        src = src.crop(tuple(im["crop"]))
    x0, y0, x1, y1 = im["box"]
    w, h = x1 - x0, y1 - y0
    src = src.resize((w, h), Image.LANCZOS)
    r = im.get("radius", 0)
    # masque arrondi, sur-échantillonné pour un bord propre
    mk = Image.new("L", (w * SS, h * SS), 0)
    ImageDraw.Draw(mk).rounded_rectangle([0, 0, w * SS - 1, h * SS - 1], radius=r * SS, fill=255)
    mk = mk.resize((w, h), Image.BOX)
    if im.get("shadow"):
        s = im["shadow"]  # {"blur":.., "dy":.., "alpha":..}
        pad = int(s["blur"] * 3)
        ombre = Image.new("L", (w + 2 * pad, h + 2 * pad), 0)
        ombre.paste(Image.eval(mk, lambda v: int(v * s["alpha"])), (pad, pad))
        ombre = ombre.filter(ImageFilter.GaussianBlur(s["blur"]))
        noir = Image.new("RGB", ombre.size, (0, 0, 0))
        img.paste(noir, (x0 - pad, y0 - pad + s.get("dy", 0)), ombre)
    img.paste(src, (x0, y0), mk)
    if im.get("border"):
        b = im["border"]  # {"w":.., "color":[r,g,b]}
        bm = Image.new("L", (w * SS, h * SS), 0)
        dd = ImageDraw.Draw(bm)
        dd.rounded_rectangle([0, 0, w * SS - 1, h * SS - 1], radius=r * SS, outline=255, width=int(b["w"] * SS))
        bm = bm.resize((w, h), Image.BOX)
        col = Image.new("RGB", (w, h), tuple(b["color"]))
        img.paste(col, (x0, y0), bm)


if __name__ == "__main__":
    spec = json.loads(Path(sys.argv[1]).read_text())
    source = sys.argv[2] if len(sys.argv) > 2 and sys.argv[2] != "-" else None
    rap = rendre(spec, source, sys.argv[3])
    for r in rap:
        print(r)
