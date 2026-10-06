"""White post @amayareading 7681048823824649494 — « 5 things i did that fixed
my phone addiction (from 14 hours screen time to 3) » (11 300 vues, 6 slides),
en FR, DE et TR.

Un témoignage à la première personne, titres numérotés. La slide 5 d'origine
(« 4. started reading books instead ») vend ReadUp : une page de livre et sa
carte App Store. Elle devient le même geste avec une autre appli : l'appli
micabo à la place de TikTok sur l'écran d'accueil ; le pouce y va tout seul,
autant qu'il tombe sur des flashcards de ses cours. Le « 14 h → 3 h » d'origine
reste (c'est le témoignage), aucun chiffre de résultat n'est prêté à micabo.
La capture micabo remplace la page de livre, la carte App Store micabo celle
de ReadUp.

    python3 -I post_7681048823824649494.py <slides_origine/> <cap_fr> <cap_de> <cap_tr> <fiche_app_store> <sortie/> [fr,de,tr]
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from post_lib import banniere_app_store, rendre_post  # noqa: E402

ID = "7681048823824649494"
NB = " "

SLIDES = [
    {  # 1 — titre
        "effacer": [(96, 316, 832, 458), (536, 452, 864, 550)],
        "blocks": [
            {"id": "titre", "x": 101, "base": 369, "size": 63, "pitch": 73, "w": 950, "text": {
                "fr": "5 choses qui ont guéri mon\naddiction au tél",
                "de": "5 Dinge, die meine Handysucht\ngeheilt haben",
                "tr": "beni telefon bağımlılığından\nkurtaran 5 şey",
            }},
            {"id": "sous", "x": 700, "align": "center", "base": 489, "size": 42, "pitch": 48, "w": 500, "text": {
                "fr": f"(de 14{NB}heures\nd’écran à 3)",
                "de": f"(von 14{NB}Stunden\nBildschirmzeit auf 3)",
                "tr": f"(14{NB}saatlik ekran\nsüresinden 3 saate)",
            }},
        ],
    },
    {  # 2 — noir et blanc
        "effacer": [(92, 332, 890, 410), (444, 538, 860, 884)],
        "blocks": [
            {"id": "num", "x": 98, "base": 387, "size": 63, "pitch": 73, "w": 200, "text": "1."},
            {"id": "titre", "x": 166, "base": 387, "size": 63, "pitch": 73, "w": 880, "text": {
                "fr": "j’ai mis mon tél en noir et blanc",
                "de": "Handy auf Graustufen gestellt",
                "tr": "telefonu gri tonlamaya aldım",
            }},
            {"id": "p1", "x": 452, "base": 577, "size": 42, "pitch": 48.3, "w": 430, "text": {
                "fr": "tout le monde le dit, mais ça aide vraiment. laisse-le en gris pour tiktok et les reels aussi.",
                "de": "alle sagen, man soll’s machen, aber es hilft echt. lass es auch bei TikTok und Reels grau.",
                "tr": "herkes bunu söylüyor ama gerçekten işe yarıyor. tiktok ve reels’te de gri kalsın.",
            }},
            {"id": "p2", "x": 452, "after": "p1", "gap": 95, "size": 42, "pitch": 48, "w": 430, "text": {
                "fr": "scroller est devenu\ntellement ennuyeux",
                "de": "Scrollen ist jetzt\nso langweilig",
                "tr": "artık kaydırmak\nçok sıkıcı",
            }},
        ],
    },
    {  # 3 — pas de youtube en mangeant
        "effacer": [(74, 330, 892, 478), (96, 536, 420, 826)],
        "blocks": [
            {"id": "num", "x": 79, "base": 384, "size": 63, "pitch": 73, "w": 200, "text": "2."},
            {"id": "titre", "x": 154, "base": 384, "size": 63, "pitch": 73, "w": 880, "text": {
                "fr": "j’ai arrêté youtube sur mon\ntéléphone pendant les repas",
                "de": "kein YouTube mehr\nam Handy beim Essen",
                "tr": "yemek yerken telefonda\nyoutube izlemeyi bıraktım",
            }},
            {"id": "p1", "x": 104, "base": 575, "size": 42, "pitch": 48.2, "w": 345, "text": {
                "fr": "je sais, ça paraît\nimpossible, mais\naprès quelques\njours d’essai, j’ai\nla tête tellement\nplus claire",
                "de": "ich weiß, klingt unmöglich, aber nach ein paar Tagen ist mein Kopf so viel klarer",
                "tr": "biliyorum, imkânsız\ngibi geliyor ama\nbirkaç gün sonra\nzihnim artık\nçok daha berrak",
            }},
        ],
    },
    {  # 4 — le téléphone sur le bureau
        "effacer": [(54, 332, 602, 408), (130, 408, 840, 482), (478, 508, 914, 950)],
        "blocks": [
            {"id": "num", "x": 60, "base": 387, "size": 63, "pitch": 74, "w": 200, "text": "3."},
            {"id": "titre", "x": 137, "base": 387, "size": 63, "pitch": 74, "w": 900, "text": {
                "fr": "je laisse mon téléphone\nsur mon bureau avec un réveil",
                "de": "mein Handy bleibt mit Wecker\nauf dem Schreibtisch",
                "tr": "telefonumu alarmla birlikte\nmasamda bırakıyorum",
            }},
            {"id": "p1", "x": 487, "base": 548, "size": 42, "pitch": 48.3, "w": 450, "text": {
                "fr": "avant, je le gardais près de mon lit, mais je coupais l’alarme et je scrollais des heures",
                "de": "früher lag es neben meinem Bett, aber ich hab den Wecker nur ausgemacht und stundenlang gescrollt",
                "tr": "eskiden yatağımın yanında dururdu ama alarmı kapatıp saatlerce telefonda gezinirdim",
            }},
            {"id": "p2", "x": 487, "after": "p1", "gap": 95, "size": 42, "pitch": 48.3, "w": 450, "text": {
                "fr": "le mettre là où je dois me lever et marcher pour l’atteindre, ça me réveille pour de bon",
                "de": "jetzt liegt es da, wo ich aufstehen und hinlaufen muss, und das macht mich richtig wach",
                "tr": "kalkıp yürümem gereken bir yere koymak beni gerçekten uyandırıyor",
            }},
        ],
    },
    {  # 5 — la slide micabo (à la place de « 4. started reading books instead »)
        "effacer": [(40, 286, 940, 364), (44, 450, 632, 646), (460, 600, 792, 1240), (74, 786, 406, 942)],
        "pub": {"box": (467, 625, 783, 1247), "banniere": (82, 793, 312)},
        "blocks": [
            # Titre sur deux lignes (fr, tr) : il monte d'un interligne pour
            # garder l'air de l'original au-dessus du texte.
            {"id": "num", "x": 45, "base": 267, "size": 63, "pitch": 73, "w": 200,
             "text": {"fr": "4.", "de": None, "tr": "4."}},
            {"id": "titre", "x": 120, "base": 267, "size": 63, "pitch": 73, "w": 900, "text": {
                "fr": "j’ai remplacé tiktok\npar mes révisions",
                "de": None,
                "tr": "tiktok’un yerine\nderslerimi koydum",
            }},
            {"id": "num_de", "x": 45, "base": 340, "size": 63, "pitch": 73, "w": 200,
             "text": {"fr": None, "de": "4.", "tr": None}},
            {"id": "titre_de", "x": 120, "base": 340, "size": 63, "pitch": 73, "w": 900, "text": {
                "fr": None,
                "de": "TikTok gegen Lernen getauscht",
                "tr": None,
            }},
            # Trois lignes larges au-dessus de la capture, puis la colonne
            # étroite à gauche de la capture (comme « books so far »).
            {"id": "p1", "x": 51, "base": 490, "size": 42, "pitch": 48, "w": 660, "text": {
                "fr": "j’ai mis l’appli micabo sur mon\nécran d’accueil, pile à la place\nde tiktok. le pouce y va tout seul,",
                "de": "auf meinem Homescreen ist jetzt\ndie micabo-App, wo vorher TikTok\nwar. der Daumen geht eh von allein",
                "tr": "ana ekranımda tiktok’un yerine\nmicabo uygulamasını koydum.\nparmağım zaten oraya kendi",
            }},
            {"id": "p2", "x": 51, "after": "p1", "gap": 48, "size": 42, "pitch": 48, "w": 395, "text": {
                "fr": "autant qu’il tombe\nsur des flashcards\nde mes cours",
                "de": "hin, dann wenigstens\nzu Karteikarten aus\nmeinem Stoff",
                "tr": "kendine gidiyor, bari\nders notlarımın bilgi\nkartlarına gitsin",
            }},
        ],
    },
    {  # 6 — plus aucun déclencheur
        "effacer": [(124, 372, 850, 446), (44, 512, 460, 846)],
        "blocks": [
            {"id": "num", "x": 130, "base": 425, "size": 63, "pitch": 73, "w": 200, "text": "5."},
            {"id": "titre", "x": 204, "base": 425, "size": 63, "pitch": 73, "w": 860, "text": {
                "fr": "j’ai coupé les déclencheurs",
                "de": "alle Trigger ausgeschaltet",
                "tr": "tüm tetikleyicileri kapattım",
            }},
            {"id": "p1", "x": 451, "align": "right", "base": 549, "size": 42, "pitch": 48, "w": 420, "text": {
                "fr": "j’ai littéralement 0 notification activée sur toutes mes messageries",
                "de": "ich hab bei all meinen Messengern echt 0 Mitteilungen an",
                "tr": f"tüm mesajlaşma uygulamalarımda açık bildirim sayısı resmen{NB}0",
            }},
            {"id": "p2", "x": 451, "align": "right", "after": "p1", "gap": 97, "size": 42, "pitch": 48, "w": 420, "text": {
                "fr": "plus rien ne me pousse à regarder tant que je n’en ai pas envie",
                "de": "so gibt’s keinen Grund draufzuschauen, bis ich es selbst will",
                "tr": "ben istemedikçe bakmam için hiçbir sebep kalmıyor",
            }},
        ],
    },
]

HASHTAGS = {
    "fr": "#etudiant #revisions #tempsdecran #concentration #methodedetude",
    "de": "#lernen #studium #bildschirmzeit #fokus #lerntipps",
    "tr": "#dersçalışma #öğrenci #ekransüresi #odaklanma #verimlilik",
}

if __name__ == "__main__":
    origine, cap_fr, cap_de, cap_tr, fiche, sortie = (Path(a) for a in sys.argv[1:7])
    langues = sys.argv[7].split(",") if len(sys.argv) > 7 else ["fr", "de", "tr"]
    sortie.mkdir(parents=True, exist_ok=True)
    banniere = banniere_app_store(str(fiche), str(sortie / "banniere.jpg"))
    rendre_post(SLIDES, origine, ID, {"fr": str(cap_fr), "de": str(cap_de), "tr": str(cap_tr)},
                banniere, sortie, langues)
