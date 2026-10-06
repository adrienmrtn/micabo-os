"""White post @amayareading 7689918962905124129 — « 10/10 habits to become
smart again » (187 000 vues), en FR, DE et TR.

La slide 4 d'origine (« read books instead of scrolling ») vend ReadUp. Elle
devient « réviser au lieu de scroller » : se tester plutôt que consommer, et
micabo pour remplacer une partie du scroll par dix minutes de flashcards.

    python3 -I post_7689918962905124129.py <slides_origine/> <cap_fr> <cap_de> <cap_tr> <fiche_app_store> <sortie/> [fr,de,tr]
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from post_lib import banniere_app_store, rendre_post  # noqa: E402

ID = "7689918962905124129"
NB = " "

SLIDES = [
    {  # 1 — titre
        "effacer": [(84, 238, 908, 394), (444, 987, 908, 1048)],
        "blocks": [
            {"id": "titre", "x": 91, "base": 294, "size": 63, "pitch": 73, "w": 830, "text": {
                "fr": "10/10 habitudes pour réveiller ton intelligence",
                "de": "10/10 Gewohnheiten, um wieder schlau zu werden",
                "tr": "yeniden zeki olmak için\n10/10 alışkanlık",
            }},
            {"id": "sous", "x": 901, "align": "right", "base": 1028, "size": 42, "pitch": 48, "w": 990, "text": {
                "fr": "(validé par les neurosciences)",
                "de": "(neurowissenschaftlich belegt)",
                "tr": "(nörobilim onaylı)",
            }},
        ],
    },
    {  # 2 — la musique en continu
        "effacer": [(46, 221, 628, 372), (47, 411, 905, 520), (665, 582, 1010, 934), (45, 986, 905, 1088)],
        "blocks": [
            {"id": "titre", "x": 55, "base": 277, "size": 63, "pitch": 73, "w": 1000, "text": {
                "fr": "coupe [la musique]\nde temps en temps",
                "de": "hör nicht [ständig Musik]",
                "tr": "[sürekli müzik] dinlemeyi bırak",
            }},
            {"id": "p1", "x": 54, "base": 452, "size": 42, "pitch": 48, "w": 960, "text": {
                "fr": "arrête de remplir [chaque seconde de vide] avec des podcasts, de la musique, YouTube ou du scroll",
                "de": "hör auf, [jede leere Sekunde] mit Podcasts, Musik, YouTube oder Scrollen zu füllen",
                "tr": "[her boş saniyeyi] podcast, müzik, YouTube ya da kaydırmayla doldurmayı bırak",
            }},
            {"id": "p2", "x": 675, "base": 623, "size": 42, "pitch": 48.2, "w": 335, "text": {
                "fr": "ton cerveau a besoin de calme pour relier les idées, digérer ce qu’il a appris et [se faire sa propre opinion]",
                "de": "dein Gehirn braucht Ruhe, um Ideen zu verknüpfen, Gelerntes zu verarbeiten und [eigene Gedanken zu entwickeln]",
                "tr": "beynin fikirleri bağlamak, öğrendiklerini sindirmek ve [kendi fikrini kurmak] için sessizlik ister",
            }},
            {"id": "p3", "x": 55, "base": 1027, "size": 42, "pitch": 49, "w": 900, "text": {
                "fr": "au lieu de [réagir en permanence] à [celle des autres]",
                "de": "statt [ständig nur] auf [die der anderen] zu reagieren",
                "tr": "[başkalarının fikirlerine] [sürekli tepki vermek] yerine",
            }},
        ],
    },
    {  # 3 — réfléchir avant l'IA
        "effacer": [(38, 230, 712, 384), (38, 441, 1010, 504), (570, 588, 1010, 892), (38, 955, 905, 1066)],
        "blocks": [
            {"id": "titre", "x": 46, "base": 286, "size": 63, "pitch": 73, "w": 1000, "text": {
                "fr": "réfléchis par toi-même [avant]\n[d’utiliser l’IA]",
                "de": "denk selbst, [bevor]\n[du KI benutzt]",
                "tr": "[yapay zekâdan önce]\nkendin düşün",
            }},
            {"id": "p1", "x": 46, "base": 482, "size": 42, "pitch": 48, "w": 990, "text": {
                "fr": "ne délègue pas le premier jet de [chaque pensée]",
                "de": "lagere den ersten Entwurf [deiner Gedanken] nicht aus",
                "tr": "[her düşüncenin] ilk taslağını yapay zekâya bırakma",
            }},
            {"id": "p2", "x": 578, "base": 627, "size": 42, "pitch": 48, "w": 430, "text": {
                "fr": "écris d’abord [ce que tu penses], puis utilise l’IA pour le challenger, l’améliorer ou trouver les failles",
                "de": "schreib zuerst auf, [was du denkst], und nutz KI dann, um es zu hinterfragen, zu verbessern oder Lücken zu finden",
                "tr": "önce [ne düşündüğünü] yaz, sonra yapay zekâyı onu sorgulamak, geliştirmek ya da eksiklerini bulmak için kullan",
            }},
            {"id": "p3", "x": 46, "base": 996, "size": 42, "pitch": 48, "w": 990, "text": {
                "fr": "sinon, tes prompts s’améliorent pendant que [ton raisonnement] [s’entraîne de moins en moins]",
                "de": "sonst wirst du besser im Prompten, während [dein eigenes Denken] [immer weniger trainiert wird]",
                "tr": "yoksa prompt yazmakta ustalaşırken [kendi muhakemen] [giderek körelir]",
            }},
        ],
    },
    {  # 4 — la slide micabo (à la place de « read books instead of scrolling »)
        "effacer": [(28, 210, 880, 292), (450, 361, 1010, 564), (450, 601, 1010, 794), (450, 841, 1010, 1042),
                    (22, 318, 444, 1162), (54, 1166, 366, 1316)],
        "pub": {"box": (30, 326, 435, 1153), "banniere": (58, 1142, 250)},
        "blocks": [
            {"id": "titre", "x": 35, "base": 264, "size": 63, "pitch": 75, "w": 1010, "text": {
                "fr": "révise [au lieu de scroller]",
                "de": "lernen [statt zu scrollen]",
                "tr": "[kaydırmak yerine] ders çalış",
            }},
            {"id": "p1", "x": 460, "base": 400, "size": 42, "pitch": 48, "w": 540, "text": {
                "fr": "se tester oblige ton cerveau à [rester concentré], à retenir les détails et à [reconstruire le cours] dans ta tête",
                "de": "Abfragen zwingt dein Gehirn, [konzentriert zu bleiben], Details zu behalten und [den Stoff im Kopf aufzubauen]",
                "tr": "kendini test etmek beynini [odakta kalmaya], ayrıntıları hatırlamaya ve [konuyu kafanda kurmaya] zorlar",
            }},
            {"id": "p2", "x": 460, "after": "p1", "gap": 96, "size": 42, "pitch": 48, "w": 540, "text": {
                "fr": "si tu veux [retrouver un cerveau vif], remplace une partie de [ton scroll par des révisions]",
                "de": "wenn du [wieder schärfer denken] willst, tausch einen Teil [deines Scrollens gegen Lernen]",
                "tr": "[yeniden keskin bir zihin] istiyorsan [kaydırma sürenin] bir kısmını derse ayır",
            }},
            {"id": "p3", "x": 460, "after": "p2", "gap": 96, "size": 42, "pitch": 48, "w": 540, "text": {
                "fr": f"j’utilise l’appli micabo{NB}: elle [transforme mes cours en flashcards], et je m’y mets 10{NB}min avant d’ouvrir tiktok",
                "de": "ich nutze die micabo-App: sie [macht aus meinen Unterlagen Karteikarten], und ich lerne 10 Minuten, bevor ich TikTok öffne",
                "tr": f"ben micabo uygulamasını kullanıyorum: [ders notlarımı bilgi kartlarına çeviriyor], tiktok’u açmadan önce 10{NB}dakika çalışıyorum",
            }},
        ],
    },
    {  # 5 — des conversations avec des gens brillants
        "effacer": [(22, 195, 860, 348), (28, 420, 495, 530), (28, 564, 500, 818), (21, 899, 905, 1058)],
        "blocks": [
            {"id": "titre", "x": 30, "base": 251, "size": 63, "pitch": 75, "w": 1000, "text": {
                "fr": "parle plus souvent avec\ndes gens brillants",
                "de": "führ mehr Gespräche mit\nklugen Menschen",
                "tr": "zeki insanlarla daha çok\nsohbet et",
            }},
            {"id": "p1", "x": 36, "base": 461, "size": 42, "pitch": 48, "w": 455, "text": {
                "fr": "ton entourage te façonne",
                "de": "dein Umfeld prägt dich",
                "tr": "çevren seni şekillendirir",
            }},
            {"id": "p2", "x": 36, "base": 605, "size": 42, "pitch": 48, "w": 455, "text": {
                "fr": "une bonne conversation t’oblige à expliquer tes idées, à défendre ce que tu avances et à voir où ton raisonnement est fragile",
                "de": "gute Gespräche zwingen dich, Ideen zu erklären, Annahmen zu verteidigen und zu merken, wo dein Denken schwach ist",
                "tr": "iyi sohbetler seni fikirlerini açıklamaya, varsayımlarını savunmaya ve düşüncenin nerede zayıf olduğunu görmeye zorlar",
            }},
            {"id": "p3", "x": 29, "after": "p2", "gap": 143, "size": 42, "pitch": 48, "w": 900, "text": {
                "fr": "passe plus de temps avec des gens qui savent ce que tu ignores qu’avec des gens qui approuvent tout ce que tu dis",
                "de": "verbring mehr Zeit mit Leuten, die wissen, was du nicht weißt, statt mit Leuten, die allem zustimmen, was du sagst",
                "tr": "her söylediğine katılanlar yerine bilmediğin şeyleri bilen insanlarla daha çok vakit geçir",
            }},
        ],
    },
    {  # 6 — apprendre des choses difficiles exprès
        "effacer": [(26, 199, 805, 352), (18, 406, 592, 562), (18, 598, 592, 852), (18, 888, 592, 942)],
        "blocks": [
            {"id": "titre", "x": 36, "base": 253, "size": 63, "pitch": 72, "w": 1000, "text": {
                "fr": "apprends des choses [difficiles]\n[exprès]",
                "de": "lern [absichtlich]\n[schwierige Dinge]",
                "tr": "[zor şeyleri]\n[bilerek] öğren",
            }},
            {"id": "p1", "x": 24, "base": 447, "size": 42, "pitch": 48.5, "w": 560, "text": {
                "fr": "si tout ce que tu consommes est facile, ton cerveau n’a aucune raison de s’adapter",
                "de": "wenn alles, was du konsumierst, leicht ist, hat dein Gehirn keinen Grund, sich anzupassen",
                "tr": "tükettiğin her şey kolaysa beyninin uyum sağlamak için hiçbir nedeni yok",
            }},
            {"id": "p2", "x": 25, "after": "p1", "gap": 96, "size": 42, "pitch": 48, "w": 560, "text": {
                "fr": "lis des livres plus exigeants, étudie des sujets inconnus, résous des problèmes sans chercher la réponse tout de suite",
                "de": "lies anspruchsvollere Bücher, beschäftige dich mit fremden Themen, löse Probleme, ohne sofort nach der Lösung zu suchen",
                "tr": "daha zor kitaplar oku, bilmediğin konuları çalış, cevabı hemen aramadan problem çöz",
            }},
            {"id": "p3", "x": 25, "after": "p2", "gap": 96, "size": 42, "pitch": 48, "w": 560, "text": {
                "fr": "c’est l’effort qui compte",
                "de": "genau diese Mühe zählt",
                "tr": "asıl mesele zihinsel çaba",
            }},
        ],
    },
]

HASHTAGS = {
    "fr": "#revisions #methodedetude #etudiant #concentration #apprendre",
    "de": "#lernen #lerntipps #studium #konzentration #abitur",
    "tr": "#dersçalışma #öğrenme #odaklanma #öğrenci #yks",
}

if __name__ == "__main__":
    origine, cap_fr, cap_de, cap_tr, fiche, sortie = (Path(a) for a in sys.argv[1:7])
    langues = sys.argv[7].split(",") if len(sys.argv) > 7 else ["fr", "de", "tr"]
    sortie.mkdir(parents=True, exist_ok=True)
    banniere = banniere_app_store(str(fiche), str(sortie / "banniere.jpg"))
    rendre_post(SLIDES, origine, ID, {"fr": str(cap_fr), "de": str(cap_de), "tr": str(cap_tr)},
                banniere, sortie, langues)
