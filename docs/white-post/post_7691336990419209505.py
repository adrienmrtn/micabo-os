"""White post @amayareading 7691336990419209505 — « 10/10 habits to stop in your
20s (harsh truth) » (20 000 vues, 6 slides), en FR, DE et TR.

La slide 4 d'origine (« scrolling whenever you're bored ») vend ReadUp. Elle
devient « scroller à chaque temps mort » : la file d'attente, le bus, les cinq
minutes entre deux cours, c'est là que partent les 2 à 3 heures par jour ; ces
cinq minutes-là passent sur les flashcards que l'appli micabo tire de ses cours.
La fin d'origine reste (« ton téléphone peut attendre que tu aies fait ce que tu
voulais faire »). La capture micabo remplace la capture ReadUp ; l'original
n'avait pas de carte App Store.

    python3 -I post_7691336990419209505.py <slides_origine/> <cap_fr> <cap_de> <cap_tr> <sortie/> [fr,de,tr]
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from post_lib import rendre_post  # noqa: E402

ID = "7691336990419209505"
NB = " "

SLIDES = [
    {  # 1 — titre (deux lignes : la seconde prend la place de la ligne unique d'origine)
        "effacer": [(67, 230, 928, 306), (640, 980, 872, 1034)],
        "blocks": [
            {"id": "titre", "x": 75, "base": 213, "size": 63, "pitch": 73, "w": 960, "text": {
                "fr": "10/10 habitudes à arrêter\ndans ta vingtaine",
                "de": "10/10 Gewohnheiten, die du\nin deinen 20ern ablegen solltest",
                "tr": "20’li yaşlarında bırakman\ngereken 10/10 alışkanlık",
            }},
            {"id": "sous", "x": 866, "align": "right", "base": 1020, "size": 42, "pitch": 48, "w": 990, "text": {
                "fr": "(la dure vérité)",
                "de": "(harte Wahrheit)",
                "tr": "(acı gerçek)",
            }},
        ],
    },
    {  # 2 — attendre d'être prêt
        "effacer": [(34, 218, 776, 294), (32, 350, 910, 478), (30, 450, 400, 508), (35, 591, 395, 741),
                    (26, 917, 925, 1069)],
        "blocks": [
            {"id": "titre", "x": 42, "base": 273, "size": 63, "pitch": 73, "w": 1000, "text": {
                "fr": "attendre [le bon moment]",
                "de": "warten, bis du [dich bereit fühlst]",
                "tr": "[hazır hissetmeyi] beklemek",
            }},
            # deux lignes pleine largeur, la troisième courte (la photo commence à x = 416)
            {"id": "p1", "x": 41, "base": 390, "size": 42, "pitch": 48.5, "w": 900, "text": {
                "fr": "remettre à plus tard [semble anodin], mais ça devient peu à peu ton [réflexe face à]\n[tout ce qui est dur]",
                "de": "Aufschieben [fühlt sich harmlos an], aber mit der Zeit wird es zu deiner [Standardreaktion auf]\n[alles Schwierige]",
                "tr": "işleri ertelemek o an [zararsız gibi gelir] ama zamanla [zor olan her şeye karşı]\n[ilk tepkin] olur",
            }},
            {"id": "p2", "x": 43, "base": 631, "size": 42, "pitch": 48, "w": 340, "text": {
                "fr": "plus tu évites quelque chose, plus ça te [pèse]",
                "de": "je länger du etwas vermeidest, desto [schwerer] wird es",
                "tr": "bir şeyden ne kadar kaçarsan, o kadar [ağırlaşır]",
            }},
            {"id": "p3", "x": 35, "base": 957, "size": 42, "pitch": 49, "w": 890, "text": {
                "fr": f"commence [sans attendre le bon moment]. [ta vingtaine file vite] quand tout ce qui compte est sans cesse repoussé à «{NB}demain{NB}»",
                "de": "fang an, [bevor du dich bereit fühlst]. [deine 20er sind schnell vorbei], wenn alles Wichtige immer wieder auf „morgen“ verschoben wird",
                "tr": "[hazır hissetmeden] başla. önemli olan her şey sürekli “yarına” ertelenirse [yirmili yaşların çabucak geçip gider]",
            }},
        ],
    },
    {  # 3 — vouloir plaire à tout le monde
        "effacer": [(36, 218, 916, 294), (37, 351, 940, 504), (697, 582, 912, 781), (35, 953, 884, 1057)],
        "blocks": [
            {"id": "titre", "x": 44, "base": 273, "size": 63, "pitch": 73, "w": 1000, "text": {
                "fr": "vouloir plaire à tout le monde",
                "de": "es allen recht machen wollen",
                "tr": "herkesin onayını aramak",
            }},
            {"id": "p1", "x": 47, "base": 391, "size": 42, "pitch": 48, "w": 950, "text": {
                "fr": "si chaque décision doit plaire à tes amis, à ta famille ou [à des inconnus en ligne], tu finis par te construire une vie [qui ne te ressemble même pas]",
                "de": "wenn jede Entscheidung deine Freunde, deine Familie oder [Fremde im Internet] glücklich machen muss, baust du dir ein Leben, [das nicht mal deins ist]",
                "tr": "her kararın arkadaşlarını, aileni ya da [internetteki yabancıları] mutlu etmek zorundaysa, yavaş yavaş [sana ait bile gelmeyen] bir hayat kurarsın",
            }},
            {"id": "p2", "x": 705, "base": 622, "size": 42, "pitch": 48, "w": 330, "text": {
                "fr": "apprends à\n[décevoir]\n[les autres]\n[parfois]",
                "de": "lerne, [Leute]\n[auch mal]\n[zu enttäuschen]",
                "tr": "insanları\n[arada bir]\n[hayal kırıklığına]\n[uğratmayı] öğren",
            }},
            {"id": "p3", "x": 45, "base": 993, "size": 42, "pitch": 48, "w": 890, "text": {
                "fr": "ta vingtaine sert à découvrir [ce que tu veux vraiment], pas à jouer un rôle pour les autres",
                "de": "in deinen 20ern geht es darum, herauszufinden, [was du wirklich willst], und nicht darum, allen etwas vorzuspielen",
                "tr": "yirmili yaşların [gerçekten ne istediğini] bulman için, herkese rol yapman için değil",
            }},
        ],
    },
    {  # 4 — la slide micabo (à la place de « scrolling whenever you're bored »)
        "effacer": [(36, 219, 916, 294), (35, 345, 1016, 496), (464, 520, 992, 1100), (28, 518, 441, 1284)],
        "pub": {"box": (38, 528, 431, 1272)},
        "blocks": [
            {"id": "titre", "x": 44, "base": 274, "size": 63, "pitch": 73, "w": 1000, "text": {
                "fr": "scroller [à chaque temps mort]",
                "de": "[in jeder freien Minute] scrollen",
                "tr": "[her boş anda] telefona sarılmak",
            }},
            {"id": "p1", "x": 45, "base": 385, "size": 42, "pitch": 49, "w": 975, "text": {
                "fr": f"tu peux perdre [2{NB}à{NB}3{NB}heures par jour sans même t’en rendre compte], puis te demander pourquoi tu n’as [jamais le temps de réviser]",
                "de": f"du kannst [2{NB}bis{NB}3{NB}Stunden am Tag verlieren, ohne es zu merken], und dich dann fragen, warum du [keine Zeit zum Lernen] hast",
                "tr": f"[farkına bile varmadan günde 2-3{NB}saat] kaybedip sonra [ders çalışmaya neden vaktin olmadığını] düşünebilirsin",
            }},
            {"id": "p2", "x": 472, "base": 560, "size": 42, "pitch": 48.5, "w": 540, "text": {
                "fr": f"ces heures-là partent [dans les temps morts]{NB}: la file d’attente, le bus, les cinq minutes entre deux cours",
                "de": "die gehen [in den Wartezeiten] drauf: in der Schlange, im Bus, in den fünf Minuten zwischen zwei Stunden",
                "tr": "o saatler [boş anlarda] gidiyor: sıra beklerken, otobüste, iki ders arasındaki beş dakikada",
            }},
            {"id": "p3", "x": 475, "after": "p2", "gap": 97, "size": 42, "pitch": 48, "w": 540, "text": {
                "fr": "moi, ces cinq minutes-là, je les passe dans l’appli micabo, sur [les flashcards qu’elle tire de mes cours]",
                "de": "ich nutze genau diese fünf Minuten in der micabo-App, für [die Karteikarten], [die sie aus meinem Stoff macht]",
                "tr": "ben o beş dakikayı micabo uygulamasında, [ders notlarımdan çıkardığı bilgi kartlarıyla] geçiriyorum",
            }},
            {"id": "p4", "x": 476, "after": "p3", "gap": 138, "size": 42, "pitch": 49, "w": 540, "text": {
                "fr": "ton téléphone peut attendre que tu aies fait [ce que tu voulais faire].",
                "de": "dein Handy kann warten, bis du erledigt hast, [was du dir vorgenommen hast].",
                "tr": "telefonun, [yapmayı planladığın o tek şeyi] bitirmeni bekleyebilir.",
            }},
        ],
    },
    {  # 5 — dire oui à tout
        "effacer": [(36, 219, 712, 294), (35, 374, 562, 526), (35, 604, 562, 805), (35, 877, 562, 1029)],
        "blocks": [
            {"id": "titre", "x": 44, "base": 274, "size": 63, "pitch": 73, "w": 1000, "text": {
                "fr": "dire oui à [tout]",
                "de": "zu [allem] Ja sagen",
                "tr": "[her şeye] evet demek",
            }},
            {"id": "p1", "x": 44, "base": 414, "size": 42, "pitch": 48.5, "w": 510, "text": {
                "fr": "tu acceptes la sortie, le service, le travail en plus. puis tu passes la semaine [à le regretter].",
                "de": "du sagst Ja zum Treffen, zum Gefallen, zur Extraarbeit. und dann [ärgerst du dich] die ganze Woche [darüber].",
                "tr": "plana, iyiliğe, fazladan işe evet dersin. sonra da bütün hafta [içten içe söylenirsin].",
            }},
            {"id": "p2", "x": 45, "after": "p1", "gap": 134, "size": 42, "pitch": 48.5, "w": 510, "text": {
                "fr": f"fais une pause avant de répondre. un simple «{NB}pas cette fois{NB}» t’évite une promesse que tu n’as jamais voulu faire.",
                "de": "halt kurz inne, bevor du antwortest. ein einfaches „diesmal nicht“ erspart dir ein Versprechen, das du nie geben wolltest.",
                "tr": "cevap vermeden önce bir dur. basit bir “bu sefer olmaz”, seni hiç istemediğin bir sözden kurtarır.",
            }},
            {"id": "p3", "x": 56, "after": "p2", "gap": 127.5, "size": 42, "pitch": 48.5, "w": 500, "text": {
                "fr": "chaque oui automatique, c’est [du temps que tu as déjà offert].",
                "de": "jedes automatische Ja ist [Zeit, die du schon verschenkt hast].",
                "tr": "her otomatik evet,\n[çoktan başkasına]\n[verdiğin bir zaman].",
            }},
        ],
    },
    {  # 6 — se comparer aux autres
        "effacer": [(35, 218, 830, 294), (36, 330, 926, 483), (535, 526, 930, 678), (535, 739, 990, 931)],
        "blocks": [
            {"id": "titre", "x": 43, "base": 273, "size": 63, "pitch": 73, "w": 1000, "text": {
                "fr": "te comparer aux autres",
                "de": "dich mit anderen vergleichen",
                "tr": "kendini başkalarıyla kıyaslamak",
            }},
            {"id": "p1", "x": 46, "base": 370, "size": 42, "pitch": 48.5, "w": 900, "text": {
                "fr": "tu compares [ton quotidien] aux meilleurs moments des autres, à leurs plus belles victoires et à leurs [temps forts soigneusement choisis]",
                "de": "du vergleichst [deinen Alltag] mit den besten Momenten, den größten Erfolgen und den [sorgfältig ausgewählten Highlights] anderer",
                "tr": "[sıradan bir gününü] başkalarının en güzel anlarıyla, en büyük başarılarıyla ve [özenle seçilmiş kareleriyle] kıyaslıyorsun",
            }},
            {"id": "p2", "x": 546, "base": 566, "size": 42, "pitch": 48.5, "w": 470, "text": {
                "fr": "tes propres progrès te semblent alors [plus petits qu’ils ne le sont vraiment]",
                "de": "dadurch [wirkt] dein eigener Fortschritt [kleiner, als er ist]",
                "tr": "bu da kendi ilerlemeni\n[olduğundan daha]\n[küçük gösterir]",
            }},
            {"id": "p3", "x": 547, "after": "p2", "gap": 116, "size": 42, "pitch": 48, "w": 470, "text": {
                "fr": "vois les autres comme [la preuve que c’est possible], pas comme une raison de te sentir à la traîne",
                "de": "sieh andere als [Beweis dafür, was möglich ist], nicht als Grund, dich abgehängt zu fühlen",
                "tr": "başkalarını [nelerin mümkün olduğunun kanıtı] olarak gör, geride kaldığını hissetmenin sebebi olarak değil",
            }},
        ],
    },
]

HASHTAGS = {
    "fr": "#revisions #etudiant #flashcards #concentration #methodedetude",
    "de": "#lernen #lerntipps #studium #karteikarten #fokus",
    "tr": "#dersçalışma #öğrenci #bilgikartı #odaklanma #yks",
}

if __name__ == "__main__":
    origine, cap_fr, cap_de, cap_tr, sortie = (Path(a) for a in sys.argv[1:6])
    langues = sys.argv[6].split(",") if len(sys.argv) > 6 else ["fr", "de", "tr"]
    sortie.mkdir(parents=True, exist_ok=True)
    rendre_post(SLIDES, origine, ID, {"fr": str(cap_fr), "de": str(cap_de), "tr": str(cap_tr)},
                None, sortie, langues)
