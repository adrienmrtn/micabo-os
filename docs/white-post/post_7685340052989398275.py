"""White post @amayareading 7685340052989398275 — « 10/10 habits to become
smart again (niche edition #2) » (212 700 vues, 6 slides), en FR, DE et TR.

Ce post n'a pas de slide publicitaire. La slide micabo est la slide 5
(« explain what you learn out loud ») : sa photo (la personne au tableau) est
remplacée par la capture micabo de la langue, et le texte garde l'idée
d'origine (expliquer de mémoire, les trous deviennent évidents) en y ajoutant
micabo sous l'angle « se faire interroger : les trous se voient tout de
suite ».

    python3 -I post_7685340052989398275.py <slides_origine/> <cap_fr> <cap_de> <cap_tr> <sortie/> [fr,de,tr]
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from post_lib import rendre_post  # noqa: E402

ID = "7685340052989398275"
NB = " "

SLIDES = [
    {  # 1 — titre
        "effacer": [(88, 238, 912, 388), (482, 1010, 810, 1066)],
        "blocks": [
            {"id": "titre", "x": 96, "base": 294, "size": 63, "pitch": 73, "w": 880, "text": {
                "fr": "10/10 habitudes pour retrouver\nun cerveau vif",
                "de": "10/10 Gewohnheiten für\neinen wachen Kopf",
                "tr": "zihnini yeniden keskinleştirecek\n10/10 alışkanlık",
            }},
            {"id": "sous", "x": 802, "align": "right", "base": 1051, "size": 42, "pitch": 48, "w": 990, "text": {
                "fr": "(édition niche n°2)",
                "de": "(Nischen-Edition #2)",
                "tr": "(niş seri #2)",
            }},
        ],
    },
    {  # 2 — ne pas tout googler
        "effacer": [(38, 232, 728, 384), (38, 428, 806, 530), (640, 608, 975, 856), (36, 957, 820, 1062)],
        "blocks": [
            {"id": "titre", "x": 44.6, "base": 286, "size": 63, "pitch": 73, "w": 900, "text": {
                "fr": "arrête de tout googler\n[immédiatement]",
                "de": "hör auf, alles\n[sofort] zu googeln",
                "tr": "her şeyi [anında]\nGoogle’da aramayı bırak",
            }},
            {"id": "p1", "x": 44.5, "base": 467, "size": 42, "pitch": 48, "w": 850, "text": {
                "fr": f"laisse [30 à 60{NB}secondes] à ton cerveau pour trouver la réponse, avant Google ou l’IA",
                "de": f"gib deinem Gehirn [30 bis 60{NB}Sekunden] für die Antwort, bevor du Google oder KI fragst",
                "tr": f"cevap için Google’a ya da yapay zekâya gitmeden önce beynine [30-60{NB}saniye] ver",
            }},
            {"id": "p2", "x": 646.5, "base": 647, "size": 42, "pitch": 48, "w": 375, "text": {
                "fr": "déléguer sans arrêt ta mémoire te rend [moins capable] d’utiliser [ce que tu sais déjà]",
                "de": "wer dauernd nachschlägt, kann [immer schlechter] nutzen, [was im Kopf schon da ist]",
                "tr": "hatırlama işini sürekli dışarıya bırakmak, [zaten bildiklerini] kullanmanı [zorlaştırır]",
            }},
            {"id": "p3", "x": 44.5, "base": 996, "size": 42, "pitch": 48, "w": 800, "text": {
                "fr": f"[galère] d’abord sur la question, n’oublie pas{NB}: c’est comme ça que tu [apprends]",
                "de": "[kämpf] erst selbst mit der Frage, denk dran: genau so [lernst] du",
                "tr": "önce soruyla kendin [boğuş], unutma: [öğrenmek] böyle olur",
            }},
        ],
    },
    {  # 3 — apprendre sans but
        "effacer": [(62, 228, 845, 374), (58, 472, 505, 672), (56, 762, 510, 864), (60, 982, 900, 1130),
                    (58, 1175, 765, 1232)],
        "blocks": [
            {"id": "titre", "x": 67, "base": 282, "size": 63, "pitch": 73, "w": 860, "text": {
                "fr": "apprends des choses [sans]\n[utilité évidente]",
                "de": "lern Dinge [ohne erkennbaren]\n[Nutzen]",
                "tr": "[belli bir getirisi olmayan]\nşeyler öğren",
            }},
            {"id": "p1", "x": 63.4, "base": 511, "size": 42, "pitch": 48, "w": 470, "text": {
                "fr": "histoire, philosophie, physique, économie, langues, tout ce qui t’intéresse vraiment",
                "de": "Geschichte, Philosophie, Physik, Wirtschaft, Sprachen, alles, was dich wirklich interessiert",
                "tr": "tarih, felsefe, fizik, ekonomi, diller, gerçekten neyi merak ediyorsan",
            }},
            {"id": "p2", "x": 63, "base": 800, "size": 42, "pitch": 48, "w": 440, "text": {
                "fr": "[chaque heure n’a pas à être rentable]",
                "de": "[nicht jede Stunde muss Geld bringen]",
                "tr": "[her saatin para kazandırması şart değil]",
            }},
            {"id": "p3", "x": 65.4, "base": 1021, "size": 42, "pitch": 48.5, "w": 860, "text": {
                "fr": "des connaissances variées donnent à ton cerveau plus d’idées à relier le jour où tu dois vraiment résoudre un problème",
                "de": "breites Wissen gibt deinem Gehirn mehr Ideen zum Verknüpfen, wenn du wirklich mal ein Problem lösen musst",
                "tr": "geniş bir bilgi birikimi, gerçekten bir sorunu çözmen gerektiğinde beynine birbirine bağlayacağı daha çok fikir verir",
            }},
            {"id": "p4", "x": 65.4, "after": "p3", "gap": 95, "size": 42, "pitch": 48, "w": 900, "text": {
                "fr": f"et puis, [savoir plein de choses, c’est trop bien{NB}!!]",
                "de": "außerdem macht [Wissen einfach Spaß!!]",
                "tr": "üstelik [çok şey bilmek gerçekten keyifli!!]",
            }},
        ],
    },
    {  # 4 — s'ennuyer
        "effacer": [(26, 237, 605, 316), (484, 422, 975, 570), (484, 614, 975, 802), (25, 930, 850, 1030),
                    (24, 1074, 445, 1130)],
        "blocks": [
            {"id": "titre", "x": 31, "base": 290, "size": 63, "pitch": 73, "w": 1000, "text": {
                "fr": "autorise-toi à [t’ennuyer]",
                "de": "erlaub dir, dich zu [langweilen]",
                "tr": "kendine [sıkılma] izni ver",
            }},
            {"id": "p1", "x": 491.5, "base": 460, "size": 42, "pitch": 48, "w": 500, "text": {
                "fr": "aujourd’hui, [chaque] file d’attente, chaque trajet, chaque pause toilettes est remplie de contenu",
                "de": "[jede] Warteschlange, jeder Spaziergang und jede Klopause wird heute mit Input gefüllt",
                "tr": "artık [her] kuyruk, her yürüyüş, her tuvalet molası bir içerikle dolduruluyor",
            }},
            {"id": "p2", "x": 491.5, "after": "p1", "gap": 96, "size": 42, "pitch": 48, "w": 500, "text": {
                "fr": "ça a l’air inoffensif, mais tu enlèves à ton attention [toute occasion] de se poser",
                "de": "klingt harmlos, aber du raubst deiner Aufmerksamkeit [jede Chance] auf Ruhe",
                "tr": "zararsız gibi görünüyor ama dikkatinin bir an durulması için [her fırsatı] elinden alıyorsun",
            }},
            {"id": "p3", "x": 30.4, "base": 968, "size": 42, "pitch": 48, "w": 900, "text": {
                "fr": f"passe [20 à 30{NB}minutes] par jour sans podcast, sans musique, sans scroll ni deuxième écran",
                "de": f"verbring täglich [20 bis 30{NB}Minuten] ohne Podcast, Musik, Scrollen oder zweiten Bildschirm",
                "tr": f"günde [20-30{NB}dakikanı] podcast, müzik, kaydırma ya da ikinci ekran olmadan geçir",
            }},
            {"id": "p4", "x": 30.4, "after": "p3", "gap": 96, "size": 42, "pitch": 48, "w": 900, "text": {
                "fr": "[écoute tes pensées]",
                "de": "[hör deinen Gedanken zu]",
                "tr": "[düşüncelerini dinle]",
            }},
        ],
    },
    {  # 5 — la slide micabo (la capture remplace la photo au tableau)
        "effacer": [(26, 240, 885, 320), (24, 425, 545, 912), (24, 970, 930, 1072), (546, 370, 1010, 940)],
        "pub": {"box": (552, 376, 1001, 933)},
        "blocks": [
            {"id": "titre", "x": 31.75, "base": 293, "size": 63, "pitch": 73, "w": 1000, "text": {
                "fr": "explique tes cours [à voix haute]",
                "de": "erklär [laut], was du lernst",
                "tr": "öğrendiklerini [sesli] anlat",
            }},
            {"id": "p1", "x": 31, "base": 463, "size": 42, "pitch": 48, "w": 575, "text": {
                "fr": "si tu ne peux pas expliquer une idée simplement, c’est que tu [ne l’as pas encore comprise]",
                "de": "kannst du eine Idee nicht einfach erklären, [hast du sie noch nicht verstanden]",
                "tr": "bir fikri basitçe anlatamıyorsan muhtemelen onu [henüz tam anlamamışsındır]",
            }},
            {"id": "p2", "x": 31, "after": "p1", "gap": 96, "size": 42, "pitch": 48, "w": 575, "text": {
                "fr": f"après une lecture ou une révision, prends [5{NB}minutes] pour tout réexpliquer de mémoire",
                "de": f"nimm dir nach dem Lesen oder Lernen [5{NB}Minuten] und erklär es aus dem Kopf",
                "tr": f"okuduktan ya da ders çalıştıktan sonra [5{NB}dakika] ayır, konuyu kitaba bakmadan anlat",
            }},
            {"id": "p3", "x": 31, "after": "p2", "gap": 96, "size": 42, "pitch": 48, "w": 575, "text": {
                "fr": "les trous apparaissent très vite, et ça pique",
                "de": "deine Lücken werden ganz schnell schmerzhaft deutlich",
                "tr": "eksiklerin çok çabuk ve acı bir şekilde ortaya çıkar",
            }},
            {"id": "p4", "x": 31, "base": 1008, "size": 42, "pitch": 49, "w": 900, "text": {
                "fr": f"moi je laisse aussi l’appli micabo m’interroger sur mes cours{NB}: ce que je ne sais pas saute aux yeux. c’est l’une des meilleures façons d’apprendre{NB}!",
                "de": "ich lass mich außerdem von der micabo-App zu meinem Stoff abfragen: was ich nicht weiß, springt mir sofort ins Auge. eine der besten Lernmethoden überhaupt!",
                "tr": "ben ayrıca micabo uygulamasında derslerimden soru çözüyorum: bilmediğim yerler hemen göze batıyor. bu da öğrenmenin en iyi yollarından biri!",
            }},
        ],
    },
    {  # 6 — écrire à la main
        "effacer": [(26, 225, 765, 302), (30, 386, 826, 442), (30, 523, 540, 712), (30, 763, 540, 905)],
        "blocks": [
            {"id": "titre", "x": 33.4, "base": 278, "size": 63, "pitch": 73, "w": 1000, "text": {
                "fr": "prends tes notes [à la main]",
                "de": "schreib Notizen [von Hand]",
                "tr": "notlarını [elle] yaz",
            }},
            {"id": "p1", "x": 37.75, "base": 424, "size": 42, "pitch": 48, "w": 900, "text": {
                "fr": "taper, c’est plus rapide, mais pas toujours [mieux]",
                "de": "Tippen ist schneller, aber nicht immer [besser]",
                "tr": "klavye daha hızlı ama her zaman [daha iyi] değil",
            }},
            {"id": "p2", "x": 37.5, "base": 561, "size": 42, "pitch": 48.3, "w": 500, "text": {
                "fr": "écrire à la main t’oblige à [ralentir], à condenser les idées et à vraiment assimiler ce qui compte",
                "de": "mit der Hand zu schreiben zwingt dich, [langsamer zu werden], Ideen zu verdichten und wirklich zu verarbeiten, was zählt",
                "tr": "elle yazmak [yavaşlamanı], fikirleri özetlemeni ve önemli olanı gerçekten sindirmeni sağlar",
            }},
            {"id": "p3", "x": 37.5, "after": "p2", "gap": 95.5, "size": 42, "pitch": 48.5, "w": 500, "text": {
                "fr": "tout ce que tu veux vraiment retenir, écris-le dans un [carnet]",
                "de": "nimm ein [Notizbuch] für alles, was du dir wirklich merken willst",
                "tr": "gerçekten aklında tutmak istediğin her şey için bir [defter] kullan",
            }},
        ],
    },
]

HASHTAGS = {
    "fr": "#revisions #methodedetude #etudiant #apprendre #memoire",
    "de": "#lernen #lerntipps #studium #lernmethoden #gedächtnis",
    "tr": "#dersçalışma #öğrenci #öğrenme #yks #hafıza",
}

if __name__ == "__main__":
    origine, cap_fr, cap_de, cap_tr, sortie = (Path(a) for a in sys.argv[1:6])
    langues = sys.argv[6].split(",") if len(sys.argv) > 6 else ["fr", "de", "tr"]
    sortie.mkdir(parents=True, exist_ok=True)
    rendre_post(SLIDES, origine, ID, {"fr": str(cap_fr), "de": str(cap_de), "tr": str(cap_tr)},
                None, sortie, langues)
