"""White post @amayareading 7683630825610513686 — « The anti-rot routine that
brought my life back >>> (as someone who had a 12 hour screen time) »
(7 442 vues, 6 slides), en FR, DE et TR.

La slide 5 d'origine (« dont scroll 1 hour before sleep ») vend ReadUp, avec sa
capture et sa carte App Store. Elle garde son conseil, la dernière heure sans
scroll, et devient le moment micabo du soir : quelques minutes de flashcards de
ses cours au lit avec l’appli micabo, puis le téléphone posé ; ce qu’on revoit
juste avant de dormir a tendance à mieux rester (formulé prudemment, sans
chiffre). La capture micabo de la langue remplace celle de ReadUp, la carte
micabo remplace la sienne. Rien sur un blocage d’applis : micabo ne bloque rien.

    python3 -I post_7683630825610513686.py <slides_origine/> <cap_fr> <cap_de> <cap_tr> <fiche_app_store> <sortie/> [fr,de,tr]
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from post_lib import banniere_app_store, rendre_post  # noqa: E402

ID = "7683630825610513686"
NB = " "

SLIDES = [
    {  # 1 — titre
        "effacer": [(104, 278, 802, 424), (626, 570, 882, 754)],
        "blocks": [
            {"id": "titre", "x": 111, "base": 331.5, "size": 63, "pitch": 73, "w": 930, "text": {
                "fr": "La routine anti-brainrot qui\nm’a rendu ma vie >>>",
                "de": "Die Anti-Brainrot-Routine, die\nmir mein Leben zurückgab >>>",
                "tr": "Beynimi çürümekten kurtarıp\nhayatımı geri veren rutin >>>",
            }},
            {"id": "p1", "x": 633.5, "base": 600.5, "size": 42, "pitch": 48, "w": 290, "text": {
                "fr": f"moi qui avais 12{NB}heures de temps d’écran",
                "de": f"als jemand mit 12{NB}Stunden Bildschirmzeit",
                "tr": f"günde 12{NB}saat ekran süresi olan biri olarak",
            }},
        ],
    },
    {  # 2 — pas de réseaux la première heure
        "effacer": [(38, 264, 806, 400), (34, 464, 512, 1050)],
        "blocks": [
            {"id": "titre", "x": 43, "base": 318.5, "size": 63, "pitch": 73, "w": 1000, "text": {
                "fr": "PAS de réseaux sociaux\nla première heure",
                "de": "KEIN Social Media in der\nersten Stunde",
                "tr": "ilk bir saat\nsosyal medya YOK",
            }},
            {"id": "p1", "x": 41.5, "base": 503.5, "size": 42, "pitch": 48, "w": 458, "text": {
                "fr": "pas de scroll, pas de youtube, pas de tiktok la première heure",
                "de": "kein Scrollen, kein YouTube, kein TikTok in der ersten Stunde",
                "tr": "ilk saat kaydırmak yok, youtube yok, tiktok yok",
            }},
            {"id": "p2", "x": 41.5, "after": "p1", "gap": 96, "size": 42, "pitch": 48, "w": 458, "text": {
                "fr": "les vidéos courtes inondent ton cerveau de récompenses, [grillent tes récepteurs à dopamine] et rendent tout ce qui est lent d’un ennui mortel",
                "de": "Kurzvideos belohnen dein Gehirn ohne Pause, [grillen deine Dopaminrezeptoren] und lassen alles Langsamere quälend öde wirken",
                "tr": "kısa videolar beynine art arda ödül veriyor, [dopamin reseptörlerini yakıyor] ve yavaş işleri çekilmez hale getiriyor",
            }},
            {"id": "p3", "x": 41.5, "after": "p2", "gap": 96, "size": 42, "pitch": 48, "w": 458, "text": {
                "fr": "[pour gagner ta journée, gagne ta matinée]",
                "de": "[wer morgens gewinnt, gewinnt den Tag]",
                "tr": "[gününü kazanmak için sabahını kazan]",
            }},
        ],
    },
    {  # 3 — ne pas attendre la motivation
        "effacer": [(44, 272, 864, 352), (590, 476, 926, 620), (36, 808, 980, 1000)],
        "blocks": [
            {"id": "titre", "x": 49.5, "base": 326.5, "size": 63, "pitch": 73, "w": 1000, "text": {
                "fr": "arrête [d’attendre la motivation]",
                "de": "hör auf, [auf Motivation zu warten]",
                "tr": "[motive olmayı beklemeyi] bırak",
            }},
            {"id": "p1", "x": 596.5, "base": 514.5, "size": 42, "pitch": 48, "w": 380, "text": {
                "fr": "la motivation vient en faisant, pas avant",
                "de": "Motivation kommt nach dem Anfangen, nicht davor",
                "tr": "motivasyon başladıktan sonra gelir, önce değil",
            }},
            {"id": "p2", "x": 40.5, "base": 847.5, "size": 42, "pitch": 48, "w": 940, "text": {
                "fr": f"force-toi à faire [juste 10{NB}minutes] de ce que tu repousses. une fois la résistance du début passée, continuer est bien plus facile que de partir de zéro.",
                "de": f"zwing dich zu [nur 10{NB}Minuten] von dem, was du aufschiebst. sobald der erste Widerstand überwunden ist, ist Weitermachen viel leichter, als bei null anzufangen.",
                "tr": f"ertelediğin işi [sadece 10{NB}dakika] yapmaya zorla kendini. ilk direnci aşınca devam etmek, sıfırdan başlamaktan çok daha kolay.",
            }},
        ],
    },
    {  # 4 — sortir tous les jours
        "effacer": [(42, 266, 940, 346), (36, 392, 462, 1072), (480, 806, 882, 908)],
        "blocks": [
            {"id": "titre", "x": 44.5, "base": 319.5, "size": 63, "pitch": 73, "w": 1000, "text": {
                "fr": "sors [tous les jours, sans exception]",
                "de": "geh [jeden einzelnen Tag] raus",
                "tr": "[her gün istisnasız] dışarı çık",
            }},
            {"id": "p1", "x": 44.5, "base": 430.5, "size": 42, "pitch": 48, "w": 410, "text": {
                "fr": f"passer 24{NB}h sans sortir, c’est le meilleur moyen de végéter",
                "de": f"wer 24{NB}Stunden drinnen bleibt, vergammelt leicht",
                "tr": f"24{NB}saat evden çıkmamak, evde çürümeyi kolaylaştırır",
            }},
            {"id": "p2", "x": 44.5, "after": "p1", "gap": 96, "size": 42, "pitch": 48, "w": 410, "text": {
                "fr": f"sors [au moins 20{NB}à{NB}30{NB}minutes], si possible en plein jour",
                "de": f"[mindestens 20 bis 30{NB}Minuten] raus, am besten bei Tageslicht",
                "tr": f"[en az 20-30{NB}dakika] dışarı çık, mümkünse gün ışığında",
            }},
            {"id": "p3", "x": 44.5, "after": "p2", "gap": 96, "size": 42, "pitch": 48, "w": 410, "text": {
                "fr": f"marcher, prendre le soleil et simplement changer de décor peut faire plus pour ton énergie qu’une heure de plus à «{NB}te{NB}reposer{NB}» au lit",
                "de": "Spazierengehen, Sonnenlicht und ein Tapetenwechsel bringen deiner Energie mehr als noch eine Stunde „Ausruhen“ im Bett",
                "tr": "yürümek, güneş ışığı ve ortam değiştirmek, yatakta bir saat daha “dinlenmekten” çok daha fazla enerji verir",
            }},
            {"id": "p4", "x": 487, "base": 842, "size": 42, "pitch": 48, "w": 430, "text": {
                "fr": f"[scroller, ce n’est PAS se reposer{NB}!!]",
                "de": "[Doomscrolling ist KEINE Erholung!!]",
                "tr": "[telefonda kaydırmak dinlenmek DEĞİL!!]",
            }},
        ],
    },
    {  # 5 — la slide micabo (à la place de « dont scroll 1 hour before sleep »)
        "effacer": [(58, 270, 894, 352), (386, 440, 964, 878), (20, 442, 377, 1048), (423, 940, 701, 1070)],
        "pub": {"box": (26, 448, 371, 1042), "banniere": (429, 946, 266)},
        "blocks": [
            {"id": "titre", "x": 62.5, "base": 325, "size": 63, "pitch": 73, "w": 990, "text": {
                "fr": f"zéro scroll [1{NB}h avant de dormir]",
                "de": f"kein Scrollen [1{NB}h vorm Schlafen]",
                "tr": f"yatmadan [1{NB}saat önce] kaydırma yok",
            }},
            {"id": "p1", "x": 392, "base": 478.5, "size": 42, "pitch": 48, "w": 570, "text": {
                "fr": f"pas de scroll pendant les 60{NB}minutes avant de dormir",
                "de": f"kein Scrollen in den letzten 60{NB}Minuten vor dem Schlafen",
                "tr": f"uyumadan önceki son 60{NB}dakika kaydırmak yok",
            }},
            {"id": "p2", "x": 392, "after": "p1", "gap": 96, "size": 42, "pitch": 48, "w": 570, "text": {
                "fr": "moi, au lit, je fais quelques minutes de flashcards de mes cours avec l’appli micabo, [puis je pose le téléphone]. ce qu’on revoit juste avant de dormir a tendance à mieux rester",
                "de": "ich geh im Bett ein paar Minuten Karteikarten zu meinem Stoff in der micabo-App durch [und leg dann das Handy weg]. was man kurz vorm Schlafen wiederholt, bleibt oft besser hängen",
                "tr": "ben yatakta micabo uygulamasında birkaç dakika derslerimin bilgi kartlarını çalışıyorum, [sonra telefonu bırakıyorum]. uyumadan hemen önce tekrar ettiklerin genelde daha iyi akılda kalıyor",
            }},
        ],
    },
    {  # 6 — se coucher tôt
        "effacer": [(40, 264, 896, 344), (532, 420, 976, 1002)],
        "blocks": [
            {"id": "titre", "x": 46, "base": 317.5, "size": 63, "pitch": 73, "w": 1000, "text": {
                "fr": "couche-toi [ridiculement tôt]",
                "de": "geh [peinlich früh] ins Bett",
                "tr": "[utanılacak kadar erken] yat",
            }},
            {"id": "p1", "x": 540, "base": 457, "size": 42, "pitch": 48, "w": 450, "text": {
                "fr": "[tu as besoin de sommeil]",
                "de": "[du brauchst Schlaf]",
                "tr": "[uykuya ihtiyacın var]",
            }},
            {"id": "p2", "x": 540, "after": "p1", "gap": 96, "size": 42, "pitch": 47.8, "w": 450, "text": {
                "fr": f"un adulte a en général besoin de 7{NB}à{NB}9{NB}heures, et rogner dessus sans arrêt [abîme l’attention], l’humeur et le self-control",
                "de": f"Erwachsene brauchen meist 7 bis 9{NB}Stunden, und das ständig zu verkürzen, [ruiniert Aufmerksamkeit], Laune und Selbstkontrolle",
                "tr": f"yetişkinlerin genelde 7-9{NB}saat uykuya ihtiyacı var ve bunu sürekli kısaltmak ruh halini, öz denetimi ve en çok da [dikkati mahveder]",
            }},
            {"id": "p3", "x": 540, "after": "p2", "gap": 96, "size": 42, "pitch": 48, "w": 450, "text": {
                "fr": f"se coucher à 23{NB}h fait moins rêver que réparer sa vie à bout de forces",
                "de": f"um 23{NB}Uhr ins Bett zu gehen ist weniger aufregend, als todmüde sein Leben in Ordnung zu bringen",
                "tr": f"saat 23’te yatmak, yorgun yorgun hayatını düzeltmeye çalışmaktan daha az heyecan verici",
            }},
        ],
    },
]

HASHTAGS = {
    "fr": "#routine #revisions #etudiant #sommeil #productivite",
    "de": "#routine #lernen #lerntipps #schlaf #studium",
    "tr": "#rutin #dersçalışma #öğrenci #uyku #verimlilik",
}

if __name__ == "__main__":
    origine, cap_fr, cap_de, cap_tr, fiche, sortie = (Path(a) for a in sys.argv[1:7])
    langues = sys.argv[7].split(",") if len(sys.argv) > 7 else ["fr", "de", "tr"]
    sortie.mkdir(parents=True, exist_ok=True)
    banniere = banniere_app_store(str(fiche), str(sortie / "banniere.jpg"))
    rendre_post(SLIDES, origine, ID, {"fr": str(cap_fr), "de": str(cap_de), "tr": str(cap_tr)},
                banniere, sortie, langues)
