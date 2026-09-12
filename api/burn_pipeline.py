"""
burn/pipeline.py du kit, adapté à un appel HTTP plutôt qu'à la ligne de commande.

Les deux appels LLM — lecture du style, traduction — vivent côté Edge, qui a la
clé Fal et les decks. Ce module reçoit donc leur résultat au lieu de les faire,
et enchaîne les étapes du kit dans le même ordre : recalage, mesure, autotest
dans la langue source, ajustement au cadre, rendu.

`font_candidates` et `candidates_for_style` sont repris tels quels. Les boîtes
arrivent déjà en pixels de la capture : c'est la lecture côté Edge qui les
normalise, le kit les prend telles quelles.
"""

from __future__ import annotations

import glob
import os

import numpy as np
from PIL import Image

import burn_engine as engine

FONTS = engine.FONTS


def font_candidates(folder: str) -> list[str]:
    files = sorted(
        glob.glob(os.path.join(folder, "*.ttf")) + glob.glob(os.path.join(folder, "*.otf"))
    )
    return [f for f in files if "DejaVu" not in f]


def candidates_for_style(folder: str, style: str) -> list[str]:
    """Restreint les candidats au bon genre de police. Sinon le score compare
    un serif gras à un sans léger et se trompe."""
    all_f = font_candidates(folder)
    def has(f, *keys): return any(k in os.path.basename(f).lower() for k in keys)
    if style.startswith("serif_italique"):
        sel = [f for f in all_f if has(f, "italic", "-it")]
    elif style.startswith("serif"):
        sel = [f for f in all_f if has(f, "serif", "bonum", "schola", "playfair", "bodoni")
               and not has(f, "italic", "-it")]
    else:
        sel = [f for f in all_f if has(f, "tiktok", "tts", "figtree", "mulish", "montserrat", "sans")
               and not has(f, "italic", "-it", "dejavu")]
    return sel or all_f


def run_slide(
    shot: str,
    clean: str,
    blocks: list[dict],
    translations: dict[str, dict],
    fonts: str = FONTS,
) -> dict:
    """Une slide, du recalage au rendu. Mêmes étapes que `run_slide` du kit."""
    # 1. recalage
    t = engine.align(clean, shot)

    # 3. mesure (la lecture LLM, étape 2, est faite par l'appelant)
    shot_rgb = np.array(Image.open(shot).convert("RGB"))
    spec = {"blocks": []}
    for b in blocks:
        hint = {
            "bbox": b["bbox"],
            "text": b["text"],
            "color": b.get("color"),
            "outline": b.get("outline", False),
            "stroke_color": b.get("outline_color", [0, 0, 0]),
        }
        block = engine.measure_block(
            shot_rgb, hint, t, candidates_for_style(fonts, b.get("style", "sans"))
        )
        block["id"] = b["id"]
        spec["blocks"].append(block)

    # 4. autotest dans la langue source, AVANT de traduire
    source_text = [b["text"].replace("\n", " ") for b in blocks]
    qa = engine.qa_selftest(clean, shot, spec, t, source_text)

    # 6. ajustement au cadre puis rendu
    base = Image.open(clean)
    reductions = {}
    for block in spec["blocks"]:
        cible = translations.get(block["id"], {})
        texte = cible.get("text", "")
        try:
            fitted = engine.fit_to_frame(block, texte, base.size)
        except ValueError:
            court = cible.get("text_short") or texte
            fitted = engine.fit_to_frame(block, court, base.size)
        block.update(fitted)
        if fitted.get("fitted_ratio", 1) < 1:
            reductions[block["id"]] = fitted["fitted_ratio"]

    return {
        "spec": spec,
        "selftest": qa,
        "align": t,
        "reductions": reductions,
    }
