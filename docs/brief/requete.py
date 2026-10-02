#!/usr/bin/env python3
"""Sort une requête de requetes.sql, prête à exécuter.

    python3 docs/brief/requete.py --liste
    python3 docs/brief/requete.py Q3                 # jour = aujourd'hui (Paris)
    python3 docs/brief/requete.py Q3 2026-09-28      # rejouer un jour passé

Le SQL sort sur stdout, {{JOUR}} remplacé. Rien n'est exécuté ici : la routine
passe le texte à l'outil Supabase execute_sql, tel quel.
"""
import re
import sys
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

FICHIER = Path(__file__).with_name("requetes.sql")
ENTETE = re.compile(r"^-- ===== (Q\w+) (\w+) =====$", re.M)


def sections() -> dict[str, tuple[str, str]]:
    texte = FICHIER.read_text(encoding="utf-8")
    reperes = list(ENTETE.finditer(texte))
    out = {}
    for i, m in enumerate(reperes):
        fin = reperes[i + 1].start() if i + 1 < len(reperes) else len(texte)
        out[m.group(1)] = (m.group(2), texte[m.end():fin].strip())
    return out


def main() -> None:
    args = sys.argv[1:]
    toutes = sections()
    if not args or args[0] == "--liste":
        for cle, (nom, _) in toutes.items():
            print(f"{cle}\t{nom}")
        return
    cle = args[0]
    if cle not in toutes:
        sys.exit(f"requête inconnue : {cle} (voir --liste)")
    jour = args[1] if len(args) > 1 else datetime.now(ZoneInfo("Europe/Paris")).date().isoformat()
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", jour):
        sys.exit(f"jour invalide : {jour} (AAAA-MM-JJ)")
    print(toutes[cle][1].replace("{{JOUR}}", jour))


if __name__ == "__main__":
    main()
