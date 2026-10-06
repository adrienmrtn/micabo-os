"""White post @amayareading 7685071416466607382 — « 10/10 things that are
rapidly destroying your ability to focus » (496 000 vues), en FR, DE et TR.

La slide 5 d'origine (« doomscrolling everyday ») vend ReadUp, qui bloque
TikTok tant qu'on n'a pas lu 20 minutes. Le remède devient micabo : quand
l'envie de scroller arrive, dix minutes de flashcards sur ses propres cours.

    python3 -I post_7685071416466607382.py <slides_origine/> <cap_fr> <cap_de> <cap_tr> <fiche_app_store> <sortie/> [fr,de,tr]
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from post_lib import banniere_app_store, rendre_post  # noqa: E402

ID = "7685071416466607382"
NB = " "  # espace insécable avant « : ! ? » en français

SLIDES = [
    {  # 1 — titre
        "effacer": [(90, 240, 935, 390), (495, 893, 918, 946)],
        "blocks": [
            {"id": "titre", "x": 95, "base": 294, "size": 63, "pitch": 73, "w": 860, "text": {
                "fr": "10/10 habitudes qui détruisent ta capacité à te concentrer",
                "de": "10/10 Gewohnheiten, die deine Konzentration zerstören",
                "tr": "odaklanma becerini hızla yok eden 10/10 alışkanlık",
            }},
            {"id": "sous", "x": 913, "align": "right", "base": 932, "size": 42, "pitch": 48, "w": 990, "text": {
                "fr": "(validé par les neurosciences)",
                "de": "(neurowissenschaftlich belegt)",
                "tr": "(nörobilim destekli)",
            }},
        ],
    },
    {  # 2 — écouter quelque chose en permanence
        "effacer": [(42, 232, 648, 384), (40, 417, 871, 571), (639, 607, 980, 856), (39, 957, 980, 1063)],
        "blocks": [
            {"id": "titre", "x": 49, "base": 286, "size": 63, "pitch": 75, "w": 1000, "text": {
                "fr": "écouter quelque chose\n[en permanence]",
                "de": "[ständig] etwas im Ohr haben",
                "tr": "[sürekli] bir şey dinlemek",
            }},
            {"id": "p1", "x": 47, "base": 456, "size": 42, "pitch": 48, "w": 900, "text": {
                "fr": f"musique, podcasts, YouTube en fond{NB}: ton cerveau ne fait [presque jamais une seule chose à la fois]",
                "de": "Musik, Podcasts, YouTube im Hintergrund: dein Gehirn macht [fast nie nur eine Sache]",
                "tr": "arka planda müzik, podcast, YouTube… beynin [neredeyse hiç tek bir işe odaklanmıyor]",
            }},
            {"id": "p2", "x": 646, "base": 646, "size": 42, "pitch": 48.2, "w": 330, "text": {
                "fr": f"[surtout avec des paroles]{NB}: une partie de ton attention traite encore les mots",
                "de": "[vor allem mit Gesang]: ein Teil deiner Aufmerksamkeit verarbeitet noch die Wörter",
                "tr": "[özellikle sözlü şarkılarda] dikkatinin bir kısmı hâlâ kelimeleri işliyor",
            }},
            {"id": "p3", "x": 46, "base": 996, "size": 42, "pitch": 48, "w": 930, "text": {
                "fr": "le silence paraît ennuyeux parce que [tu as arrêté de t’y entraîner]",
                "de": "Stille wirkt langweilig, weil du [verlernt hast, sie auszuhalten]",
                "tr": "sessizlik sıkıcı geliyor çünkü [ona alışmayı bıraktın]",
            }},
        ],
    },
    {  # 3 — tout consommer en accéléré
        "effacer": [(27, 239, 978, 318), (34, 433, 538, 636), (34, 673, 502, 780), (34, 817, 533, 962)],
        "blocks": [
            {"id": "titre", "x": 34, "base": 293, "size": 63, "pitch": 75, "w": 1010, "text": {
                "fr": "tout consommer en [vitesse x2]",
                "de": "alles in [2x-Speed] konsumieren",
                "tr": "her şeyi [2x hızda] izlemek",
            }},
            {"id": "p1", "x": 41, "base": 472, "size": 42, "pitch": 48, "w": 525, "text": {
                "fr": "quand chaque podcast, vidéo et vocal passe en accéléré, le rythme normal finit par paraître [atrocement lent]",
                "de": "wenn jeder Podcast, jedes Video und jede Sprachnachricht schneller läuft, wirkt normales Tempo [quälend langsam]",
                "tr": "her podcast’i, videoyu ve sesli mesajı hızlandırınca normal hız [dayanılmaz derecede yavaş] gelmeye başlıyor",
            }},
            {"id": "p2", "x": 41, "after": "p1", "gap": 96, "size": 42, "pitch": 48, "w": 525, "text": {
                "fr": "tu t’habitues à [avoir besoin de densité en permanence]",
                "de": "du gewöhnst dich daran, [ständig Dichte zu brauchen]",
                "tr": "kendini [sürekli yoğun içeriğe muhtaç olmaya] alıştırıyorsun",
            }},
            {"id": "p3", "x": 41, "after": "p2", "gap": 96, "size": 42, "pitch": 48, "w": 525, "text": {
                "fr": "à la place, reste vraiment plus de 10 secondes avec une idée",
                "de": "bleib stattdessen mal länger als 10 Sekunden bei einem Gedanken",
                "tr": "bunun yerine bir fikrin üzerinde 10 saniyeden uzun durmayı dene",
            }},
        ],
    },
    {  # 4 — tout googler
        "effacer": [(28, 224, 898, 372), (27, 407, 983, 511), (31, 563, 497, 766), (31, 803, 495, 958)],
        "blocks": [
            {"id": "titre", "x": 35, "base": 278, "size": 63, "pitch": 75, "w": 1000, "text": {
                "fr": "googler [la moindre pensée]\nqui te passe par la tête",
                "de": "jeden [zufälligen Gedanken]\nsofort googeln",
                "tr": "[aklına gelen her şeyi]\nanında Google’lamak",
            }},
            {"id": "p1", "x": 34, "base": 446, "size": 42, "pitch": 48, "w": 980, "text": {
                "fr": "pas besoin de satisfaire chaque curiosité à la seconde où elle apparaît",
                "de": "du musst nicht jede Neugier in der Sekunde stillen, in der sie auftaucht",
                "tr": "her merakını ortaya çıktığı saniye gidermek zorunda değilsin",
            }},
            {"id": "p2", "x": 38, "base": 602, "size": 42, "pitch": 48, "w": 480, "text": {
                "fr": "une recherche devient cinq onglets, puis Reddit, et d’un coup [20 minutes ont disparu]",
                "de": "aus einer Suche werden fünf Tabs, dann Reddit, und plötzlich [sind 20 Minuten weg]",
                "tr": "bir arama beş sekmeye, sonra Reddit’e dönüşüyor ve bir bakmışsın [20 dakika uçup gitmiş]",
            }},
            {"id": "p3", "x": 38, "after": "p2", "gap": 96, "size": 42, "pitch": 48, "w": 480, "text": {
                "fr": "note l’idée et [finis d’abord ce que tu faisais]",
                "de": "schreib den Gedanken auf und [mach zuerst fertig, woran du gerade sitzt]",
                "tr": "aklındakini bir kenara yaz ve [önce yaptığın işi bitir]",
            }},
        ],
    },
    {  # 5 — doomscrolling : la slide micabo
        "effacer": [(26, 239, 686, 317), (25, 392, 576, 593), (25, 632, 576, 825), (25, 872, 576, 921),
                    (588, 352, 1000, 1052), (586, 1048, 870, 1186)],
        "pub": {"box": (595, 359, 994, 1046), "banniere": (612, 1066, 250)},
        "blocks": [
            {"id": "titre", "x": 33, "base": 293, "size": 63, "pitch": 75, "w": 1000, "text": {
                "fr": "scroller [tous les jours]",
                "de": "[jeden Tag] doomscrollen",
                "tr": "[her gün] boş boş kaydırmak",
            }},
            {"id": "p1", "x": 32, "base": 431, "size": 42, "pitch": 48, "w": 548, "text": {
                "fr": "tu ouvres tiktok [sans même t’en rendre compte] et tu y perds des heures. c’est ça qui grille ta concentration",
                "de": "du öffnest TikTok, [ohne es überhaupt zu merken], und verlierst Stunden. genau das ruiniert deine Konzentration",
                "tr": "tiktok’u [farkında bile olmadan] açıyorsun ve saatlerin gidiyor. odağını bitiren tam olarak bu",
            }},
            {"id": "p2", "x": 32, "after": "p1", "gap": 96, "size": 42, "pitch": 48, "w": 548, "text": {
                "fr": "la volonté seule ne suffit pas. moi, quand j’ai envie de scroller, j’ouvre l’appli micabo et je fais [10 min de flashcards sur mes cours] à la place",
                "de": "nur mit Willenskraft klappt das selten. wenn ich scrollen will, öffne ich stattdessen die micabo-App und mache [10 Minuten Karteikarten zu meinem Stoff]",
                "tr": "sadece irade yetmiyor. ben kaydırmak istediğimde micabo uygulamasını açıp [ders notlarımdan 10 dakika bilgi kartı] çalışıyorum",
            }},
            {"id": "p3", "x": 32, "after": "p2", "gap": 96, "size": 42, "pitch": 48, "w": 548, "text": {
                "fr": f"protège ta concentration{NB}!!",
                "de": "rette deine Konzentration!!",
                "tr": "odağını koru!!",
            }},
        ],
    },
    {  # 6 — procrastiner
        "effacer": [(60, 226, 669, 305), (57, 407, 463, 610), (57, 647, 474, 802)],
        "blocks": [
            {"id": "titre", "x": 67, "base": 280, "size": 63, "pitch": 75, "w": 990, "text": {
                "fr": "procrastiner [toute la journée]",
                "de": "[den ganzen Tag] prokrastinieren",
                "tr": "[bütün gün] işleri ertelemek",
            }},
            {"id": "p1", "x": 64, "base": 446, "size": 42, "pitch": 48, "w": 420, "text": {
                "fr": "chaque fois que tu te dis que tu vas le faire et que tu ne le fais pas, [tu perds confiance en toi]",
                "de": "jedes Mal, wenn du dir etwas vornimmst und es dann nicht machst, [verlierst du Vertrauen in dich]",
                "tr": "kendine yapacağını söyleyip her yapmadığında [kendine olan güvenini kaybediyorsun]",
            }},
            {"id": "p2", "x": 64, "after": "p1", "gap": 96, "size": 42, "pitch": 48, "w": 420, "text": {
                "fr": "quand tu penses à faire quelque chose, [fais-le tout de suite]",
                "de": "wenn du daran denkst, etwas zu tun, [mach es sofort]",
                "tr": "bir şey yapmayı düşündüğünde [hemen yap]",
            }},
        ],
    },
]

HASHTAGS = {
    "fr": "#concentration #revisions #productivite #etudiant #methodedetude",
    "de": "#konzentration #lernen #produktivität #studium #lerntipps",
    "tr": "#odaklanma #dersçalışma #verimlilik #öğrenci #yks",
}

if __name__ == "__main__":
    origine, cap_fr, cap_de, cap_tr, fiche, sortie = (Path(a) for a in sys.argv[1:7])
    langues = sys.argv[7].split(",") if len(sys.argv) > 7 else ["fr", "de", "tr"]
    sortie.mkdir(parents=True, exist_ok=True)
    banniere = banniere_app_store(str(fiche), str(sortie / "banniere.jpg"))
    rendre_post(SLIDES, origine, ID, {"fr": str(cap_fr), "de": str(cap_de), "tr": str(cap_tr)},
                banniere, sortie, langues)
