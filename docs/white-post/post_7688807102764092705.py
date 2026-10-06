"""White post @amayareading 7688807102764092705 — « top 5 ways to ruin your
20s (harsh truth) » (471 400 vues, 6 slides), en FR, DE et TR.

Tout le post est ironique : chaque slide donne le conseil à l'envers (ne pense
jamais par toi-même, ne voyage jamais…). La slide 5 d'origine (« never stop
scrolling ») vend ReadUp. Elle devient la slide micabo, ironique comme le reste
et tournée vers les études : ne révise jamais, ne te teste surtout pas, laisse
le prochain TikTok t'expliquer ton cours, et surtout n'ouvre pas l'appli
micabo, qui ferait des flashcards de tes cours. La leçon se lit au premier
degré. La capture d'appli remplace celle de ReadUp, sans carte App Store
(l'original n'en avait pas).

    python3 -I post_7688807102764092705.py <slides_origine/> <cap_fr> <cap_de> <cap_tr> <sortie/> [fr,de,tr]
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from post_lib import rendre_post  # noqa: E402

ID = "7688807102764092705"
NB = " "

SLIDES = [
    {  # 1 — titre
        "effacer": [(88, 240, 842, 318), (600, 1024, 842, 1078)],
        "blocks": [
            {"id": "titre", "x": 95, "base": 294, "size": 63, "pitch": 73, "w": 1000, "text": {
                "fr": "top 5 pour rater tes 20 ans",
                "de": "so ruinierst du deine 20er",
                "tr": "20’lerini harcamanın 5 yolu",
            }},
            {"id": "sous", "x": 834, "align": "right", "base": 1062, "size": 42, "pitch": 48, "w": 990, "text": {
                "fr": "(dure vérité)",
                "de": "(harte Wahrheit)",
                "tr": "(acı gerçek)",
            }},
        ],
    },
    {  # 2 — ne jamais penser par soi-même
        "effacer": [(50, 228, 700, 302), (48, 344, 610, 932), (48, 988, 900, 1092)],
        "blocks": [
            {"id": "titre", "x": 53, "base": 282, "size": 63, "pitch": 73, "w": 1000, "text": {
                "fr": "ne pense jamais par toi-même",
                "de": "denk nie selbst nach",
                "tr": "asla kendi başına düşünme",
            }},
            {"id": "p1", "x": 54, "base": 383, "size": 42, "pitch": 48, "w": 580, "text": {
                "fr": f"pourquoi galérer sur une idée quand l’IA peut te donner une réponse [en 3{NB}secondes]{NB}?",
                "de": f"warum dich mit einer Idee abmühen, wenn dir die KI [in{NB}3{NB}Sekunden] antwortet?",
                "tr": f"yapay zekâ sana [3{NB}saniyede] cevap verebilecekken neden bir fikirle boğuşasın?",
            }},
            {"id": "p2", "x": 54, "after": "p1", "gap": 96, "size": 42, "pitch": 48, "w": 580, "text": {
                "fr": "demande-lui quoi [penser], quoi\nécrire, quoi [croire], puis\nquoi faire ensuite",
                "de": "lass dir von ihr sagen, was du [denken], schreiben, [glauben] und als Nächstes tun sollst",
                "tr": "ona ne [düşüneceğini], ne yazacağını, neye [inanacağını], sonra ne yapacağını sor",
            }},
            {"id": "p3", "x": 54, "after": "p2", "gap": 96, "size": 42, "pitch": 48, "w": 580, "text": {
                "fr": f"à force, tu sous-traiteras\ntellement ta réflexion que ton\n[propre jugement] [ne servira]\n[presque plus]{NB}!",
                "de": "irgendwann lagerst du so viel Denken aus, dass dein [eigenes Urteil] [kaum noch gefragt ist]!",
                "tr": "zamanla düşünmeyi o kadar çok dışarıya devredersin ki [kendi muhakemen] [neredeyse hiç kullanılmaz]!",
            }},
            {"id": "p4", "x": 55, "base": 1026, "size": 42, "pitch": 48, "w": 900, "text": {
                "fr": f"et tu n’auras plus jamais à te soucier de [réfléchir]{NB}!",
                "de": "dann musst du dir nie wieder Gedanken übers [Denken] machen!",
                "tr": "böylece bir daha asla [düşünmeyi] dert etmezsin!",
            }},
        ],
    },
    {  # 3 — ne jamais rester en silence
        "effacer": [(40, 212, 560, 278), (34, 334, 760, 438), (628, 556, 860, 760), (36, 948, 850, 1104)],
        "blocks": [
            {"id": "titre", "x": 45, "base": 266, "size": 63, "pitch": 73, "w": 1000, "text": {
                "fr": "ne reste jamais en silence",
                "de": "halt nie Stille aus",
                "tr": "asla sessizlikte kalma",
            }},
            {"id": "p1", "x": 41, "base": 372, "size": 42, "pitch": 48, "w": 900, "text": {
                "fr": "mets [toujours] de la musique, des podcasts, youtube, n’importe quoi en fond",
                "de": "lass [immer] Musik, Podcasts, YouTube, irgendwas im Hintergrund laufen",
                "tr": "arka planda [her zaman] müzik, podcast, youtube, ne olursa olsun bir şey açık olsun",
            }},
            {"id": "p2", "x": 636, "base": 597, "size": 42, "pitch": 48, "w": 400, "text": {
                "fr": "ne laisse jamais\nton cerveau\ns’entendre penser\ntrop longtemps",
                "de": "lass dein\nGehirn nie\nzu lange mit\nsich allein",
                "tr": "beynini asla\nuzun süre\nkendi sesiyle\nbaş başa bırakma",
            }},
            {"id": "p3", "x": 44, "base": 988, "size": 42, "pitch": 48.5, "w": 900, "text": {
                "fr": "sinon tu pourrais commencer à penser à ce que tu [veux vraiment], à ce que [tu évites], ou à ce qui [doit changer]. ce serait flippant",
                "de": "sonst denkst du am Ende noch darüber nach, was du [wirklich willst], [wovor du dich drückst] oder was [sich ändern muss]. das wäre ja gruselig",
                "tr": f"yoksa gerçekten [ne istediğini], [neden kaçtığını] ya{NB}da neyin [değişmesi gerektiğini] düşünmeye başlayabilirsin. bu korkutucu olurdu",
            }},
        ],
    },
    {  # 4 — ne jamais voyager
        "effacer": [(30, 218, 362, 280), (26, 352, 920, 456), (26, 508, 522, 1048)],
        "blocks": [
            {"id": "titre", "x": 33, "base": 270, "size": 63, "pitch": 73, "w": 1000, "text": {
                "fr": "ne voyage jamais",
                "de": "verreise nie",
                "tr": "asla seyahat etme",
            }},
            {"id": "p1", "x": 33, "base": 392, "size": 42, "pitch": 48, "w": 960, "text": {
                "fr": "il n’y a [rien là-dehors] que tu aies besoin\nde vivre toi-même",
                "de": "es gibt [nichts da draußen], das du\nselbst erleben musst",
                "tr": "[dışarıda] kendin yaşaman gereken [hiçbir şey yok]",
            }},
            {"id": "p2", "x": 32, "base": 548, "size": 42, "pitch": 48, "w": 490, "text": {
                "fr": f"montagnes, villes, cultures, gens{NB}: tu peux [de toute façon] tout voir sur un [écran de 6{NB}pouces]",
                "de": "Berge, Städte, Kulturen und Menschen siehst du [sowieso] auf einem [6-Zoll-Bildschirm]",
                "tr": f"dağları, şehirleri, kültürleri ve insanları [zaten] [6{NB}inçlik bir ekrandan] görebilirsin",
            }},
            {"id": "p3", "x": 32, "after": "p2", "gap": 96, "size": 42, "pitch": 48, "w": 490, "text": {
                "fr": "reste là où c’est [confortable]",
                "de": "bleib, wo es [bequem] ist",
                "tr": "[rahat] olduğun yerde kal",
            }},
            {"id": "p4", "x": 32, "after": "p3", "gap": 96, "size": 42, "pitch": 48, "w": 490, "text": {
                "fr": f"pourquoi risquer de découvrir que le monde est [bien plus grand] que la vie que tu t’es construite{NB}?",
                "de": "warum riskieren, zu merken, dass die Welt [viel größer] ist als das Leben, das du dir gebaut hast?",
                "tr": "dünyanın kurduğun hayattan [çok daha büyük] olduğunu keşfetme riskine neden giresin?",
            }},
        ],
    },
    {  # 5 — la slide micabo (à la place de « never stop scrolling »)
        "effacer": [(26, 218, 580, 296), (22, 366, 630, 1052), (624, 398, 1036, 1100)],
        "pub": {"box": (660, 406, 1030, 1136)},
        "blocks": [
            {"id": "titre", "x": 31, "base": 274, "size": 63, "pitch": 73, "w": 1000, "text": {
                "fr": "ne lâche jamais ton téléphone",
                "de": "hör nie auf zu scrollen",
                "tr": "telefonu asla elinden bırakma",
            }},
            {"id": "p1", "x": 31, "base": 407, "size": 42, "pitch": 48, "w": 605, "text": {
                "fr": "peut-être que le [prochain tiktok] va [enfin] t’expliquer ton cours",
                "de": "vielleicht erklärt dir das [nächste TikTok] [endlich] den ganzen Stoff",
                "tr": "belki [sıradaki tiktok] sana dersi [sonunda] anlatır",
            }},
            {"id": "p2", "x": 31, "after": "p1", "gap": 96, "size": 42, "pitch": 48.3, "w": 605, "text": {
                "fr": "ne révise jamais, ne te [teste] surtout pas, ne laisse pas ton cerveau [chercher la réponse]",
                "de": "lern bloß nicht, frag dich [nie selbst ab], lass dein Gehirn [nie selbst nach der Antwort suchen]",
                "tr": "asla ders çalışma, kendini sakın [test etme], beynine [cevabı kendi bulma] fırsatı verme",
            }},
            {"id": "p3", "x": 31, "after": "p2", "gap": 96, "size": 42, "pitch": 48.5, "w": 605, "text": {
                "fr": "[nourris l’algorithme] jusqu’à ce qu’il te connaisse [mieux que tu ne connais tes cours]",
                "de": "füttere weiter [den Algorithmus], bis er dich [besser kennt als du deinen Stoff]",
                "tr": "algoritmayı [beslemeye devam et], o seni [sen derslerini bildiğinden] daha iyi tanısın",
            }},
            {"id": "p4", "x": 31, "after": "p3", "gap": 96, "size": 42, "pitch": 48, "w": 605, "text": {
                "fr": f"et surtout, n’ouvre jamais\nl’appli micabo{NB}: elle ferait des\n[flashcards de tes cours], et tu\nrisquerais de [t’en souvenir]{NB}!",
                "de": "und bloß nicht die micabo-App\nöffnen: die macht aus deinem\nStoff [Karteikarten], und am Ende\n[merkst du dir noch was]!",
                "tr": "ve sakın micabo uygulamasını\naçma: ders notlarından [bilgi]\n[kartları] çıkarır, maazallah\n[aklında kalır]!",
            }},
        ],
    },
    {  # 6 — ne jamais prendre de risques
        "effacer": [(28, 226, 470, 290), (20, 392, 546, 780), (22, 840, 780, 948)],
        "blocks": [
            {"id": "titre", "x": 32, "base": 279, "size": 63, "pitch": 73, "w": 1000, "text": {
                "fr": "ne prends jamais de risques",
                "de": "geh nie ein Risiko ein",
                "tr": "asla risk alma",
            }},
            {"id": "p1", "x": 26, "base": 431, "size": 42, "pitch": 48, "w": 520, "text": {
                "fr": f"et si tu échoues{NB}?\net si on se moque de toi{NB}?\net si ça ne marche pas{NB}?",
                "de": "was, wenn du scheiterst?\nwas, wenn alle lachen?\nwas, wenn’s schiefgeht?",
                "tr": "ya başaramazsan?\nya insanlar gülerse?\nya işler yolunda gitmezse?",
            }},
            {"id": "p2", "x": 26, "after": "p1", "gap": 96, "size": 42, "pitch": 48, "w": 520, "text": {
                "fr": "mieux vaut rester à l’abri dans ta chambre, sur ton téléphone, à penser à la vie que tu aurais pu vivre",
                "de": "bleib lieber sicher in deinem Zimmer, am Handy, und denk an das Leben, das du hättest haben können",
                "tr": "en iyisi odanda, telefonunun başında güvende kal ve yaşayabileceğin hayatı düşünüp dur",
            }},
            {"id": "p3", "x": 29, "base": 879, "size": 42, "pitch": 48, "w": 820, "text": {
                "fr": "prendre des risques peut te faire échouer, les éviter [te fait juste gâcher ta vie]",
                "de": "Risiken können dich scheitern lassen, sie zu meiden [verschwendet nur dein Leben]",
                "tr": "risk almak seni başarısız kılabilir, kaçmak ise [sadece hayatını boşa harcar]",
            }},
        ],
    },
]

HASHTAGS = {
    "fr": "#etudiant #revisions #methodedetude #productivite #motivationetudes",
    "de": "#lernen #studium #lerntipps #produktivität #schule",
    "tr": "#öğrenci #dersçalışma #verimlilik #motivasyon #üniversite",
}

if __name__ == "__main__":
    origine, cap_fr, cap_de, cap_tr, sortie = (Path(a) for a in sys.argv[1:6])
    langues = sys.argv[6].split(",") if len(sys.argv) > 6 else ["fr", "de", "tr"]
    sortie.mkdir(parents=True, exist_ok=True)
    rendre_post(SLIDES, origine, ID, {"fr": str(cap_fr), "de": str(cap_de), "tr": str(cap_tr)},
                None, sortie, langues)
