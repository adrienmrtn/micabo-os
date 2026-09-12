"""
burn/engine.py — mesure et rendu. Zéro appel LLM ici, que du déterministe.

Contrat :
    measure_style(screenshot, clean, hints) -> spec dict
    render_spec(clean, spec, out)           -> PNG écrit

Le spec est du JSON pur. C'est la seule chose qui circule entre les étapes.
"""

from __future__ import annotations

import json
import math
import os

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont
from fontTools.ttLib import TTFont

SS = 3                      # supersampling du rendu

# Seule adaptation à l'hébergement : le kit résout `fonts/` depuis le dossier
# courant, ce qu'un lambda n'a pas. Les chemins passent donc par le dossier du
# module. Le reste de ce fichier est le moteur du kit, tel quel.
FONTS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fonts")
FALLBACK = os.path.join(FONTS, "DejaVuSans.ttf")


# ==========================================================================
# Polices
# ==========================================================================

_CMAP_CACHE: dict[str, set] = {}


class FontSet:
    def __init__(self, path: str, size_px: float, fallback: str = FALLBACK):
        self.path = path
        self.main = ImageFont.truetype(path, max(1, round(size_px * SS)))
        try:
            self.fb = ImageFont.truetype(fallback, max(1, round(size_px * SS)))
        except OSError:
            self.fb = self.main
        if path not in _CMAP_CACHE:
            _CMAP_CACHE[path] = set(TTFont(path).getBestCmap().keys())
        self.cmap = _CMAP_CACHE[path]

    def font_for(self, ch: str):
        return self.main if ord(ch) in self.cmap else self.fb

    def advance(self, ch: str) -> float:
        return self.font_for(ch).getlength(ch)


def layout(fs: FontSet, text: str, track_ss: float):
    """(liste (char, x), largeur d'encre, bord gauche d'encre) en px supersamplés."""
    pos, x = [], 0.0
    for ch in text:
        pos.append((ch, x))
        x += fs.advance(ch) + track_ss
    l = r = None
    for ch, x in pos:
        if ch == " ":
            continue
        bb = fs.font_for(ch).getbbox(ch, anchor="ls")
        l = x + bb[0] if l is None else min(l, x + bb[0])
        r = x + bb[2] if r is None else max(r, x + bb[2])
    if l is None:
        return pos, 0.0, 0.0
    return pos, r - l, l


def ink_width(fs: FontSet, text: str, track: float) -> float:
    """Largeur d'encre en pixels de l'image finale."""
    return layout(fs, text, track * SS)[1] / SS


def wrap(fs: FontSet, text: str, track: float, max_w: float) -> list[str]:
    lines, cur = [], ""
    for w in text.split():
        cand = (cur + " " + w).strip()
        if ink_width(fs, cand, track) <= max_w or not cur:
            cur = cand
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def wrap_paragraphs(fs: FontSet, text: str, track: float, max_w: float) -> list:
    """Découpe un texte multi-paragraphes. None = ligne vide."""
    out = []
    for i, para in enumerate(text.split("\n")):
        if i:
            out.append(None) if para.strip() == "" else None
        if para.strip():
            out.extend(wrap(fs, para.strip(), track, max_w))
    return out


# ==========================================================================
# Recalage capture -> image propre
# ==========================================================================


def align(clean_path: str, shot_path: str) -> dict:
    a = cv2.imread(clean_path, cv2.IMREAD_GRAYSCALE)
    b = cv2.imread(shot_path, cv2.IMREAD_GRAYSCALE)
    ha, wa = a.shape
    hb, wb = b.shape

    orb = cv2.ORB_create(10000)
    ka, da = orb.detectAndCompute(a, None)
    kb, db = orb.detectAndCompute(b, None)
    res = {"scale": wa / wb, "tx": 0.0, "ty": 0.0, "inliers": 0, "method": "ratio"}
    if da is None or db is None:
        return res
    matches = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True).match(db, da)
    if len(matches) < 12:
        return res
    src = np.float32([kb[m.queryIdx].pt for m in matches])
    dst = np.float32([ka[m.trainIdx].pt for m in matches])
    M, inl = cv2.estimateAffinePartial2D(src, dst, ransacReprojThreshold=3)
    if M is None or inl is None or int(inl.sum()) < 50:
        return res
    return {
        "scale": float(M[0, 0]),
        "tx": float(M[0, 2]),
        "ty": float(M[1, 2]),
        "inliers": int(inl.sum()),
        "method": "orb",
    }


def to_clean(t: dict, x: float, y: float) -> tuple[float, float]:
    return t["scale"] * x + t["tx"], t["scale"] * y + t["ty"]


# ==========================================================================
# Mesure
# ==========================================================================


def color_mask(img: np.ndarray, target, tol: int = 45) -> np.ndarray:
    d = np.abs(img.astype(int) - np.array(target, dtype=int))
    return d.max(axis=2) <= tol


def group_rows(mask: np.ndarray, gap: int = 6) -> list[tuple[int, int]]:
    rows = np.where(mask.any(axis=1))[0]
    if len(rows) == 0:
        return []
    out, s, p = [], rows[0], rows[0]
    for r in rows[1:]:
        if r - p > gap:
            out.append((int(s), int(p)))
            s = r
        p = r
    out.append((int(s), int(p)))
    return out


def largest_cluster(mask: np.ndarray, y0: int, y1: int, gap: int = 25) -> tuple[int, int]:
    """Bords gauche/droit du groupe de segments contigus le plus large.

    Jette les pixels parasites de même couleur (vêtement, reflet, logo) qui sont
    isolés loin du texte. C'est l'erreur la plus coûteuse du pipeline.
    """
    cols = np.where(mask[y0 : y1 + 1].any(axis=0))[0]
    if len(cols) == 0:
        return (0, 0)
    runs, s, p = [], cols[0], cols[0]
    for c in cols[1:]:
        if c - p > gap:
            runs.append([int(s), int(p)])
            s = c
        p = c
    runs.append([int(s), int(p)])
    # fusionne les segments proches, garde le groupe le plus large
    merged = [runs[0]]
    for a, b in runs[1:]:
        if a - merged[-1][1] <= gap * 3:
            merged[-1][1] = b
        else:
            merged.append([a, b])
    best = max(merged, key=lambda r: r[1] - r[0])
    return best[0], best[1]


def line_metrics(mask: np.ndarray, y0: int, y1: int) -> dict:
    prof = mask[y0 : y1 + 1].sum(axis=1).astype(float)
    peak = prof.max() if prof.size else 0
    if peak == 0:
        return {}
    xh_top = y0 + int(np.argmax(prof > peak * 0.45))
    baseline = y0 + int(np.where(prof > peak * 0.30)[0].max())
    return {
        "top": y0,
        "x_height_top": xh_top,
        "baseline": baseline,
        "x_height": baseline - xh_top,
        "ascender": baseline - y0,
    }


def detect_align(bounds: list[tuple[int, int]]) -> str:
    if len(bounds) < 2:
        return "left"
    lefts = [b[0] for b in bounds]
    rights = [b[1] for b in bounds]
    centers = [(a + b) / 2 for a, b in bounds]
    sp = lambda v: max(v) - min(v)
    return min(
        [("left", sp(lefts)), ("center", sp(centers)), ("right", sp(rights))],
        key=lambda t: t[1],
    )[0]


def fit_size_zero_tracking(font: str, samples: list[tuple[str, float]], probe: float = 100.0):
    """Taille qui reproduit les largeurs mesurées, sans tracking.

    RÈGLE : caler la taille sur la LARGEUR, pas sur la hauteur des lettres.
    Le seuil du masque gonfle la hauteur de 2-3 px, ce qui donne une taille 10 %
    trop grande, puis un tracking négatif qui colle les mots entre eux.
    """
    fs = FontSet(font, probe)
    ratios = [t / ink_width(fs, s, 0) for s, t in samples if ink_width(fs, s, 0) > 0]
    if not ratios:
        return probe, []
    med = float(np.median(ratios))
    keep = [r for r in ratios if abs(r - med) / med < 0.08]   # écarte les lignes mal mesurées
    return probe * float(np.mean(keep or ratios)), [round(r, 3) for r in ratios]


def font_score(font: str, text: str, width: float, x_height: float) -> dict:
    fs = FontSet(font, 100.0)
    w = ink_width(fs, text, 0)
    if w <= 0:
        return {"font": font, "ratio": 99}
    s_w = 100.0 * width / w
    probe = ImageFont.truetype(font, 1000)
    s_h = x_height / (-probe.getbbox("x", anchor="ls")[1] / 1000.0)
    return {"font": font, "size_w": round(s_w, 1), "size_h": round(s_h, 1),
            "ratio": round(s_w / s_h, 3)}


def pick_font(candidates: list[str], text: str, width: float, x_height: float) -> dict:
    scores = [font_score(f, text, width, x_height) for f in candidates]
    return min(scores, key=lambda s: abs(s["ratio"] - 1.0))


def measure_block(shot_rgb: np.ndarray, hint: dict, t: dict, candidates: list[str]) -> dict:
    """Mesure un bloc de texte repéré par le LLM et renvoie un spec de bloc.

    hint : {"color":[r,g,b] | None, "bbox":[x0,y0,x1,y1], "text":"...", "outline":bool}
    t    : transformation capture -> image propre
    """
    x0, y0, x1, y1 = [int(v) for v in hint["bbox"]]
    x0, y0 = max(0, x0), max(0, y0)
    x1 = min(shot_rgb.shape[1], x1)
    y1 = min(shot_rgb.shape[0], y1)
    crop = shot_rgb[y0:y1, x0:x1]

    color = hint.get("color")
    if not color:
        color = auto_text_color(crop, hint.get("style_hint", "light"))
    mask_full = np.zeros(shot_rgb.shape[:2], bool)
    mask_full[y0:y1, x0:x1] = color_mask(crop, color, tol=hint.get("tol", 45))

    rows = group_rows(mask_full, gap=max(4, int(0.004 * shot_rgb.shape[0])))
    rows = [r for r in rows if r[1] - r[0] > 4]
    if not rows:
        raise ValueError("aucune ligne détectée, vérifier la couleur ou la bbox")

    lines = []
    for a, b in rows:
        l, r = largest_cluster(mask_full, a, b)
        m = line_metrics(mask_full, a, b)
        if not m or r - l < 5:
            continue
        lines.append({"left": l, "right": r, "width": r - l, **m})

    src_lines = [s for s in hint["text"].split("\n") if s.strip()]
    if len(src_lines) != len(lines):
        # le LLM a mal découpé, ou une ligne a été ratée : on garde le minimum commun
        n = min(len(src_lines), len(lines))
        src_lines, lines = src_lines[:n], lines[:n]

    samples = [(s, lines[i]["width"] * t["scale"]) for i, s in enumerate(src_lines)]
    x_h = float(np.median([l["x_height"] for l in lines])) * t["scale"]
    best = pick_font(candidates, samples[0][0], samples[0][1], x_h)
    size, ratios = fit_size_zero_tracking(best["font"], samples)

    align_mode = detect_align([(l["left"], l["right"]) for l in lines])
    if align_mode == "left":
        anchor = to_clean(t, lines[0]["left"], 0)[0]
    elif align_mode == "right":
        anchor = to_clean(t, lines[0]["right"], 0)[0]
    else:
        anchor = to_clean(t, (lines[0]["left"] + lines[0]["right"]) / 2, 0)[0]

    baselines = [to_clean(t, 0, l["baseline"])[1] for l in lines]
    pitch = (baselines[-1] - baselines[0]) / (len(baselines) - 1) if len(baselines) > 1 else 0.0

    stroke = 0.0
    if hint.get("outline"):
        stroke = measure_stroke(shot_rgb, mask_full, lines[0]) * t["scale"]
        if not (0.03 * size <= stroke <= 0.10 * size):
            stroke = STROKE_RATIO * size          # mesure douteuse, on reprend le ratio calibré

    # largeur de boîte : entre la ligne la plus large et cette ligne + le mot suivant
    widths = [s[1] for s in samples]
    box = max(widths) * 1.08
    if len(samples) > 1:
        fs = FontSet(best["font"], size)
        for i in range(len(samples) - 1):
            nxt = samples[i + 1][0].split()[0]
            box = min(box, widths[i] + ink_width(fs, " " + nxt, 0) * 0.9)
        box = max(box, max(widths) * 1.02)

    return {
        "font": best["font"],
        "size": round(size, 2),
        "track": 0.0,
        "color": [int(c) for c in color],
        "align": align_mode,
        "anchor_x": round(anchor, 1),
        "baseline": round(baselines[0], 1),
        "pitch": round(pitch, 1),
        "stroke": round(stroke, 2),
        "stroke_color": hint.get("stroke_color", [0, 0, 0]),
        "shadow": hint.get("shadow", {}),
        "box_width": round(box, 1),
        "bbox_shot": [x0, y0, x1, y1],
        "bbox_clean": [*to_clean(t, x0, y0), *to_clean(t, x1, y1)],
        "debug": {"font_score": best, "width_ratios": ratios, "n_lines": len(lines)},
    }


def auto_text_color(crop: np.ndarray, style: str = "light") -> list[int]:
    """Couleur dominante du texte : le pic clair (ou sombre) de l'histogramme."""
    flat = crop.reshape(-1, 3)
    lum = flat.mean(axis=1)
    sel = flat[lum > np.percentile(lum, 97)] if style == "light" else flat[lum < np.percentile(lum, 3)]
    return [int(v) for v in np.median(sel, axis=0)]


def measure_stroke(shot: np.ndarray, mask: np.ndarray, line: dict) -> float:
    """Épaisseur du contour : pixels sombres contigus juste avant le remplissage.

    Mesuré sur plusieurs rangées de la bande d'x, médiane des valeurs plausibles.
    Une seule rangée suffit à se tromper d'un facteur deux quand elle tombe sur
    une zone sombre du fond.
    """
    xh = max(4, line["x_height"])
    ys = np.linspace(line["baseline"] - xh * 0.8, line["baseline"] - xh * 0.2, 7).astype(int)
    vals = []
    for y in ys:
        if y < 0 or y >= mask.shape[0]:
            continue
        xs = np.where(mask[y])[0]
        if len(xs) == 0:
            continue
        for x in (xs.min(), xs.max()):
            step = -1 if x == xs.min() else 1
            n, k = 0, x
            while 0 <= k + step < shot.shape[1] and shot[y, k + step].mean() < 110 and n <= xh * 0.4:
                n += 1
                k += step
            if 0 < n <= xh * 0.35:
                vals.append(n)
    return float(np.percentile(vals, 35)) if vals else 0.0


# Rapport contour / taille de police observé sur les styles TikTok à contour.
# Sert de valeur de repli quand la mesure géométrique n'est pas plausible,
# ce qui arrive dès que le fond derrière le texte est sombre.
STROKE_RATIO = 0.065


# ==========================================================================
# Garde-fous : rien ne doit sortir du cadre
# ==========================================================================


def fit_to_frame(spec_block: dict, lines_text: str, img_size, margin: float = 0.04) -> dict:
    """Réduit la taille et re-découpe jusqu'à ce que le bloc tienne dans l'image.

    C'est ce garde-fou qui manque quand le texte déborde. Il est non négociable :
    on ne rend jamais un bloc qui n'est pas passé par là.
    """
    W, H = img_size
    mx = W * margin
    block = dict(spec_block)
    size = block["size"]
    for _ in range(24):
        fs = FontSet(block["font"], size)
        box = min(block.get("box_width", W), W - 2 * mx)
        lines = wrap_paragraphs(fs, lines_text, block["track"], box)
        widths = [ink_width(fs, l, block["track"]) for l in lines if l]
        n = len(lines)
        pitch = block["pitch"] or size * 1.2
        pitch *= size / spec_block["size"]
        top = block["baseline"] - size * 0.8
        bottom = block["baseline"] + (n - 1) * pitch + size * 0.25
        ok_w = all(w <= W - 2 * mx for w in widths)
        if block["align"] == "center":
            ok_x = all(block["anchor_x"] - w / 2 >= mx and block["anchor_x"] + w / 2 <= W - mx for w in widths)
        elif block["align"] == "left":
            ok_x = all(block["anchor_x"] + w <= W - mx for w in widths)
        else:
            ok_x = all(block["anchor_x"] - w >= mx for w in widths)
        ok_y = top >= 0 and bottom <= H
        if ok_w and ok_x and ok_y:
            block["size"] = size
            block["pitch"] = pitch
            block["stroke"] = spec_block["stroke"] * size / spec_block["size"]
            block["lines"] = lines
            block["fitted_ratio"] = round(size / spec_block["size"], 3)
            return block
        size *= 0.94
    raise ValueError("impossible de faire tenir le texte, raccourcir la traduction")


# ==========================================================================
# Rendu
# ==========================================================================


def draw_block(base: Image.Image, b: dict, onto: Image.Image | None = None) -> Image.Image:
    W, H = base.size
    fs = FontSet(b["font"], b["size"])
    fill = Image.new("L", (W * SS, H * SS), 0)
    stroke = Image.new("L", (W * SS, H * SS), 0)
    df, ds = ImageDraw.Draw(fill), ImageDraw.Draw(stroke)

    for i, line in enumerate(b["lines"]):
        if not line:
            continue
        chars, w, left = layout(fs, line, b["track"] * SS)
        if b["align"] == "left":
            start = b["anchor_x"] * SS - left
        elif b["align"] == "center":
            start = b["anchor_x"] * SS - w / 2 - left
        else:
            start = b["anchor_x"] * SS - w - left
        y = (b["baseline"] + i * b["pitch"]) * SS
        for ch, x in chars:
            if ch == " ":
                continue
            f = fs.font_for(ch)
            if b.get("stroke"):
                ds.text((start + x, y), ch, font=f, anchor="ls", fill=255,
                        stroke_width=max(1, round(b["stroke"] * SS)), stroke_fill=255)
            df.text((start + x, y), ch, font=f, anchor="ls", fill=255)

    fill = fill.resize((W, H), Image.LANCZOS)
    stroke = stroke.resize((W, H), Image.LANCZOS)
    img = (onto or base).convert("RGBA")

    sh = b.get("shadow") or {}
    if sh:
        s = fill.filter(ImageFilter.GaussianBlur(sh.get("blur", 5)))
        s = s.point(lambda v: int(v * sh.get("alpha", 0.4)))
        s = s.transform(s.size, Image.AFFINE, (1, 0, -sh.get("dx", 0), 0, 1, -sh.get("dy", 0)))
        img = Image.composite(Image.new("RGBA", (W, H), (0, 0, 0, 255)), img, s)
    if b.get("stroke"):
        img = Image.composite(Image.new("RGBA", (W, H), tuple(b["stroke_color"]) + (255,)), img, stroke)
    img = Image.composite(Image.new("RGBA", (W, H), tuple(b["color"]) + (255,)), img, fill)
    return img


def render_spec(clean_path: str, spec: dict, out_path: str) -> Image.Image:
    base = Image.open(clean_path)
    img = None
    for b in spec["blocks"]:
        img = draw_block(base, b, onto=img)
    out = img.convert("RGB")
    out.save(out_path, quality=95)
    return out


# ==========================================================================
# Nettoyage d'une slide sans plaque propre
# ==========================================================================


def inpaint_text(shot_path: str, spec_blocks: list[dict], out_path: str, grow: int = 12) -> str:
    """Efface le texte d'origine par inpainting, quand il n'y a pas d'image propre.

    Marche sur fond simple ou flou. Sur un fond détaillé, ça se voit : mieux vaut
    récupérer la vraie plaque propre.
    """
    img = cv2.imread(shot_path)
    rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    mask = np.zeros(img.shape[:2], np.uint8)
    for b in spec_blocks:
        m = color_mask(rgb, b["color"], tol=60)
        mask |= (m * 255).astype(np.uint8)
    mask = cv2.dilate(mask, np.ones((grow, grow), np.uint8))
    out = cv2.inpaint(img, mask, 7, cv2.INPAINT_TELEA)
    cv2.imwrite(out_path, out)
    return out_path


# ==========================================================================
# Contrôle qualité
# ==========================================================================


def qa_selftest(clean_path: str, shot_path: str, spec: dict, t: dict, source_text: list[str]) -> dict:
    """Rend le texte SOURCE avec le spec, remesure, compare à la capture.

    Tant que ce test ne passe pas, ne pas rendre la traduction.
    """
    base = Image.open(clean_path)
    W, H = base.size
    shot = np.array(Image.open(shot_path).convert("RGB"))
    report = []
    for b, text in zip(spec["blocks"], source_text):
        test = dict(b)
        fs = FontSet(b["font"], b["size"])
        test["lines"] = wrap_paragraphs(fs, text, b["track"], b["box_width"])
        img = np.array(draw_block(base, test).convert("RGB"))

        def bound(m, bbox, pad):
            out = np.zeros_like(m)
            x0, y0, x1, y1 = [int(v) for v in bbox]
            out[max(0, y0 - pad): y1 + pad, max(0, x0 - pad): x1 + pad] = \
                m[max(0, y0 - pad): y1 + pad, max(0, x0 - pad): x1 + pad]
            return out

        mask = bound(color_mask(img, b["color"], tol=40), b["bbox_clean"], 60)
        rows = [r for r in group_rows(mask) if r[1] - r[0] > 4]
        smask = bound(color_mask(shot, b["color"], tol=45), b["bbox_shot"], 10)
        srows = [r for r in group_rows(smask) if r[1] - r[0] > 4]
        n = min(len(rows), len(srows))
        d_base, d_width = [], []
        for i in range(n):
            m1 = line_metrics(mask, *rows[i])
            m2 = line_metrics(smask, *srows[i])
            l1, r1 = largest_cluster(mask, *rows[i])
            l2, r2 = largest_cluster(smask, *srows[i])
            d_base.append(m1["baseline"] - (m2["baseline"] * t["scale"] + t["ty"]))
            d_width.append((r1 - l1) - (r2 - l2) * t["scale"])
        tol_pos = 0.005 * W
        tol_w = 0.02 * W
        report.append({
            "lines_source": len(srows),
            "lines_render": len(rows),
            "max_d_baseline": round(max(map(abs, d_base)), 1) if d_base else None,
            "max_d_width": round(max(map(abs, d_width)), 1) if d_width else None,
            "pass": bool(d_base and max(map(abs, d_base)) < tol_pos
                         and max(map(abs, d_width)) < tol_w
                         and len(rows) == len(srows)),
        })
    return {"blocks": report, "pass": all(r["pass"] for r in report)}


if __name__ == "__main__":
    import sys
    render_spec(sys.argv[1], json.load(open(sys.argv[2])), sys.argv[3])
