"""Rendu d'un white post entier, une série d'images par langue.

Chaque slide part de l'image d'origine (`fond_source`) : on efface seulement
les blocs de texte, on pose le texte de la langue, et la slide publicitaire
reçoit la capture micabo de la langue (et, si l'original en avait une, la
bannière App Store). Les métadonnées sont retirées de chaque JPEG.

Une slide se décrit ainsi :

    {
      "effacer": [(x0, y0, x1, y1), ...],      # blocs de texte d'origine
      "photos": [{"box": ..., "to": ...}],     # facultatif : photo déplacée
      "pub": {"box": ..., "banniere": (x, y, largeur)},  # facultatif
      "blocks": [{..., "text": {"fr": ..., "de": ..., "tr": ...}}],
    }
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from rendu import rendre  # noqa: E402
from sans_meta import nettoyer  # noqa: E402

# Recadrage de la capture d'appli : barre d'état jusqu'aux boutons de notation.
RECADRAGE_CAPTURE = (0, 0, 739, 1450)


def banniere_app_store(chemin_listing: str, sortie: str) -> str:
    """Carte App Store compacte : l'icône et le nom, découpés au pixel dans la
    fiche fournie, le nom centré sur l'icône. Le sous-titre (anglais) n'est pas
    repris : il ne parlerait pas la langue du post."""
    im = Image.open(chemin_listing).convert("RGB")
    fond = im.getpixel((600, 225))
    icone = im.crop((56, 28, 244, 215))           # icône + son ombre
    nom = im.crop((266, 66, 456, 114))            # « Micabo »
    pad = 18
    W = pad + icone.width + 22 + nom.width + 40
    H = icone.height + 2 * (pad - 8)
    carte = Image.new("RGB", (W, H), fond)
    carte.paste(icone, (pad, (H - icone.height) // 2))
    carte.paste(nom, (pad + icone.width + 22, (H - nom.height) // 2))
    carte.save(sortie, quality=95)
    return sortie


def spec_langue(slide: dict, langue: str, captures: dict, banniere: str | None) -> dict:
    spec = {"fond_source": True, "effacer": [list(b) for b in slide.get("effacer", [])]}
    if slide.get("photos"):
        spec["photos"] = slide["photos"]
    images = []
    pub = slide.get("pub")
    if pub:
        x0, y0, x1, y1 = pub["box"]
        # La capture garde son ratio dans la boîte de la pub d'origine, centrée.
        cw, ch = RECADRAGE_CAPTURE[2] - RECADRAGE_CAPTURE[0], RECADRAGE_CAPTURE[3] - RECADRAGE_CAPTURE[1]
        echelle = min((x1 - x0) / cw, (y1 - y0) / ch)
        w, h = round(cw * echelle), round(ch * echelle)
        bx = x0 + ((x1 - x0) - w) // 2 + pub.get("dx", 0)
        by = y0 + pub.get("dy", 0)
        images.append({
            "path": captures[langue], "crop": list(RECADRAGE_CAPTURE), "box": [bx, by, bx + w, by + h],
            "radius": 30, "border": {"w": 1.5, "color": [222, 222, 226]},
            "shadow": {"blur": 16, "alpha": 0.10, "dy": 6},
        })
        if pub.get("banniere") and banniere:
            bxx, byy, bw = pub["banniere"]
            bi = Image.open(banniere)
            bh = round(bi.height * bw / bi.width)
            images.append({"path": banniere, "box": [bxx, byy, bxx + bw, byy + bh], "radius": 14,
                           "border": {"w": 1.2, "color": [226, 226, 230]}})
    if images:
        spec["images"] = images
    blocs = []
    for b in slide["blocks"]:
        t = b["text"][langue] if isinstance(b["text"], dict) else b["text"]
        if t is None:
            continue
        blocs.append({**{k: v for k, v in b.items() if k != "text"}, "text": t})
    spec["blocks"] = blocs
    return spec


def rendre_post(slides: list[dict], origine: Path, prefixe: str, captures: dict, banniere: str | None,
                sortie: Path, langues: list[str]) -> None:
    for langue in langues:
        (sortie / langue).mkdir(parents=True, exist_ok=True)
        for n, slide in enumerate(slides, start=1):
            spec = spec_langue(slide, langue, captures, banniere)
            fichier = sortie / langue / f"{n}.jpg"
            rapport = rendre(spec, str(origine / f"{prefixe}_{n}.bin"), str(fichier))
            fichier.write_bytes(nettoyer(fichier.read_bytes()))
            (sortie / langue / f"{n}.json").write_text(json.dumps(spec, ensure_ascii=False, indent=1))
            (sortie / langue / f"{n}.lignes.json").write_text(json.dumps(rapport, ensure_ascii=False, indent=1))
            print(fichier)
