"""White post @amayareading 7692093201968090401 — « 10/10 habits to become
smart again (in this age of short-form content) » (15 500 vues, 6 slides), en
FR, DE et TR.

Même série que 7689918962905124129 et 7683541501007252758 : le titre change
(« récupérer ton cerveau », « dein Gehirn zurückzuholen », « beynini geri
kazanmak ») pour qu'un même compte ne publie pas deux fois le même titre.

Les slides 2 à 6 d'origine sont dessinées plus petit que le reste du compte
(corps 38 px, interligne 43,5-44, titres 58,5 px, mesurés au pixel) : elles
sont rendues à leur taille d'origine, pas à 42 / 63.

La slide 4 d'origine (« start reading everyday », le téléphone vert avec
TikTok en cage et « i use readup to block my apps ») devient « révise sur tes
propres cours » : les vidéos de révision et les résumés donnent l'impression
d'apprendre, mais restent du contenu qu'on consomme ; micabo pose des
questions sur ses propres cours, c'est l'élève qui va chercher la réponse,
quelques minutes par jour.

    python3 -I post_7692093201968090401.py <slides_origine/> <cap_fr> <cap_de> <cap_tr> <sortie/> [fr,de,tr]
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from post_lib import rendre_post  # noqa: E402

ID = "7692093201968090401"
NB = " "

T, C = 58.5, 38  # tailles mesurées sur les slides 2 à 6 d'origine

SLIDES = [
    {  # 1 — titre
        "effacer": [(86, 218, 740, 368), (422, 924, 796, 1024)],
        "blocks": [
            {"id": "titre", "x": 93, "base": 273, "size": 63, "pitch": 73, "w": 950, "text": {
                "fr": "10/10 habitudes pour\nrécupérer ton cerveau",
                "de": "10/10 Gewohnheiten, um dein\nGehirn zurückzuholen",
                "tr": "beynini geri kazanmak için\n10/10 alışkanlık",
            }},
            {"id": "sous", "x": 428, "base": 963, "size": 42, "pitch": 48, "w": 600, "text": {
                "fr": "(à l’ère des\nvidéos courtes)",
                "de": "(im Zeitalter\nder Kurzvideos)",
                "tr": "(kısa video çağında)",
            }},
        ],
    },
    {  # 2 — moins de stimulation
        "effacer": [(34, 226, 978, 298), (564, 372, 1012, 806), (38, 924, 914, 1022)],
        "blocks": [
            {"id": "titre", "x": 42, "base": 279, "size": T, "pitch": 69, "w": 1010, "text": {
                "fr": "passe plus de temps [sans stimulation]",
                "de": "verbring mehr Zeit [ohne Reize]",
                "tr": "[uyaransız] daha çok vakit geçir",
            }},
            {"id": "p1", "x": 575, "base": 410, "size": C, "pitch": 43.6, "w": 410, "text": {
                "fr": "arrête de remplir chaque balade, chaque repas et [chaque minute libre de contenu] et de [musique]",
                "de": "hör auf, jeden Spaziergang, jedes Essen und [jede freie Minute mit Videos] und [Musik] zu füllen",
                "tr": "her yürüyüşü, her yemeği ve [her boş dakikayı videoyla] ya da [müzikle] doldurmayı bırak",
            }},
            {"id": "p2", "x": 573, "after": "p1", "gap": 118, "size": C, "pitch": 43.7, "w": 410, "text": {
                "fr": "le calme laisse à ton cerveau la place de repasser les infos, de relier les idées et [de penser par lui-même]",
                "de": "Ruhe gibt deinem Gehirn Raum, Infos nachwirken zu lassen, Ideen zu verknüpfen und [eigene Gedanken zu formen]",
                "tr": "sessiz anlar, beynine bilgiyi sindirme, fikirleri bağlama ve [kendi düşüncelerini kurma] fırsatı verir",
            }},
            {"id": "p3", "x": 46, "base": 962, "size": C, "pitch": 44, "w": 920, "text": {
                "fr": f"les vidéos courtes à la chaîne te [grillent le cerveau] et [détruisent ta capacité d’attention{NB}!!]",
                "de": "ständige Kurzvideos [lassen dein Gehirn verrotten] und [ruinieren deine Aufmerksamkeitsspanne!!]",
                "tr": "sürekli kısa video izlemek [beynini çürütüyor] ve [dikkat süreni mahvediyor!!]",
            }},
        ],
    },
    {  # 3 — ne pas tout déléguer
        "effacer": [(38, 228, 640, 366), (40, 402, 832, 454), (586, 520, 1004, 1124)],
        "blocks": [
            {"id": "titre", "x": 46, "base": 281, "size": T, "pitch": 69, "w": 1000, "text": {
                "fr": "arrête de sous-traiter\n[chaque pensée]",
                "de": "hör auf, [jeden Gedanken]\nauszulagern",
                "tr": "düşünme işini [her seferinde]\nbaşkasına bırakma",
            }},
            {"id": "sous", "x": 47, "base": 438, "size": C, "pitch": 43.5, "w": 980, "text": {
                "fr": "ne demande pas à google ou à [l’IA dès que tu bloques]",
                "de": "frag nicht Google oder [die KI, sobald du festhängst]",
                "tr": "[takılır takılmaz] google’a ya da [yapay zekâya] sorma",
            }},
            {"id": "p1", "x": 599, "base": 557, "size": C, "pitch": 43.5, "w": 410, "text": {
                "fr": "[réfléchis d’abord au problème], tente une réponse, puis vérifie",
                "de": "[knobel erst selbst am Problem], rate eine Antwort, dann check sie",
                "tr": "[önce problemle kendin uğraş], bir tahminde bulun, sonra kontrol et",
            }},
            {"id": "p2", "x": 596, "after": "p1", "gap": 114, "size": C, "pitch": 43.7, "w": 410, "text": {
                "fr": "[galérer] pour trouver la réponse, c’est en partie ce qui [fait que tu retiens]",
                "de": "[dich durchzubeißen] gehört dazu, damit [das Gelernte hängen bleibt]",
                "tr": "cevap için [kafa yormak], [öğrendiklerinin kalıcı olmasını] sağlayan şeylerden biri",
            }},
            {"id": "p3", "x": 596, "after": "p2", "gap": 87, "size": C, "pitch": 43.5, "w": 410, "text": {
                "fr": "ne délègue pas ta [compréhension] ni ta réflexion, c’est ce qui [garde ton esprit en vie]",
                "de": "gib dein [Verständnis] und dein Denken nicht ab, das [hält dich lebendig]",
                "tr": "[anlamayı] ve düşünme sürecini başkasına bırakma, seni [canlı tutan] şey bu",
            }},
        ],
    },
    {  # 4 — la slide micabo (à la place de « start reading everyday » et de ReadUp)
        "effacer": [(34, 226, 622, 298), (22, 371, 482, 1215), (508, 394, 1014, 1134)],
        "pub": {"box": (32, 381, 471, 1204)},
        "blocks": [
            {"id": "titre", "x": 42, "base": 279, "size": T, "pitch": 69, "w": 1010, "text": {
                "fr": "révise sur [tes propres cours]",
                "de": "lern mit [deinem eigenen Stoff]",
                "tr": "[kendi ders notlarından] çalış",
            }},
            {"id": "p1", "x": 518, "base": 430, "size": C, "pitch": 43.7, "w": 480, "text": {
                "fr": "les vidéos de révision et les résumés [donnent l’impression d’apprendre], mais ça reste [du contenu que tu consommes]",
                "de": "Lernvideos und Zusammenfassungen [fühlen sich nach Lernen an], sind aber [auch nur Content, den du konsumierst]",
                "tr": "ders videoları ve özetler [öğreniyormuşsun gibi hissettirir], ama sonuçta [yine tükettiğin bir içerik]",
            }},
            {"id": "p2", "x": 518, "after": "p1", "gap": 75, "size": C, "pitch": 43.7, "w": 480, "text": {
                "fr": f"moi, je mets mes cours dans l’appli micabo et [je réponds à ses questions]{NB}: c’est moi qui vais chercher la réponse",
                "de": "ich lade meine Unterlagen in die micabo-App und [beantworte ihre Fragen]: die Antwort such ich selbst",
                "tr": "ben ders notlarımı micabo uygulamasına yüklüyorum ve [sorularını cevaplıyorum]: cevabı kendim buluyorum",
            }},
            {"id": "p3", "x": 518, "after": "p2", "gap": 87, "size": C, "pitch": 43.7, "w": 480, "text": {
                "fr": "ça entraîne ton cerveau à [tenir son attention] et à [retenir les détails]",
                "de": "das trainiert dich, [konzentriert zu bleiben] und [Details zu behalten]",
                "tr": "bu da [dikkatini toplamanı] ve [ayrıntıları hatırlamanı] sağlıyor",
            }},
            {"id": "p4", "x": 518, "after": "p3", "gap": 87, "size": C, "pitch": 43.7, "w": 480, "text": {
                "fr": "même quelques minutes par jour suffisent pour [commencer à reconstruire ton attention]",
                "de": "schon ein paar Minuten pro Tag genügen, um [wieder Konzentration aufzubauen]",
                "tr": "günde birkaç dakika bile [dikkatini yeniden toplamaya] başlamak için yeterli",
            }},
        ],
    },
    {  # 5 — ses propres biais
        "effacer": [(34, 226, 722, 298), (38, 366, 822, 414), (38, 412, 456, 458), (36, 504, 402, 640),
                    (40, 716, 414, 896)],
        "blocks": [
            {"id": "titre", "x": 42, "base": 279, "size": T, "pitch": 69, "w": 1010, "text": {
                "fr": "remets en question [tes propres biais]",
                "de": "hinterfrag [deine eigenen Denkmuster]",
                "tr": "[kendi önyargılarını] sorgula",
            }},
            {"id": "p1", "x": 44, "base": 401, "size": C, "pitch": 44, "w": 790, "text": {
                "fr": "ton cerveau adore les preuves qui confirment [ce que tu penses déjà]",
                "de": "dein Gehirn liebt Beweise für das, [was du sowieso schon glaubst]",
                "tr": "beynin, [zaten inandığın şeyi] doğrulayan kanıtlara bayılır",
            }},
            {"id": "p2", "x": 44, "base": 539, "size": C, "pitch": 43.5, "w": 395, "text": {
                "fr": "cherche activement [le meilleur argument contre] ton avis",
                "de": "such aktiv nach [dem stärksten Argument gegen] deine Meinung",
                "tr": "fikrine karşı [en güçlü argümanı] bilerek ara",
            }},
            {"id": "p3", "x": 48, "after": "p2", "gap": 125, "size": C, "pitch": 43.7, "w": 395, "text": {
                "fr": "gagner en intelligence, c’est apprendre à voir [quand ton propre raisonnement a tort]",
                "de": "klüger werden heißt, besser zu merken, [wann dein eigenes Denken falsch liegt]",
                "tr": "daha zeki olmak, [kendi düşüncenin ne zaman yanıldığını] daha iyi fark etmek demektir",
            }},
        ],
    },
    {  # 6 — expliquer à voix haute
        "effacer": [(34, 226, 840, 298), (24, 414, 484, 934)],
        "blocks": [
            {"id": "titre", "x": 42, "base": 279, "size": T, "pitch": 69, "w": 1020, "text": {
                "fr": "explique ce que tu apprends [tout haut]",
                "de": "erklär [laut], was du lernst",
                "tr": "öğrendiklerini [sesli] anlat",
            }},
            {"id": "p1", "x": 36, "base": 451, "size": C, "pitch": 43.5, "w": 440, "text": {
                "fr": "ferme le livre, l’article ou la vidéo, puis explique l’idée [de mémoire]",
                "de": "schließ Buch, Artikel oder Video und erklär die Idee [aus dem Gedächtnis]",
                "tr": "kitabı, makaleyi ya da videoyu kapat ve konuyu [aklından] anlat",
            }},
            {"id": "p2", "x": 36, "after": "p1", "gap": 106, "size": C, "pitch": 43.5, "w": 440, "text": {
                "fr": "dès que ça devient flou ou que tu t’embrouilles, tu as trouvé ta lacune",
                "de": "sobald du ins Schwimmen kommst, hast du deine Lücke gefunden",
                "tr": "lafı dolandırmaya ya da karıştırmaya başladığın an, eksiğini buldun demektir",
            }},
            {"id": "p3", "x": 33, "after": "p2", "gap": 101, "size": C, "pitch": 43.7, "w": 440, "text": {
                "fr": "[enseigner révèle ce que tu as mal compris] plus vite que relire",
                "de": "[Erklären deckt Wissenslücken] schneller auf als erneutes Lesen",
                "tr": "[öğretmek, zayıf anladığın yerleri] tekrar okumaktan çok daha hızlı gösterir",
            }},
        ],
    },
]

HASHTAGS = {
    "fr": "#revisions #methodedetude #concentration #etudiant #apprendre",
    "de": "#lernen #lerntipps #konzentration #studium #abitur",
    "tr": "#dersçalışma #odaklanma #öğrenme #öğrenci #yks",
}

if __name__ == "__main__":
    origine, cap_fr, cap_de, cap_tr, sortie = (Path(a) for a in sys.argv[1:6])
    langues = sys.argv[6].split(",") if len(sys.argv) > 6 else ["fr", "de", "tr"]
    sortie.mkdir(parents=True, exist_ok=True)
    rendre_post(SLIDES, origine, ID, {"fr": str(cap_fr), "de": str(cap_de), "tr": str(cap_tr)},
                None, sortie, langues)
