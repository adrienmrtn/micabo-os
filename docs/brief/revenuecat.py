#!/usr/bin/env python3
"""Chiffres RevenueCat du brief, par langue du réseau.

    python3 docs/brief/revenuecat.py                # jour = aujourd'hui (Paris)
    python3 docs/brief/revenuecat.py 2026-10-01

Sort un JSON compact sur stdout. Lecture seule (API v2, Charts & Metrics).

Authentification : si la variable REVENUE_CAT_KEY existe, elle part en
`Authorization: Bearer` ; sinon le proxy sortant de l'environnement injecte la
clé (c'est le cas dans l'environnement cloud — la variable n'est pas visible
de la session, et ne doit jamais être affichée).

Pays → langue : TikTok ne donne aucune vue par pays, donc la langue du compte
sert de substitut. Correspondance validée par Adrien le 01/10/2026 : DE =
Allemagne + Autriche + Suisse ; FR = France + Belgique + Canada (+ Monaco,
Luxembourg) ; ES = Espagne + Amérique latine ; TR = Türkiye. La Suisse est
rangée en DE (majorité germanophone). Tout le reste tombe dans « autres », avec
le détail par pays pour qu'aucun abonné ne disparaisse.
"""
import json
import os
import subprocess
import sys
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

PROJET = "proj415c7a8d"  # « Micabo » — le seul projet que liste la clé
API = f"https://api.revenuecat.com/v2/projects/{PROJET}"

LANGUE_PAR_PAYS = {
    "Germany": "de", "Austria": "de", "Switzerland": "de", "Liechtenstein": "de",
    "France": "fr", "Belgium": "fr", "Canada": "fr", "Monaco": "fr", "Luxembourg": "fr",
    # Outre-mer : la France, que RevenueCat liste à part.
    "Réunion": "fr", "Mayotte": "fr", "Guadeloupe": "fr", "Martinique": "fr",
    "French Guiana": "fr", "French Polynesia": "fr", "New Caledonia": "fr",
    "Saint Martin": "fr", "Saint Barthélemy": "fr", "Saint Pierre and Miquelon": "fr",
    "Wallis and Futuna": "fr",
    "Spain": "es", "Mexico": "es", "Argentina": "es", "Colombia": "es", "Chile": "es",
    "Peru": "es", "Venezuela": "es", "Ecuador": "es", "Guatemala": "es", "Cuba": "es",
    "Bolivia": "es", "Dominican Republic": "es", "Honduras": "es", "Paraguay": "es",
    "El Salvador": "es", "Nicaragua": "es", "Costa Rica": "es", "Panama": "es",
    "Uruguay": "es", "Puerto Rico": "es",
    "Türkiye": "tr", "Turkey": "tr",
}

# Graphiques segmentés par pays : (nom API, mesures gardées).
SEGMENTES = {
    "trials_new": ["New Trials"],
    "actives_new": ["Trial Conversions", "Direct Subscriptions", "Total Paid Subscriptions"],
    "revenue": ["Revenue", "Transactions"],
    "customers_new": ["New Customers"],
}


def appeler(chemin: str) -> dict:
    cmd = ["curl", "-sS", "-m", "40", "--fail-with-body", f"{API}{chemin}"]
    cle = os.environ.get("REVENUE_CAT_KEY")
    if cle:
        cmd[1:1] = ["-H", f"Authorization: Bearer {cle}"]
    sortie = subprocess.run(cmd, capture_output=True, text=True)
    if sortie.returncode != 0:
        raise RuntimeError(f"RevenueCat {chemin.split('?')[0]} : {sortie.stdout[:200] or sortie.stderr[:200]}")
    return json.loads(sortie.stdout)


def jour_de(cohort: int) -> date:
    return datetime.fromtimestamp(cohort, tz=timezone.utc).date()


def fenetres_de(hier: date) -> dict[str, tuple[date, date]]:
    """hier, 7 derniers jours, 7 précédents, et 7j_mur = J-9..J-3 : la même
    fenêtre que les vues mûres de Q1, pour que « nouveaux clients / 100 k vues »
    divise deux choses qui parlent des mêmes jours."""
    return {
        "hier": (hier, hier),
        "7j": (hier - timedelta(days=6), hier),
        "7j_prec": (hier - timedelta(days=13), hier - timedelta(days=7)),
        "7j_mur": (hier - timedelta(days=8), hier - timedelta(days=2)),
    }


def graphique_par_pays(nom: str, gardees: list[str], debut: date, fin: date, hier: date) -> dict:
    d = appeler(f"/charts/{nom}?start_date={debut}&end_date={fin}&resolution=day&segment=country")
    mesures = [m["display_name"] for m in d.get("measures") or []]
    segments = [s["display_name"] for s in d.get("segments") or []]
    # acc[langue][mesure][fenetre] ; pays[(langue, pays)][mesure][fenetre]
    acc = defaultdict(lambda: defaultdict(lambda: defaultdict(float)))
    pays_autres = defaultdict(lambda: defaultdict(float))
    for v in d.get("values") or []:
        mesure = mesures[v["measure"]]
        if mesure not in gardees:
            continue
        seg = segments[v["segment"]] if "segment" in v else "Total"
        if seg == "Total":
            continue  # recalculé à partir des pays, pour que les langues somment au total
        j = jour_de(v["cohort"])
        fenetres = [nom for nom, (a, b) in fenetres_de(hier).items() if a <= j <= b]
        langue = LANGUE_PAR_PAYS.get(seg, "autres")
        for f in fenetres:
            acc[langue][mesure][f] += v["value"]
            acc["TOTAL"][mesure][f] += v["value"]
            if langue == "autres" and f == "7j":
                pays_autres[seg][mesure] += v["value"]
    out = {lg: {m: {f: round(x, 2) for f, x in fs.items()} for m, fs in ms.items()} for lg, ms in acc.items()}
    if d.get("yaxis_currency") and nom == "revenue":
        out["devise"] = d["yaxis_currency"]
    if pays_autres:
        out["autres_detail_7j"] = {p: {m: round(x, 2) for m, x in ms.items()} for p, ms in pays_autres.items()}
    return out


def main() -> None:
    jour = date.fromisoformat(sys.argv[1]) if len(sys.argv) > 1 else datetime.now(ZoneInfo("Europe/Paris")).date()
    hier = jour - timedelta(days=1)
    debut = hier - timedelta(days=13)
    resultat: dict = {"jour": str(jour), "projet": PROJET, "fenetres": {
        nom: f"{a}..{b}" for nom, (a, b) in fenetres_de(hier).items()
    }, "erreurs": []}

    try:
        ov = appeler("/metrics/overview?currency=EUR")
        resultat["overview"] = {m["id"]: {"valeur": m["value"], "periode": m["period"], "unite": m["unit"]}
                                for m in ov.get("metrics", [])}
    except Exception as e:  # une source en panne se dit, elle ne disparaît pas
        resultat["erreurs"].append(str(e))

    for nom, gardees in SEGMENTES.items():
        try:
            resultat[nom] = graphique_par_pays(nom, gardees, debut, hier, hier)
        except Exception as e:
            resultat["erreurs"].append(str(e))

    # Conversion d'essai : graphique de cohortes, non segmenté. Une cohorte
    # récente est « incomplete » tant que ses essais sont en cours (Pending).
    try:
        d = appeler(f"/charts/trial_conversion_rate?start_date={debut}&end_date={hier}&resolution=week")
        mesures = [m["display_name"] for m in d.get("measures") or []]
        cohortes = defaultdict(dict)
        for v in d.get("values") or []:
            cohortes[str(jour_de(v["cohort"]))][mesures[v["measure"]]] = v["value"]
            cohortes[str(jour_de(v["cohort"]))]["incomplete"] = v.get("incomplete")
        resultat["trial_conversion_par_semaine"] = cohortes
    except Exception as e:
        resultat["erreurs"].append(str(e))

    try:
        d = appeler(f"/charts/churn?start_date={debut}&end_date={hier}&resolution=week")
        resultat["churn_resume"] = d.get("summary")
    except Exception as e:
        resultat["erreurs"].append(str(e))

    print(json.dumps(resultat, ensure_ascii=False, separators=(",", ":")))


if __name__ == "__main__":
    main()
