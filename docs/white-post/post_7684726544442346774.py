"""White post @amayareading 7684726544442346774 — « 6 habits to become
disgustingly productive » (271 100 vues, 7 slides), en FR, DE et TR.

La slide 4 d'origine (« 3. read classic books ») vend ReadUp. Elle devient
l'habitude micabo : se tester au lieu de relire, flashcards tirées de ses
propres cours, 10 minutes par jour.

    python3 -I post_7684726544442346774.py <slides_origine/> <cap_fr> <cap_de> <cap_tr> <fiche_app_store> <sortie/> [fr,de,tr]
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from post_lib import banniere_app_store, rendre_post  # noqa: E402

ID = "7684726544442346774"
NB = " "

SLIDES = [
    {  # 1 — titre
        "effacer": [(106, 251, 752, 404), (368, 943, 834, 1004)],
        "blocks": [
            {"id": "titre", "x": 114, "base": 303, "size": 63, "pitch": 73, "w": 930, "text": {
                "fr": "6 habitudes pour une\nproductivité indécente",
                "de": "6 Gewohnheiten, die dich\nunverschämt produktiv machen",
                "tr": "seni inanılmaz derecede\nüretken yapacak 6 alışkanlık",
            }},
            {"id": "sous", "x": 826, "align": "right", "base": 984, "size": 42, "pitch": 48, "w": 990, "text": {
                "fr": "(validé par les neurosciences)",
                "de": "(neurowissenschaftlich belegt)",
                "tr": "(nörobilim onaylı)",
            }},
        ],
    },
    {  # 2 — vraies pauses
        "effacer": [(36, 226, 570, 300), (48, 337, 600, 490), (579, 490, 1010, 643), (578, 682, 1010, 787),
                    (26, 958, 820, 1071)],
        "blocks": [
            {"id": "titre", "x": 44, "base": 284, "size": 63, "pitch": 75, "w": 1000, "text": {
                "fr": "1. fais de [vraies pauses]",
                "de": "1. mach [echte Pausen]",
                "tr": "1. [gerçek molalar] ver",
            }},
            {"id": "p1", "x": 56, "base": 376, "size": 42, "pitch": 48, "w": 900, "text": {
                "fr": "[scroller] entre deux sessions de travail, [ce n’est pas se reposer]. c’est pour ça que la fatigue ne part jamais",
                "de": "[Doomscrolling] zwischen zwei Lernblöcken [ist keine Pause]. deshalb bist du ständig müde",
                "tr": "çalışma aralarında [telefonda kaydırmak] [dinlenmek değildir]. hep yorgun olmanın sebebi bu",
            }},
            {"id": "p2", "x": 587, "base": 533, "size": 42, "pitch": 48, "w": 430, "text": {
                "fr": "tu remplaces juste une source de stimulation par une autre",
                "de": "du tauschst nur eine Reizquelle gegen die nächste",
                "tr": "sadece bir uyaran kaynağını başkasıyla değiştiriyorsun",
            }},
            {"id": "p3", "x": 587, "after": "p2", "gap": 96, "size": 42, "pitch": 48, "w": 430, "text": {
                "fr": "prends 10 minutes sans écran",
                "de": "nimm dir 10 Minuten ohne Bildschirm",
                "tr": "10 dakika ekransız kal",
            }},
            {"id": "p4", "x": 34, "base": 1001, "size": 42, "pitch": 48, "w": 800, "text": {
                "fr": "marche, étire-toi, regarde dehors, puis reviens avec un cerveau vraiment plus calme",
                "de": "geh ein paar Schritte, streck dich, schau aus dem Fenster und komm mit einem wirklich ruhigeren Kopf zurück",
                "tr": "yürü, esne, dışarı bak, sonra gerçekten sakinleşmiş bir zihinle geri dön",
            }},
        ],
    },
    {  # 3 — multitâche
        "effacer": [(28, 224, 740, 304), (18, 374, 480, 575), (18, 614, 480, 823), (21, 909, 760, 976)],
        "blocks": [
            {"id": "titre", "x": 36, "base": 278, "size": 63, "pitch": 75, "w": 1000, "text": {
                "fr": "2. arrête [le multitâche]",
                "de": "2. hör auf mit [Multitasking]",
                "tr": "2. [çoklu görevi] bırak",
            }},
            {"id": "p1", "x": 26, "base": 417, "size": 42, "pitch": 48, "w": 460, "text": {
                "fr": "chaque changement de tâche oblige ta mémoire de travail à lâcher un contexte pour en charger un autre",
                "de": "jeder Aufgabenwechsel zwingt dein Arbeitsgedächtnis, einen Kontext fallen zu lassen und den nächsten zu laden",
                "tr": "her görev değişikliği, çalışma belleğini bir bağlamı bırakıp yenisini yüklemeye zorlar",
            }},
            {"id": "p2", "x": 26, "after": "p1", "gap": 96, "size": 42, "pitch": 48, "w": 460, "text": {
                "fr": "faire 2 choses à la fois [donne l’impression d’avancer], mais ton cerveau ne fait que se réorienter en boucle",
                "de": "2 Dinge gleichzeitig zu machen [fühlt sich produktiv an], aber dein Gehirn orientiert sich nur ständig neu",
                "tr": "aynı anda 2 iş yapmak [verimli hissettirir] ama beynin sadece sürekli yeniden odaklanmaya çalışır",
            }},
            {"id": "p3", "x": 29, "after": "p2", "gap": 151, "size": 42, "pitch": 48, "w": 990, "text": {
                "fr": "une tâche, un onglet, [jusqu’au bout]",
                "de": "eine Aufgabe, ein Tab, [bis sie fertig ist]",
                "tr": "tek görev, tek sekme, [bitene kadar]",
            }},
        ],
    },
    {  # 4 — la slide micabo (à la place de « read classic books »)
        "effacer": [(50, 229, 640, 300), (55, 344, 640, 459), (489, 485, 1000, 597), (489, 628, 1000, 781),
                    (489, 820, 1000, 887), (52, 466, 472, 1172), (118, 1160, 408, 1302)],
        "pub": {"box": (62, 477, 461, 1164), "banniere": (100, 1182, 250)},
        "blocks": [
            {"id": "titre", "x": 58, "base": 287, "size": 63, "pitch": 75, "w": 1000, "text": {
                "fr": "3. [teste-toi] au lieu de relire",
                "de": "3. [frag dich selbst ab]",
                "tr": "3. okumak yerine [kendini test et]",
            }},
            {"id": "p1", "x": 63, "base": 387, "size": 42, "pitch": 48, "w": 960, "text": {
                "fr": f"tu te souviens vraiment de la page que tu viens de [relire]{NB}?",
                "de": "weißt du noch, was auf der Seite stand, die du gerade [gelesen] hast?",
                "tr": "az önce [okuduğun] sayfayı gerçekten hatırlıyor musun?",
            }},
            {"id": "p2", "x": 497, "base": 528, "size": 42, "pitch": 48, "w": 490, "text": {
                "fr": "[pas vraiment]. relire donne l’impression de savoir, se tester oblige ton cerveau à retrouver la réponse",
                "de": "[eben]. Lesen fühlt sich nach Wissen an, erst das Abfragen zwingt dein Gehirn, die Antwort selbst zu finden",
                "tr": "[hatırlamıyorsun, değil mi]. tekrar okumak bildiğin hissini verir, kendini test etmek ise beynini cevabı bulmaya zorlar",
            }},
            {"id": "p3", "x": 497, "after": "p2", "gap": 96, "size": 42, "pitch": 48, "w": 490, "text": {
                "fr": f"j’utilise l’appli micabo{NB}: elle transforme mes cours en flashcards, et je révise 10 min par jour",
                "de": "ich nutze die micabo-App: sie macht aus meinen Unterlagen Karteikarten, und ich lerne 10 Minuten am Tag",
                "tr": "ben micabo uygulamasını kullanıyorum: ders notlarımı bilgi kartlarına çeviriyor, ben de günde 10 dakika çalışıyorum",
            }},
            {"id": "p4", "x": 497, "after": "p3", "gap": 96, "size": 42, "pitch": 48, "w": 490, "text": {
                "fr": "[ancre ce que tu apprends]",
                "de": "[damit das Gelernte bleibt]",
                "tr": "[öğrendiklerin kalıcı olsun]",
            }},
        ],
    },
    {  # 5 — téléphone dans une autre pièce
        "effacer": [(27, 245, 1010, 325), (18, 392, 480, 499), (18, 536, 480, 641), (17, 680, 480, 883),
                    (16, 1002, 700, 1061)],
        "blocks": [
            {"id": "titre", "x": 35, "base": 299, "size": 63, "pitch": 75, "w": 1030, "text": {
                "fr": "4. ton portable [dans une autre pièce]",
                "de": "4. Handy [in einen anderen Raum]",
                "tr": "4. telefonunu [başka bir odaya] koy",
            }},
            {"id": "p1", "x": 26, "base": 431, "size": 42, "pitch": 48, "w": 455, "text": {
                "fr": "la volonté seule est [un très mauvais bloqueur de téléphone]",
                "de": "Willenskraft allein ist [ein miserabler Handy-Blocker]",
                "tr": "tek başına irade [berbat bir telefon engelleyicidir]",
            }},
            {"id": "p2", "x": 26, "after": "p1", "gap": 96, "size": 42, "pitch": 48, "w": 455, "text": {
                "fr": "une étude sur près de 800 personnes",
                "de": "eine Studie mit fast 800 Menschen",
                "tr": "yaklaşık 800 kişiyle yapılan bir araştırma",
            }},
            {"id": "p3", "x": 26, "after": "p2", "gap": 96, "size": 42, "pitch": 48, "w": 455, "text": {
                "fr": "a montré qu’avoir simplement son téléphone à côté [réduisait les capacités cognitives disponibles]",
                "de": "hat gezeigt, dass schon ein Handy in der Nähe [die verfügbare Denkleistung senkt]",
                "tr": "telefonun sadece yakında olmasının bile [kullanılabilir zihinsel kapasiteyi düşürdüğünü] gösterdi",
            }},
            {"id": "p4", "x": 24, "after": "p3", "gap": 178, "size": 42, "pitch": 48, "w": 990, "text": {
                "fr": f"[même sans s’en servir]{NB}!!",
                "de": "[selbst wenn man es gar nicht benutzt]!!",
                "tr": "[hiç kullanmasan bile]!!",
            }},
        ],
    },
    {  # 6 — la tâche la plus dure d'abord
        "effacer": [(31, 238, 790, 318), (32, 330, 560, 475), (532, 489, 1015, 642), (534, 681, 1015, 874)],
        "blocks": [
            {"id": "titre", "x": 39, "base": 292, "size": 63, "pitch": 75, "w": 1030, "text": {
                "fr": "5. commence par [le plus dur]",
                "de": "5. erledige [das Schwerste] zuerst",
                "tr": "5. [en zor işle] başla",
            }},
            {"id": "p1", "x": 40, "base": 369, "size": 42, "pitch": 48, "w": 560, "text": {
                "fr": "ton [cortex préfrontal] gère la planification, la concentration et le contrôle de soi",
                "de": "dein [präfrontaler Kortex] steuert Planung, Fokus und Selbstkontrolle",
                "tr": "[prefrontal korteksin] planlamayı, odaklanmayı ve öz denetimi yönetir",
            }},
            {"id": "p2", "x": 540, "base": 528, "size": 42, "pitch": 48, "w": 480, "text": {
                "fr": "[ne gaspille pas] ton attention la plus fraîche sur des mails et des petites tâches",
                "de": "[verschwende] deine frischeste Aufmerksamkeit nicht an Mails und Kleinkram",
                "tr": "en taze dikkatini e-postalara ve ufak işlere [harcama]",
            }},
            {"id": "p3", "x": 540, "after": "p2", "gap": 96, "size": 42, "pitch": 48, "w": 480, "text": {
                "fr": "consacre [les 60 à 90 premières minutes] à ce que tu risques le plus de repousser",
                "de": "nutze [die ersten 60 bis 90 Minuten] für das, was du am ehesten aufschieben würdest",
                "tr": "[ilk 60-90 dakikayı] en çok erteleyeceğin işe ayır",
            }},
        ],
    },
    {  # 7 — travailler avant de communiquer
        "effacer": [(36, 228, 940, 308), (535, 392, 1015, 641), (535, 680, 1015, 825)],
        "blocks": [
            {"id": "titre", "x": 44, "base": 282, "size": 63, "pitch": 75, "w": 1020, "text": {
                "fr": "6. travaille [avant] de répondre",
                "de": "6. arbeite, [bevor] du kommunizierst",
                "tr": "6. mesajlara bakmadan [önce] çalış",
            }},
            {"id": "p1", "x": 543, "base": 431, "size": 42, "pitch": 48.2, "w": 470, "text": {
                "fr": "accorde-toi 60 à 90 minutes de [travail sans interruption] avant de te rendre disponible pour les autres",
                "de": "gönn dir 60 bis 90 Minuten [ungestörtes Arbeiten], bevor du für alle anderen erreichbar bist",
                "tr": "herkese ulaşılabilir olmadan önce kendine 60-90 dakika [kesintisiz üretim] zamanı ver",
            }},
            {"id": "p2", "x": 543, "after": "p1", "gap": 96, "size": 42, "pitch": 48, "w": 470, "text": {
                "fr": "tes priorités doivent entrer dans ta tête avant celles des autres",
                "de": "deine Prioritäten sollten vor denen der anderen in deinem Kopf landen",
                "tr": "önce senin önceliklerin aklına girmeli, başkalarınınki sonra",
            }},
        ],
    },
]

HASHTAGS = {
    "fr": "#productivite #revisions #methodedetude #etudiant #concentration",
    "de": "#produktivität #lernen #lerntipps #studium #fokus",
    "tr": "#verimlilik #dersçalışma #odaklanma #öğrenci #yks",
}

if __name__ == "__main__":
    origine, cap_fr, cap_de, cap_tr, fiche, sortie = (Path(a) for a in sys.argv[1:7])
    langues = sys.argv[7].split(",") if len(sys.argv) > 7 else ["fr", "de", "tr"]
    sortie.mkdir(parents=True, exist_ok=True)
    banniere = banniere_app_store(str(fiche), str(sortie / "banniere.jpg"))
    rendre_post(SLIDES, origine, ID, {"fr": str(cap_fr), "de": str(cap_de), "tr": str(cap_tr)},
                banniere, sortie, langues)
