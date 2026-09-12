"""Rendu du texte incrusté, appelé par l'Edge Function `bruler-texte`.

Vercel sait faire tourner du Python : c'est ici que vivent Pillow, numpy et
OpenCV, que Deno n'a pas. La fonction ne connaît ni Supabase ni la base — on lui
donne les deux images, ce que le LLM a lu et ce qu'il a traduit, elle rend le
JPEG. Tout l'état reste côté Edge.

Le moteur est celui du kit (`burn_engine.py`), et l'enchaînement des étapes
celui de son pipeline (`burn_pipeline.py`). Rien n'est mesuré ici.
"""

from __future__ import annotations

import base64
import hmac
import io
import json
import os
import sys
import tempfile
import urllib.request
from http.server import BaseHTTPRequestHandler

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from PIL import Image  # noqa: E402

import burn_engine as engine  # noqa: E402
import burn_pipeline as pipeline  # noqa: E402

TAILLE_MAX = 24 * 1024 * 1024
QUALITE_DEFAUT = 92


def telecharger(url: str, vers: str) -> str:
    if not isinstance(url, str) or not url.startswith("https://"):
        raise ValueError("url d'image invalide")
    requete = urllib.request.Request(url, headers={"User-Agent": "micabo-burn/1"})
    with urllib.request.urlopen(requete, timeout=30) as reponse:
        donnees = reponse.read(TAILLE_MAX + 1)
    if len(donnees) > TAILLE_MAX:
        raise ValueError("image trop lourde")
    # Les fonctions du kit prennent des chemins : on écrit le fichier tel quel,
    # sans réencoder — un réencodage changerait les pixels que la mesure lit.
    with open(vers, "wb") as f:
        f.write(donnees)
    return vers


def traiter(charge: dict) -> dict:
    blocks = charge.get("blocks") or []
    traductions = charge.get("translations") or {}
    if not blocks:
        raise ValueError("blocks est obligatoire")

    with tempfile.TemporaryDirectory() as dossier:
        shot = telecharger(charge.get("shot"), os.path.join(dossier, "shot.img"))
        clean = telecharger(charge.get("clean"), os.path.join(dossier, "clean.img"))
        resultat = pipeline.run_slide(shot, clean, blocks, traductions)

        sortie = os.path.join(dossier, "out.png")
        engine.render_spec(clean, resultat["spec"], sortie)
        image = Image.open(sortie).convert("RGB")

    tampon = io.BytesIO()
    qualite = int(charge.get("qualite") or QUALITE_DEFAUT)
    image.save(tampon, "JPEG", quality=max(60, min(97, qualite)), subsampling=0)
    return {
        "image": base64.b64encode(tampon.getvalue()).decode("ascii"),
        "typeMime": "image/jpeg",
        "largeur": image.width,
        "hauteur": image.height,
        # Règle non négociable du kit : on rend le texte source avec le style
        # mesuré et on le compare à la capture. Tant que ça ne passe pas, on ne
        # publie pas la traduction.
        "fiable": bool(resultat["selftest"]["pass"]),
        "selftest": resultat["selftest"],
        "align": resultat["align"],
        "reductions": resultat["reductions"],
        "spec": [
            {k: v for k, v in b.items() if k not in ("debug",)}
            for b in resultat["spec"]["blocks"]
        ],
        "debug": [b.get("debug") for b in resultat["spec"]["blocks"]],
    }


class handler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:  # noqa: N802 (signature imposée par Vercel)
        """Contrôle de présence — rien de secret, rien de la base.

        Les polices voyagent par `includeFiles` et fontTools par
        `requirements.txt` : si l'un manquait, le premier burn échouerait en
        production sans qu'on sache pourquoi.
        """
        polices = (
            sorted(os.path.basename(f) for f in pipeline.font_candidates(engine.FONTS))
            if os.path.isdir(engine.FONTS)
            else []
        )
        try:
            table = bool(engine.FontSet(polices and os.path.join(engine.FONTS, polices[0]), 40).cmap)
        except Exception:
            table = False
        self._repondre(200 if polices else 500, {
            "ok": bool(polices),
            "polices": polices,
            "table": table,
            "secret": bool(os.environ.get("BURN_SECRET")),
        })

    def do_POST(self) -> None:  # noqa: N802 (signature imposée par Vercel)
        attendu = os.environ.get("BURN_SECRET") or ""
        fourni = self.headers.get("x-burn-secret") or ""
        if not attendu or not hmac.compare_digest(attendu, fourni):
            return self._repondre(401, {"erreur": "secret invalide"})
        try:
            taille = int(self.headers.get("content-length") or 0)
            charge = json.loads(self.rfile.read(taille) or b"{}")
        except Exception:
            return self._repondre(400, {"erreur": "corps illisible"})
        try:
            return self._repondre(200, traiter(charge))
        except ValueError as erreur:
            return self._repondre(400, {"erreur": str(erreur)})
        except Exception as erreur:  # pragma: no cover - filet de sécurité
            return self._repondre(500, {"erreur": f"{type(erreur).__name__}: {erreur}"})

    def _repondre(self, code: int, corps: dict) -> None:
        donnees = json.dumps(corps).encode("utf-8")
        self.send_response(code)
        self.send_header("content-type", "application/json; charset=utf-8")
        self.send_header("content-length", str(len(donnees)))
        self.end_headers()
        self.wfile.write(donnees)
