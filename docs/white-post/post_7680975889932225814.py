"""White post @amayareading 7680975889932225814 — « 7 ways to stop
doomscrolling and reclaim your life (from an ex-chronic scroller) » (7 955 vues,
7 slides), en FR, DE et TR.

La slide 5 d'origine (« 4. Never scroll in bed ») vend ReadUp, qui bloque les
applis tant qu'on n'a pas lu 30 minutes. Elle devient la slide micabo, sous
l'angle du réveil : au lieu de scroller au lit, quelques flashcards de ses
cours sur l'appli micabo, et le cerveau démarre sur ses cours plutôt que sur un
fil. La page de livre devient la capture micabo, la carte App Store celle de
micabo.

Ce post écrit avec une majuscule en début de phrase : la casse est gardée. Les
titres sont numérotés avec un retrait suspendu (numéro, puis texte aligné).

    python3 -I post_7680975889932225814.py <slides_origine/> <cap_fr> <cap_de> <cap_tr> <fiche_app_store> <sortie/> [fr,de,tr]
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from post_lib import banniere_app_store, rendre_post  # noqa: E402

ID = "7680975889932225814"
NB = " "

SLIDES = [
    {  # 1 — titre
        "effacer": [(115, 400, 920, 546), (662, 574, 868, 718)],
        "blocks": [
            {"id": "titre", "x": 121.5, "base": 453, "size": 63, "pitch": 73, "w": 900, "text": {
                "fr": "7 façons d’arrêter de scroller\net de reprendre ta vie en main",
                "de": "7 Wege gegen Doomscrolling,\num dein Leben zurückzuholen",
                "tr": "7 adımda doomscrolling’i bırak\nve hayatını geri al",
            }},
            {"id": "sous", "x": 669, "base": 611.5, "size": 42, "pitch": 48.5, "w": 360, "text": {
                "fr": "par quelqu’un\nqui scrollait\nnon-stop",
                "de": "von jemandem,\nder früher nur\ngescrollt hat",
                "tr": "eski bir\nkaydırma\nbağımlısından",
            }},
        ],
    },
    {  # 2 — 1. ne pas emmener son téléphone partout
        "effacer": [(108, 414, 1000, 560), (560, 615, 940, 862)],
        "blocks": [
            {"id": "num", "x": 114.5, "base": 467, "size": 63, "pitch": 73, "w": 200, "text": "1."},
            {"id": "titre", "x": 182.5, "base": 467, "size": 63, "pitch": 73, "w": 820, "text": {
                "fr": "Arrête d’emmener ton\ntéléphone [partout]",
                "de": "Hör auf, dein Handy\n[überallhin] mitzunehmen",
                "tr": "Telefonunu [her yere]\nyanında götürmeyi bırak",
            }},
            {"id": "p1", "x": 572, "base": 653, "size": 42, "pitch": 48, "w": 450, "text": {
                "fr": f"Tu n’as pas besoin de ton téléphone pour aller aux toilettes, arrête de l’emmener partout{NB}!!",
                "de": "Du brauchst dein Handy nicht auf dem Klo, hör auf, es überallhin mitzunehmen!!",
                "tr": "Tuvalete giderken telefona ihtiyacın yok, onu her yere yanında götürmeyi bırak!!",
            }},
        ],
    },
    {  # 3 — 2. Substack n'est pas mieux
        "effacer": [(76, 414, 900, 562), (45, 650, 546, 842)],
        "blocks": [
            {"id": "num", "x": 81.4, "base": 468, "size": 63, "pitch": 73, "w": 200, "text": "2."},
            {"id": "titre", "x": 157, "base": 468, "size": 63, "pitch": 73, "w": 850, "text": {
                "fr": "Arrête de croire que scroller\nsur Substack, c’est mieux",
                "de": "Hör auf, so zu tun, als wäre\nScrollen auf Substack besser",
                "tr": "Substack’te kaydırmanın\ndaha iyi olduğunu sanma",
            }},
            {"id": "p1", "x": 540.5, "align": "right", "base": 688, "size": 42, "pitch": 48, "w": 490, "text": {
                "fr": "Ça a l’air productif, mais scroller sans fin sur substack ou pinterest, c’est aussi nul que tiktok",
                "de": "Es fühlt sich produktiv an, aber Doomscrolling auf substack oder pinterest ist so schlimm wie tiktok",
                "tr": "Verimli gibi geliyor ama substack ya da pinterest’te durmadan kaydırmak da tiktok kadar kötü",
            }},
        ],
    },
    {  # 4 — 3. réapprendre à s'ennuyer
        "effacer": [(82, 418, 835, 482), (480, 602, 880, 895)],
        "blocks": [
            {"id": "num", "x": 88, "base": 471, "size": 63, "pitch": 73, "w": 200, "text": "3."},
            {"id": "titre", "x": 162.5, "base": 471, "size": 63, "pitch": 73, "w": 870, "text": {
                "fr": "Réapprends à t’ennuyer",
                "de": "Lern wieder, dich zu langweilen",
                "tr": "Yeniden sıkılmayı öğren",
            }},
            {"id": "p1", "x": 487, "base": 641, "size": 42, "pitch": 48, "w": 420, "text": {
                "fr": "Les meilleures idées arrivent quand tu leur laisses de la place pour grandir",
                "de": "Die besten Ideen kommen, wenn du ihnen Raum zum Wachsen gibst",
                "tr": "En iyi fikirler, onlara büyüyecek alan tanıdığında gelir",
            }},
            {"id": "p2", "x": 487, "after": "p1", "gap": 96, "size": 42, "pitch": 48, "w": 420, "text": {
                "fr": "Arrête de scroller à chaque moment libre",
                "de": "Hör auf zu scrollen, sobald du mal frei hast",
                "tr": "Her boş anında kaydırmayı bırak",
            }},
        ],
    },
    {  # 5 — la slide micabo (à la place de « 4. Never scroll in bed »)
        "effacer": [(100, 372, 690, 432), (333, 520, 910, 815), (28, 460, 326, 1042), (378, 970, 774, 1158)],
        "pub": {"box": (34, 466, 320, 1034), "banniere": (415, 991, 320)},
        "blocks": [
            {"id": "num", "x": 106.4, "base": 425, "size": 63, "pitch": 73, "w": 200, "text": "4."},
            {"id": "titre", "x": 180.5, "base": 425, "size": 63, "pitch": 73, "w": 860, "text": {
                "fr": "Ne scrolle jamais au réveil",
                "de": "Scroll nie morgens im Bett",
                "tr": "Uyanır uyanmaz kaydırma",
            }},
            {"id": "p1", "x": 341, "base": 558, "size": 42, "pitch": 48, "w": 620, "text": {
                "fr": f"Je fais plutôt quelques flashcards de mes cours sur l’appli micabo, et ça m’aide vraiment{NB}: mon cerveau démarre la journée sur mes cours. Mais tout sauf un fil infini fait l’affaire",
                "de": "Ich mache stattdessen ein paar Karteikarten zu meinem Stoff in der micabo-App, und das hilft echt: So startet mein Kopf mit dem Lernstoff in den Tag. Aber alles außer einem endlosen Feed tut’s auch",
                "tr": "Ben onun yerine micabo uygulamasında derslerimden birkaç bilgi kartıyla kendimi test ediyorum ve bu çok işe yarıyor: beynim güne doğrudan derslerimle başlıyor. Ama sonsuz akış olmayan her şey işini görür",
            }},
        ],
    },
    {  # 6 — 5. couper les notifications
        "effacer": [(125, 372, 770, 432), (446, 565, 880, 808)],
        "blocks": [
            {"id": "num", "x": 130.5, "base": 425, "size": 63, "pitch": 73, "w": 200, "text": "5."},
            {"id": "titre", "x": 204.5, "base": 425, "size": 63, "pitch": 73, "w": 840, "text": {
                "fr": "Coupe les notifications",
                "de": "Benachrichtigungen aus",
                "tr": "Bildirimleri kapat",
            }},
            {"id": "p1", "x": 452.5, "base": 602, "size": 42, "pitch": 48, "w": 430, "text": {
                "fr": "N’active pas les notifications pour chaque événement de chaque appli, tu n’as pas besoin de répondre tout de suite",
                "de": "Du brauchst keine Benachrichtigung für jedes Ereignis in jeder App, du musst nicht sofort antworten",
                "tr": "Her uygulamadaki her şey için bildirim açık tutma, hemen cevap vermen gerekmiyor",
            }},
        ],
    },
    {  # 7 — 6. le téléphone dans une autre pièce
        "effacer": [(128, 372, 740, 506), (130, 585, 508, 832)],
        "blocks": [
            {"id": "num", "x": 134.3, "base": 425, "size": 63, "pitch": 73, "w": 200, "text": "6."},
            {"id": "titre", "x": 210, "base": 425, "size": 63, "pitch": 73, "w": 820, "text": {
                "fr": "Laisse ton téléphone dans\nune autre pièce",
                "de": "Lass dein Handy in einem\nanderen Raum",
                "tr": "Telefonunu başka bir\nodada tut",
            }},
            {"id": "p1", "x": 502, "align": "right", "base": 623, "size": 42, "pitch": 48.25, "w": 370, "text": {
                "fr": "Laisse-le dans une autre pièce ou loin de toi, tu ne feras jamais rien avec ton téléphone à côté",
                "de": "Leg es in einen anderen Raum oder weit weg, mit dem Handy neben dir schaffst du nie was",
                "tr": "Onu başka bir odaya ya da uzağa koy, telefon yanındayken hiçbir iş yapamazsın",
            }},
        ],
    },
]

HASHTAGS = {
    "fr": "#doomscrolling #concentration #revisions #etudiant #methodedetude",
    "de": "#lernen #konzentration #studium #lerntipps #bildschirmzeit",
    "tr": "#dersçalışma #odaklanma #öğrenci #yks #ekransüresi",
}

if __name__ == "__main__":
    origine, cap_fr, cap_de, cap_tr, fiche, sortie = (Path(a) for a in sys.argv[1:7])
    langues = sys.argv[7].split(",") if len(sys.argv) > 7 else ["fr", "de", "tr"]
    sortie.mkdir(parents=True, exist_ok=True)
    banniere = banniere_app_store(str(fiche), str(sortie / "banniere.jpg"))
    rendre_post(SLIDES, origine, ID, {"fr": str(cap_fr), "de": str(cap_de), "tr": str(cap_tr)},
                banniere, sortie, langues)
