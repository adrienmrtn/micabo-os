"""Rendu du texte incrusté, appelé par l'Edge Function `bruler-texte`.

Vercel sait faire tourner du Python : c'est ici que vivent Pillow et numpy,
que Deno n'a pas. La fonction ne connaît ni Supabase ni la base — on lui donne
deux URLs d'images, les zones repérées par le LLM et le texte traduit, elle
rend le JPEG. Tout l'état reste côté Edge.
"""

from __future__ import annotations

import base64
import hmac
import io
import json
import os
import sys
import urllib.request
from http.server import BaseHTTPRequestHandler

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from PIL import Image  # noqa: E402

import _burn_core as bc  # noqa: E402

TAILLE_MAX = 24 * 1024 * 1024
QUALITE_DEFAUT = 92


def telecharger(url: str) -> Image.Image:
    if not isinstance(url, str) or not url.startswith("https://"):
        raise ValueError("url d'image invalide")
    requete = urllib.request.Request(url, headers={"User-Agent": "micabo-burn/1"})
    with urllib.request.urlopen(requete, timeout=30) as reponse:
        donnees = reponse.read(TAILLE_MAX + 1)
    if len(donnees) > TAILLE_MAX:
        raise ValueError("image trop lourde")
    return Image.open(io.BytesIO(donnees))


def traiter(charge: dict) -> dict:
    zones = charge.get("zones") or []
    textes = charge.get("textes") or []
    if not zones or not textes:
        raise ValueError("zones et textes sont obligatoires")
    brut = telecharger(charge.get("brut"))
    propre = telecharger(charge.get("propre"))
    image, rapport = bc.bruler(
        brut, propre, zones, textes, gras=bool(charge.get("gras", True))
    )
    tampon = io.BytesIO()
    qualite = int(charge.get("qualite") or QUALITE_DEFAUT)
    image.save(tampon, "JPEG", quality=max(60, min(97, qualite)), subsampling=0)
    return {
        "image": base64.b64encode(tampon.getvalue()).decode("ascii"),
        "typeMime": "image/jpeg",
        "largeur": image.width,
        "hauteur": image.height,
        "rapport": rapport,
    }


class handler(BaseHTTPRequestHandler):
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
