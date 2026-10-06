"""White post @amayareading 7686189452963712288 — « 10/10 hobbies to make you
dangerously intelligent » (123 200 vues), en FR, DE et TR.

La slide 4 d'origine (« stop scrolling and start reading ») vend ReadUp. Elle
devient « scrolle moins, retiens plus » : se rappeler une
réponse plutôt que la reconnaître, et micabo pour en faire dix minutes par jour
sur ses propres cours.

    python3 -I post_7686189452963712288.py <slides_origine/> <cap_fr> <cap_de> <cap_tr> <sortie/> [fr,de,tr]
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from post_lib import rendre_post  # noqa: E402

ID = "7686189452963712288"
NB = " "

SLIDES = [
    {  # 1 — titre
        "effacer": [(90, 242, 824, 386), (360, 1070, 818, 1120)],
        "blocks": [
            {"id": "titre", "x": 97, "base": 294, "size": 63, "pitch": 73, "w": 820, "text": {
                "fr": "10/10 hobbies pour un\ncerveau redoutable",
                "de": "10/10 Hobbys, die dich\ngefährlich klug machen",
                "tr": "seni tehlikeli derecede\nzeki yapacak 10/10 hobi",
            }},
            {"id": "sous", "x": 811, "align": "right", "base": 1107, "size": 42, "pitch": 48, "w": 990, "text": {
                "fr": "(validé par les neurosciences)",
                "de": "(neurowissenschaftlich belegt)",
                "tr": "(nörobilim onaylı)",
            }},
        ],
    },
    {  # 2 — l'esprit critique
        "effacer": [(38, 214, 716, 288), (36, 330, 962, 426), (556, 480, 990, 676), (556, 720, 990, 866),
                    (28, 940, 768, 1040)],
        "blocks": [
            {"id": "titre", "x": 44, "base": 266, "size": 63, "pitch": 73, "w": 1000, "text": {
                "fr": "entraîne ton [esprit critique]",
                "de": "trainier dein [kritisches Denken]",
                "tr": "[eleştirel düşünmeyi] çalış",
            }},
            {"id": "p1", "x": 41, "base": 366, "size": 42, "pitch": 48, "w": 960, "text": {
                "fr": "arrête de [croire aveuglément] la première explication que ton cerveau te donne",
                "de": "hör auf, der ersten Erklärung deines Gehirns [blind zu vertrauen]",
                "tr": "beyninin sana sunduğu ilk açıklamaya [körü körüne güvenmeyi] bırak",
            }},
            {"id": "p2", "x": 564, "base": 516, "size": 42, "pitch": 48, "w": 440, "text": {
                "fr": "note tes prédictions, traque tes biais, argumente [contre] [ton propre avis]",
                "de": "schreib Vorhersagen auf, prüf deine Denkfehler, argumentier bewusst [gegen] [deine eigene Meinung]",
                "tr": "tahminlerini yaz, önyargılarını sorgula, bilerek [kendi fikrine karşı] tartış",
            }},
            {"id": "p3", "x": 565, "after": "p2", "gap": 96, "size": 42, "pitch": 48, "w": 440, "text": {
                "fr": "l’intelligence compte peu si ton raisonnement est plein d’angles morts",
                "de": "Intelligenz bringt wenig, wenn dein Denken voller blinder Flecken ist",
                "tr": "düşüncende kör noktalar varsa zeki olmanın pek anlamı yok",
            }},
            {"id": "p4", "x": 33, "base": 977, "size": 42, "pitch": 48, "w": 990, "text": {
                "fr": "ne décide rien sous le coup de la colère,\nne promets rien sous le coup de la joie",
                "de": "triff keine Entscheidungen, wenn du wütend bist,\nund keine Versprechen, wenn du glücklich bist",
                "tr": "öfkeliyken karar verme,\nmutluyken söz verme",
            }},
        ],
    },
    {  # 3 — l'inconfort
        "effacer": [(38, 210, 626, 356), (318, 410, 782, 500), (546, 538, 976, 828), (38, 925, 856, 1024)],
        "blocks": [
            {"id": "titre", "x": 44, "base": 262, "size": 63, "pitch": 73, "w": 1000, "text": {
                "fr": "apprends à être à l’aise\n[dans l’inconfort]",
                "de": "fühl dich wohl damit,\n[dich unwohl zu fühlen]",
                "tr": "[rahatsız olmaktan]\nrahatsız olma",
            }},
            {"id": "p1", "x": 325, "base": 448, "size": 42, "pitch": 48, "w": 690, "text": {
                "fr": f"fais des choses qui font\ntravailler ton cerveau{NB}:",
                "de": "mach Dinge, die dein\nGehirn fordern:",
                "tr": "beynini çalıştıran\nşeyler yap:",
            }},
            {"id": "p2", "x": 554, "base": 575, "size": 42, "pitch": 48.2, "w": 450, "text": {
                "fr": "livres exigeants, conversations difficiles, compétences nouvelles, problèmes résolus [sans regarder la réponse]",
                "de": "schwierige Bücher, unangenehme Gespräche, neue Fähigkeiten, Probleme lösen, [ohne sofort nach] [der Lösung zu suchen]",
                "tr": "zor kitaplar, çetin sohbetler, yeni beceriler öğrenmek, [cevaba hemen bakmadan] problem çözmek",
            }},
            {"id": "p3", "x": 44, "base": 962, "size": 42, "pitch": 48, "w": 960, "text": {
                "fr": "ton cerveau [progresse] rarement quand tu fais [ce qui te semble déjà facile]",
                "de": "[geistiges Wachstum] passiert selten, solange du tust, was [sich schon leicht anfühlt]",
                "tr": "[zihinsel gelişim], [zaten kolay gelen] şeyleri yaparken nadiren olur",
            }},
        ],
    },
    {  # 4 — la slide micabo (à la place de « stop scrolling and start reading »)
        "effacer": [(26, 212, 880, 288), (456, 385, 946, 1196), (24, 391, 441, 1230)],
        "pub": {"box": (30, 397, 435, 1224)},
        "blocks": [
            {"id": "titre", "x": 30, "base": 264, "size": 63, "pitch": 73, "w": 1020, "text": {
                "fr": "[scrolle moins], [retiens plus]",
                "de": "[weniger scrollen], [mehr behalten]",
                "tr": "[daha az kaydır], [daha çok hatırla]",
            }},
            {"id": "p1", "x": 464, "base": 422, "size": 42, "pitch": 48, "w": 560, "text": {
                "fr": "les vidéos courtes habituent ton cerveau à [réclamer du nouveau] sans arrêt",
                "de": "Kurzvideos gewöhnen dein Gehirn daran, [alle paar Sekunden] Neues zu wollen",
                "tr": "kısa videolar beynini [birkaç saniyede bir] yeni bir şey istemeye alıştırıyor",
            }},
            {"id": "p2", "x": 464, "after": "p1", "gap": 96, "size": 42, "pitch": 48, "w": 560, "text": {
                "fr": "retrouver une réponse de tête oblige ton cerveau à [aller chercher l’info] au lieu de [simplement la reconnaître]",
                "de": "wer sich selbst abfragt, muss [Wissen aktiv abrufen], statt es [nur wiederzuerkennen]",
                "tr": "bir cevabı aklından bulmak, beynini bilgiyi [tanımak yerine] [hatırlamaya] zorlar",
            }},
            {"id": "p3", "x": 464, "after": "p2", "gap": 96, "size": 42, "pitch": 48, "w": 560, "text": {
                "fr": "si tu veux [un cerveau plus vif], remplace ton scroll par [quelques minutes à te tester]",
                "de": "willst du [wieder klarer denken], ersetz Scrollen durch [ein paar Minuten Abfragen]",
                "tr": "[daha keskin bir zihin] istiyorsan kaydırma süreni [birkaç dakikalık tekrarla] değiştir",
            }},
            {"id": "p4", "x": 464, "after": "p3", "gap": 96, "size": 42, "pitch": 48, "w": 560, "text": {
                "fr": f"moi j’ouvre l’appli micabo au lieu de tiktok{NB}: elle [fait des flashcards avec mes cours] et je révise 10{NB}min par jour",
                "de": f"ich öffne statt TikTok die micabo-App: sie [macht Karteikarten aus meinem Stoff], und ich lerne täglich 10{NB}Minuten",
                "tr": f"ben tiktok yerine micabo uygulamasını açıyorum: [ders notlarımdan bilgi kartları hazırlıyor], günde 10{NB}dakika çalışıyorum",
            }},
        ],
    },
    {  # 5 — les échecs
        "effacer": [(40, 221, 620, 290), (38, 374, 944, 474), (38, 539, 446, 680), (38, 730, 446, 974)],
        "blocks": [
            {"id": "titre", "x": 46, "base": 273, "size": 63, "pitch": 73, "w": 1000, "text": {
                "fr": "joue aux échecs, et étudie-les",
                "de": "spiel Schach und studier es",
                "tr": "satranç oyna, satranç çalış",
            }},
            {"id": "p1", "x": 43, "base": 411, "size": 42, "pitch": 48, "w": 990, "text": {
                "fr": f"les échecs t’obligent à anticiper, à repérer des schémas et à te demander «{NB}qu’est-ce que je rate{NB}?{NB}»",
                "de": "Schach zwingt dich, vorauszudenken, Muster zu erkennen und ständig zu fragen: „Was übersehe ich?“",
                "tr": "satranç seni ileriyi hesaplamaya, kalıpları fark etmeye ve sürekli “neyi kaçırıyorum?” diye sormaya zorlar",
            }},
            {"id": "p2", "x": 43, "base": 576, "size": 42, "pitch": 48, "w": 480, "text": {
                "fr": "ne te contente pas de parties au hasard, [analyse-les] après coup",
                "de": "spiel nicht einfach drauflos, [analysier deine Partien] hinterher",
                "tr": "rastgele oynayıp geçme, oyunlarını sonra [analiz et]",
            }},
            {"id": "p3", "x": 43, "after": "p2", "gap": 95, "size": 42, "pitch": 48, "w": 480, "text": {
                "fr": "selon les études, [même 20 à 30 minutes] par jour offrent à ton cerveau un vrai [entraînement à la résolution de problèmes]",
                "de": "Studien zeigen: [schon 20 bis 30 Minuten] am Tag geben deinem Gehirn gezieltes [Training im Problemlösen]",
                "tr": "araştırmalara göre [günde 20-30 dakika bile] beynine bilinçli bir [problem çözme antrenmanı] sağlar",
            }},
        ],
    },
    {  # 6 — la communication
        "effacer": [(30, 201, 824, 346), (28, 437, 514, 630), (28, 677, 512, 776), (28, 821, 520, 1014)],
        "blocks": [
            {"id": "titre", "x": 36, "base": 253, "size": 63, "pitch": 73, "w": 1000, "text": {
                "fr": "travaille ta [communication]",
                "de": "verbessere deine [Kommunikation]",
                "tr": "[iletişim becerilerini] geliştir",
            }},
            {"id": "p1", "x": 34, "base": 474, "size": 42, "pitch": 48.3, "w": 500, "text": {
                "fr": "si tu ne peux pas expliquer une idée clairement, c’est que [tu ne la] [comprends pas] assez",
                "de": "wenn du eine Idee nicht klar erklären kannst, [verstehst du sie] wohl [nicht wirklich]",
                "tr": "bir fikri net anlatamıyorsan muhtemelen [onu yeterince] [derinden anlamamışsındır]",
            }},
            {"id": "p2", "x": 35, "after": "p1", "gap": 96, "size": 42, "pitch": 48, "w": 500, "text": {
                "fr": "entraîne-toi à écrire, à parler, à raconter et à [enseigner]",
                "de": "üb Schreiben, Sprechen, Erzählen und [Erklären]",
                "tr": "yazmayı, konuşmayı, hikâye anlatmayı ve [öğretmeyi] çalış",
            }},
            {"id": "p3", "x": 33, "after": "p2", "gap": 96, "size": 42, "pitch": 48, "w": 500, "text": {
                "fr": "dire simplement une idée compliquée [oblige ton cerveau] à l’organiser",
                "de": "Kompliziertes einfach auszudrücken [zwingt dein Gehirn], Gedanken sauber zu ordnen",
                "tr": "karmaşık düşünceleri sade bir dile dökmek, [beynini] onları [düzgünce toparlamaya zorlar]",
            }},
        ],
    },
]

HASHTAGS = {
    "fr": "#revisions #methodedetude #etudiant #memoire #productivite",
    "de": "#lernen #lerntipps #studium #gedächtnis #abitur",
    "tr": "#dersçalışma #öğrenci #hafıza #yks #verimlilik",
}

if __name__ == "__main__":
    origine, cap_fr, cap_de, cap_tr, sortie = (Path(a) for a in sys.argv[1:6])
    langues = sys.argv[6].split(",") if len(sys.argv) > 6 else ["fr", "de", "tr"]
    sortie.mkdir(parents=True, exist_ok=True)
    rendre_post(SLIDES, origine, ID, {"fr": str(cap_fr), "de": str(cap_de), "tr": str(cap_tr)},
                None, sortie, langues)
