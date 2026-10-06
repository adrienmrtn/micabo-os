"""White post @amayareading 7685736268617059616 — « 5 signs that you’ve harmed
your brain from scrolling (neuroscience-backed sources at the end) »
(107 600 vues, 7 slides), en FR, DE et TR.

La slide 5 d'origine (« you can’t read a book without getting bored ») vend
ReadUp. Elle devient « tu n’arrives plus à réviser sans décrocher » : vingt
pages de cours font une montagne quand cent tiktoks passent tout seuls ; on
révise alors par petites questions, l’appli micabo fait des flashcards de ses
cours, quelques minutes suffisent pour s’y mettre et l’attention se
réentraîne. Le dernier conseil d'origine (le téléphone dans une autre pièce)
est gardé. La slide 7 (sources) ne traduit que son en-tête : les références
restent telles quelles.

    python3 -I post_7685736268617059616.py <slides_origine/> <cap_fr> <cap_de> <cap_tr> <sortie/> [fr,de,tr]
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from post_lib import rendre_post  # noqa: E402

ID = "7685736268617059616"
NB = " "

SLIDES = [
    {  # 1 — titre
        "effacer": [(88, 240, 834, 392), (88, 928, 870, 986)],
        "blocks": [
            {"id": "titre", "x": 96, "base": 293.5, "size": 63, "pitch": 73, "w": 900, "text": {
                "fr": "5 signes que le scroll\na abîmé ton cerveau",
                "de": "5 Anzeichen, dass Scrollen\ndeinem Gehirn geschadet hat",
                "tr": "kaydırmanın beynine zarar\nverdiğini gösteren 5 işaret",
            }},
            {"id": "sous", "x": 93, "base": 967.5, "size": 42, "pitch": 48, "w": 950, "text": {
                "fr": "(sources en neurosciences à la fin)",
                "de": "(neurowissenschaftliche Quellen am Ende)",
                "tr": "(nörobilime dayalı kaynaklar sonda)",
            }},
        ],
    },
    {  # 2 — tout en vitesse x2
        "effacer": [(34, 216, 706, 366), (34, 400, 960, 551), (34, 588, 458, 980)],
        "blocks": [
            {"id": "titre", "x": 41.5, "base": 270.5, "size": 63, "pitch": 73.5, "w": 1000, "text": {
                "fr": "tu regardes tout\n[en vitesse x2]",
                "de": "du schaust alles\n[in doppeltem Tempo]",
                "tr": "her şeyi\n[2x hızda] izliyorsun",
            }},
            {"id": "p1", "x": 41, "base": 438.5, "size": 42, "pitch": 48.2, "w": 980, "text": {
                "fr": f"une vidéo de 20{NB}minutes qui passe à 10, [ça semble efficace], mais tu apprends à ton cerveau qu’un rythme normal est [trop lent]",
                "de": f"ein 20-Minuten-Video in 10 durchzuziehen [wirkt effizient], aber du bringst dir bei, dass normales Tempo [zu langsam] ist",
                "tr": f"20{NB}dakikalık videoyu 10{NB}dakikada bitirmek [verimli geliyor] ama beynine normal hızın [fazla yavaş] olduğunu öğretiyorsun",
            }},
            {"id": "p2", "x": 41, "base": 627.5, "size": 42, "pitch": 48, "w": 405, "text": {
                "fr": "à force, les cours, la lecture et même [les conversations] t’ennuient [à mourir]",
                "de": "irgendwann fühlen sich Unterricht, Lesen und sogar [Gespräche] [quälend langweilig] an",
                "tr": "zamanla dersler, okumak, hatta [sohbetler] bile [dayanılmaz derecede sıkıcı] geliyor",
            }},
            {"id": "p3", "x": 41, "after": "p2", "gap": 95, "size": 42, "pitch": 48, "w": 405, "text": {
                "fr": f"c’est si urgent que ça, [un tiktok]{NB}?",
                "de": "hast du es so eilig, [ein TikTok] zu schauen?",
                "tr": "[bir tiktok] izlemek için gerçekten bu kadar acelen mi var?",
            }},
        ],
    },
    {  # 3 — fatigué même en journée
        "effacer": [(22, 210, 834, 362), (18, 414, 584, 1000)],
        "blocks": [
            {"id": "titre", "x": 30.5, "base": 263.5, "size": 63, "pitch": 74, "w": 1000, "text": {
                "fr": "tu te sens à plat\n[même en pleine journée]",
                "de": "du bist müde,\n[sogar tagsüber]",
                "tr": "[gün içinde bile]\nyorgun hissediyorsun",
            }},
            {"id": "p1", "x": 27, "base": 451.5, "size": 42, "pitch": 48, "w": 550, "text": {
                "fr": f"tu peux dormir 8{NB}heures et [avoir quand même le cerveau en compote] si ta tête se prend [des stimulations toute la journée]",
                "de": f"du kannst 8{NB}Stunden schlafen und [trotzdem mental erschöpft sein], wenn dein Gehirn [den ganzen Tag mit Reizen] bombardiert wird",
                "tr": f"8{NB}saat uyusan bile, beynin [bütün gün uyaranlarla] bombardımana tutuluyorsa [yine de zihnen tükenmiş] hissedebilirsin",
            }},
            {"id": "p2", "x": 27, "after": "p1", "gap": 95, "size": 42, "pitch": 48, "w": 550, "text": {
                "fr": "le zapping permanent, le scroll et les notifs créent une fatigue de l’attention",
                "de": "ständiges Wechseln, Scrollen und Benachrichtigungen erschöpfen deine Aufmerksamkeit",
                "tr": "sürekli uygulama değiştirmek, kaydırmak ve bildirimler dikkat yorgunluğu yaratıyor",
            }},
            {"id": "p3", "x": 27, "after": "p2", "gap": 96, "size": 42, "pitch": 48, "w": 550, "text": {
                "fr": "du coup, même les tâches simples deviennent [bizarrement épuisantes]",
                "de": "deshalb fühlen sich selbst einfache Aufgaben [seltsam anstrengend] an",
                "tr": "bu yüzden basit işler bile [tuhaf bir şekilde yorucu] gelmeye başlıyor",
            }},
        ],
    },
    {  # 4 — arrêter de scroller
        "effacer": [(32, 208, 852, 356), (32, 424, 532, 912)],
        "blocks": [
            {"id": "titre", "x": 40, "base": 262, "size": 63, "pitch": 73, "w": 1000, "text": {
                "fr": "tu veux arrêter de scroller\n[mais tu n’y arrives pas]",
                "de": "du willst aufhören zu scrollen,\n[schaffst es aber nicht]",
                "tr": "kaydırmayı bırakmak istiyorsun\n[ama yapamıyorsun]",
            }},
            {"id": "p1", "x": 40, "base": 461.5, "size": 42, "pitch": 48.2, "w": 485, "text": {
                "fr": "si tu ouvres tiktok sans même l’avoir décidé, [c’est ça le problème]",
                "de": "wenn du TikTok öffnest, ohne dich überhaupt dafür zu entscheiden, [ist genau das das Problem]",
                "tr": "tiktok’u karar bile vermeden açıp duruyorsan [sorun tam olarak bu]",
            }},
            {"id": "p2", "x": 40, "after": "p1", "gap": 96, "size": 42, "pitch": 48, "w": 485, "text": {
                "fr": f"le fil infini supprime les pauses naturelles, et [tes «{NB}5{NB}minutes{NB}» durent{NB}45]",
                "de": f"endlose Feeds nehmen dir natürliche Haltepunkte, also [werden aus „5{NB}Minuten“ 45]",
                "tr": f"sonsuz akışlar doğal durma noktalarını ortadan kaldırıyor, böylece [“5{NB}dakika” 45’e dönüşüyor]",
            }},
            {"id": "p3", "x": 40, "after": "p2", "gap": 96, "size": 42, "pitch": 48, "w": 485, "text": {
                "fr": "rends le scroll plus compliqué [au lieu de] miser sur ta volonté",
                "de": "mach dir das Scrollen schwerer, [statt] auf Willenskraft zu hoffen",
                "tr": "kaydırmayı zorlaştır, [iradene güvenme]",
            }},
        ],
    },
    {  # 5 — la slide micabo (à la place de « you can’t read a book without getting bored »)
        "effacer": [(26, 200, 848, 348), (26, 376, 966, 480), (24, 484, 401, 1236), (426, 546, 978, 1080)],
        "pub": {"box": (32, 490, 393, 1228)},
        "blocks": [
            {"id": "titre", "x": 32.5, "base": 252.5, "size": 63, "pitch": 73, "w": 1000, "text": {
                "fr": "tu n’arrives plus à réviser\n[sans décrocher]",
                "de": "du kannst nicht mehr lernen,\n[ohne abzuschweifen]",
                "tr": "artık [dikkatin dağılmadan]\nders çalışamıyorsun",
            }},
            {"id": "p1", "x": 33, "base": 414.5, "size": 42, "pitch": 48, "w": 960, "text": {
                "fr": f"si [20{NB}pages] de cours sont une montagne mais que [100{NB}tiktoks] passent tout seuls, c’est [un vrai problème]",
                "de": f"wenn [20{NB}Seiten] Stoff ein Berg sind, aber [100{NB}TikToks] wie nichts durchgehen, ist das [ein echtes Problem]",
                "tr": f"[20{NB}sayfa] ders sana dağ gibi geliyor ama [100{NB}tiktok] su gibi akıp gidiyorsa, bu [ciddi bir sorun]",
            }},
            {"id": "p2", "x": 434.5, "base": 584.5, "size": 42, "pitch": 48, "w": 545, "text": {
                "fr": "c’est parce que toutes ces vidéos courtes [ont abîmé ta capacité d’attention]",
                "de": "das liegt daran, dass all die Kurzvideos [deine Aufmerksamkeitsspanne kaputt gemacht] haben",
                "tr": "çünkü onca kısa video [dikkat süreni zayıflattı]",
            }},
            {"id": "p3", "x": 434.5, "after": "p2", "gap": 96, "size": 42, "pitch": 48, "w": 545, "text": {
                "fr": f"moi je révise par petites questions{NB}: l’appli micabo fait [des flashcards de mes cours], il suffit de quelques minutes et l’attention se réentraîne",
                "de": "ich lerne mit kleinen Fragen: die micabo-App macht [Karteikarten aus meinem Stoff], für den Anfang reichen ein paar Minuten, und die Konzentration kommt zurück",
                "tr": "ben küçük sorularla çalışıyorum: micabo uygulaması [derslerimden bilgi kartları] çıkarıyor, başlamak için birkaç dakika yetiyor ve dikkatim toparlanıyor",
            }},
            {"id": "p4", "x": 434.5, "after": "p3", "gap": 96, "size": 42, "pitch": 48, "w": 545, "text": {
                "fr": f"tu peux aussi laisser ton téléphone dans une autre{NB}pièce",
                "de": "du kannst dein Handy auch in einen anderen Raum legen",
                "tr": "telefonunu başka bir odaya da bırakabilirsin",
            }},
        ],
    },
    {  # 6 — le téléphone dès qu'il ne se passe rien
        "effacer": [(32, 212, 836, 362), (32, 418, 534, 1100)],
        "blocks": [
            {"id": "titre", "x": 40, "base": 266, "size": 63, "pitch": 73, "w": 1000, "text": {
                "fr": "tu prends ton téléphone [à la]\n[seconde] où il ne se passe rien",
                "de": "du greifst zum Handy, [sobald]\nmal nichts passiert",
                "tr": "boş kaldığın [ilk saniyede]\ntelefonuna uzanıyorsun",
            }},
            {"id": "p1", "x": 39.5, "base": 456.5, "size": 42, "pitch": 48, "w": 490, "text": {
                "fr": f"attendre 30{NB}secondes, faire la queue, prendre l’ascenseur{NB}: [il te faut tout de suite de quoi t’occuper]",
                "de": f"30{NB}Sekunden warten, in der Schlange stehen, Aufzug fahren: [du brauchst sofort Input]",
                "tr": f"30{NB}saniye beklemek, sırada durmak, asansörde olmak: [hemen bir şeylere bakman gerekiyor]",
            }},
            {"id": "p2", "x": 40, "after": "p1", "gap": 96, "size": 42, "pitch": 48, "w": 490, "text": {
                "fr": "l’ennui, c’est le moment où ton cerveau peut vagabonder, réfléchir et relier les idées",
                "de": "Langeweile ist der Moment, in dem dein Gehirn abschweifen, nachdenken und Ideen verknüpfen kann",
                "tr": "can sıkıntısı, beynine dalıp gitme, düşünme ve fikirleri birleştirme fırsatı verir",
            }},
            {"id": "p3", "x": 40, "after": "p2", "gap": 96, "size": 42, "pitch": 48, "w": 490, "text": {
                "fr": "[arrête de combler] chaque temps mort",
                "de": "[füll nicht mehr] jeden leeren Moment",
                "tr": "boş anları [doldurmayı bırak]",
            }},
            {"id": "p4", "x": 40, "after": "p3", "gap": 96, "size": 42, "pitch": 48, "w": 490, "text": {
                "fr": "[écoute tes pensées]",
                "de": "[hör deinen Gedanken zu]",
                "tr": "[düşüncelerini dinle]",
            }},
        ],
    },
    {  # 7 — sources : seul l'en-tête se traduit, les références restent telles quelles
        "effacer": [(32, 244, 258, 294)],
        "blocks": [
            {"id": "titre", "x": 36.5, "base": 285.5, "size": 63, "pitch": 73, "w": 1000, "text": {
                "fr": "sources",
                "de": "Quellen",
                "tr": "kaynaklar",
            }},
        ],
    },
]

HASHTAGS = {
    "fr": "#revisions #concentration #etudiant #methodedetude #tempsdecran",
    "de": "#lernen #konzentration #lerntipps #studium #bildschirmzeit",
    "tr": "#dersçalışma #odaklanma #öğrenci #yks #ekransüresi",
}

if __name__ == "__main__":
    origine, cap_fr, cap_de, cap_tr, sortie = (Path(a) for a in sys.argv[1:6])
    langues = sys.argv[6].split(",") if len(sys.argv) > 6 else ["fr", "de", "tr"]
    sortie.mkdir(parents=True, exist_ok=True)
    rendre_post(SLIDES, origine, ID, {"fr": str(cap_fr), "de": str(cap_de), "tr": str(cap_tr)},
                None, sortie, langues)
