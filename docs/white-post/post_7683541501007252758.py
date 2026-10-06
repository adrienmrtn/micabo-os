"""White post @amayareading 7683541501007252758 — « 10/10 habits to become
smart again (science-backed sources) » (58 100 vues, 6 slides), en FR, DE et TR.

Même série que 7689918962905124129 : le titre change (« te remettre à
réfléchir », « wieder klar zu denken », « yeniden net düşünmek ») pour qu'un
même compte ne publie pas deux fois le même titre.

La slide 5 d'origine (« read CLASSIC books », la statistique « 6 minutes de
lecture réduisent le stress de 68 % », la page de livre et la carte App Store
ReadUp) devient « révise AVANT d’oublier » : la courbe de l'oubli. Sans le
revoir, un cours s'efface en quelques jours ; on le revoit un peu tant qu'on
s'en souvient, et micabo fait des flashcards de ses cours, reprises quelques
minutes par jour. La statistique de la pub disparaît, aucune n'est inventée.

    python3 -I post_7683541501007252758.py <slides_origine/> <cap_fr> <cap_de> <cap_tr> <fiche_app_store> <sortie/> [fr,de,tr]
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from post_lib import banniere_app_store, rendre_post  # noqa: E402

ID = "7683541501007252758"
NB = " "

SLIDES = [
    {  # 1 — titre
        "effacer": [(106, 252, 760, 404), (326, 931, 808, 985)],
        "blocks": [
            {"id": "titre", "x": 115, "base": 309, "size": 63, "pitch": 73, "w": 900, "text": {
                "fr": "10/10 habitudes pour te\nremettre à réfléchir",
                "de": "10/10 Gewohnheiten, um wieder\nklar zu denken",
                "tr": "yeniden net düşünmek için\n10/10 alışkanlık",
            }},
            {"id": "sous", "x": 799, "align": "right", "base": 968, "size": 42, "pitch": 48, "w": 990, "text": {
                "fr": "(sources scientifiques à l’appui)",
                "de": "(mit wissenschaftlichen Quellen)",
                "tr": "(bilimsel kaynaklarla)",
            }},
        ],
    },
    {  # 2 — l'IA pour penser, pas à ta place
        "effacer": [(48, 280, 712, 428), (432, 497, 968, 1032)],
        "blocks": [
            {"id": "titre", "x": 58, "base": 334, "size": 63, "pitch": 75, "w": 1000, "text": {
                "fr": "utilise l’IA pour t’aider à penser,\n[pas pour penser à ta place]",
                "de": "nutz KI als Denkhilfe,\n[nicht als Ersatz]",
                "tr": "yapay zekâ sana yardım etsin,\n[senin yerine düşünmesin]",
            }},
            {"id": "p1", "x": 439, "base": 536, "size": 42, "pitch": 48, "w": 525, "text": {
                "fr": "laisser l’IA faire tout ton travail, ça [te ramollit vraiment le cerveau]",
                "de": "wenn KI deine ganze Arbeit erledigt, [verkümmert dein Gehirn] wirklich",
                "tr": "bütün işini yapay zekâya yaptırmak, [beynini ciddi şekilde çürütüyor]",
            }},
            {"id": "p2", "x": 439, "after": "p1", "gap": 96, "size": 42, "pitch": 48, "w": 525, "text": {
                "fr": "une étude de 2025 a montré que plus on fait confiance à l’IA, [moins on dit exercer son esprit critique]",
                "de": "eine Studie von 2025 zeigt: je mehr Menschen der KI vertrauten, [desto weniger kritisch dachten sie] nach eigenen Angaben",
                "tr": "2025’te yapılan bir araştırmada yapay zekâya daha çok güvenen kişiler [daha az eleştirel düşündüklerini] söyledi",
            }},
            {"id": "p3", "x": 439, "after": "p2", "gap": 96, "size": 42, "pitch": 48, "w": 525, "text": {
                "fr": "utilise l’IA pour questionner ton raisonnement, pas pour le sous-traiter",
                "de": "nutz KI, um dein Denken zu hinterfragen, und nicht, um es ihr zu überlassen",
                "tr": "yapay zekâyı düşüncelerini sorgulamak için kullan, düşünmeyi ona bırakmak için değil",
            }},
        ],
    },
    {  # 3 — pas de téléphone à table
        "effacer": [(40, 252, 748, 405), (38, 545, 562, 978)],
        "blocks": [
            {"id": "titre", "x": 47, "base": 306, "size": 63, "pitch": 75, "w": 1000, "text": {
                "fr": "lâche ton téléphone\nquand tu manges",
                "de": "hör auf, beim Essen\nam Handy zu sein",
                "tr": "yemek yerken\ntelefona bakmayı bırak",
            }},
            {"id": "p1", "x": 46, "base": 584, "size": 42, "pitch": 48, "w": 512, "text": {
                "fr": "sortir ton téléphone à chaque repas apprend à ton cerveau qu’il lui faut de la stimulation au moindre moment calme",
                "de": "wenn du bei jedem Essen am Handy bist, lernt dein Gehirn, dass jeder ruhige Moment Reize braucht",
                "tr": "her yemekte telefona bakarsan beynin, her sessiz anın bir uyarana ihtiyacı olduğunu öğrenir",
            }},
            {"id": "p2", "x": 46, "after": "p1", "gap": 137, "size": 42, "pitch": 48, "w": 512, "text": {
                "fr": f"donne à ton cerveau 20{NB}minutes où rien ne se dispute ton attention",
                "de": f"gönn deinem Gehirn 20{NB}Minuten, in denen dich nichts ablenkt",
                "tr": f"beynine, hiçbir şeyin dikkatini çalmaya uğraşmadığı 20{NB}dakika ver",
            }},
        ],
    },
    {  # 4 — marcher sans rien écouter
        "effacer": [(28, 224, 590, 372), (28, 412, 494, 557), (474, 544, 978, 934)],
        "blocks": [
            {"id": "titre", "x": 35, "base": 278, "size": 63, "pitch": 73, "w": 1000, "text": {
                "fr": "va marcher sans rien\ndans les oreilles",
                "de": "geh spazieren,\nohne etwas zu hören",
                "tr": "hiçbir şey dinlemeden\nyürüyüşe çık",
            }},
            {"id": "p1", "x": 34, "base": 450, "size": 42, "pitch": 48, "w": 990, "text": {
                "fr": "pas besoin d’un podcast ou de\nmusique chaque fois que tu\nsors de chez toi",
                "de": "du brauchst nicht jedes Mal\neinen Podcast oder Musik,\nwenn du rausgehst",
                "tr": "evden her çıktığında\npodcast ya da müzik\ndinlemen gerekmiyor",
            }},
            {"id": "p2", "x": 485, "base": 582, "size": 42, "pitch": 48, "w": 501, "text": {
                "fr": f"une étude de Stanford a montré que la marche augmentait la créativité de 60{NB}% en moyenne",
                "de": f"laut einer Stanford-Studie macht Gehen im Schnitt 60{NB}% kreativer",
                "tr": "Stanford’da yapılan bir araştırmaya göre yürümek, insanların yaratıcılığını ortalama %60 artırıyor",
            }},
            {"id": "p3", "x": 485, "after": "p2", "gap": 97, "size": 42, "pitch": 48, "w": 501, "text": {
                "fr": "parfois, [le plus intelligent à écouter, ce sont tes propres pensées]",
                "de": "manchmal gibt es [nichts Klügeres zu hören als deine eigenen Gedanken]",
                "tr": "bazen [dinleyebileceğin en akıllı ses kendi iç sesindir]",
            }},
        ],
    },
    {  # 5 — la slide micabo (à la place de « read CLASSIC books » et de ReadUp)
        "effacer": [(28, 238, 606, 304), (24, 360, 590, 800), (596, 280, 948, 966), (44, 820, 468, 1012)],
        "pub": {"box": (604, 334, 938, 992), "banniere": (50, 878, 380)},
        "blocks": [
            {"id": "titre", "x": 39, "base": 293, "size": 63, "pitch": 75, "w": 1020, "text": {
                "fr": "révise AVANT d’oublier",
                "de": "wiederhol, BEVOR du vergisst",
                "tr": "unutmadan ÖNCE tekrar et",
            }},
            {"id": "p1", "x": 32, "base": 399, "size": 42, "pitch": 48.5, "w": 550, "text": {
                "fr": f"un cours que tu ne revois pas [s’efface en quelques jours]{NB}: c’est la courbe de l’oubli",
                "de": "was du nicht wiederholst, ist [nach ein paar Tagen weg]: das ist die Vergessenskurve",
                "tr": "tekrar etmediğin bir ders [birkaç günde aklından silinir]: buna unutma eğrisi denir",
            }},
            {"id": "p2", "x": 32, "after": "p1", "gap": 95, "size": 42, "pitch": 48.5, "w": 550, "text": {
                "fr": "le truc, c’est de le revoir un peu tant que tu t’en souviens. moi, l’appli micabo fait des flashcards de mes cours et je les reprends quelques minutes par jour",
                "de": "der Trick: kurz auffrischen, solange es noch sitzt. die micabo-App macht mir Karteikarten aus meinem Stoff, und ich geh sie täglich ein paar Minuten durch",
                "tr": "püf noktası, konuyu hâlâ hatırlarken biraz gözden geçirmek. micabo uygulaması derslerimden bilgi kartları yapıyor, ben de her gün birkaç dakika onlara çalışıyorum",
            }},
        ],
    },
    {  # 6 — couper les notifications
        "effacer": [(104, 265, 738, 410), (466, 517, 866, 900)],
        "blocks": [
            {"id": "titre", "x": 110, "base": 318, "size": 63, "pitch": 75, "w": 960, "text": {
                "fr": "coupe toutes les notifications\nde ton téléphone",
                "de": "schalt alle Benachrichtigungen\nauf deinem Handy aus",
                "tr": "telefonundaki tüm\nbildirimleri kapat",
            }},
            {"id": "p1", "x": 474, "base": 555, "size": 42, "pitch": 48, "w": 440, "text": {
                "fr": "je n’ai pas de notifications pour chaque petite chose dans chaque appli,",
                "de": "ich lass mich nicht bei jeder Kleinigkeit in jeder App benachrichtigen,",
                "tr": "her uygulamadaki her ufak şey için bildirimim açık değil,",
            }},
            {"id": "p2", "x": 474, "after": "p1", "gap": 97, "size": 42, "pitch": 48, "w": 440, "text": {
                "fr": "pas besoin de répondre tout de suite, c’est ok",
                "de": "du musst nicht sofort antworten, das ist okay",
                "tr": "hemen cevap vermen gerekmiyor, sorun değil",
            }},
        ],
    },
]

HASHTAGS = {
    "fr": "#revisions #methodedetude #memoire #etudiant #apprendre",
    "de": "#lernen #lerntipps #gedächtnis #studium #abitur",
    "tr": "#dersçalışma #hafıza #öğrenme #öğrenci #yks",
}

if __name__ == "__main__":
    origine, cap_fr, cap_de, cap_tr, fiche, sortie = (Path(a) for a in sys.argv[1:7])
    langues = sys.argv[7].split(",") if len(sys.argv) > 7 else ["fr", "de", "tr"]
    sortie.mkdir(parents=True, exist_ok=True)
    banniere = banniere_app_store(str(fiche), str(sortie / "banniere.jpg"))
    rendre_post(SLIDES, origine, ID, {"fr": str(cap_fr), "de": str(cap_de), "tr": str(cap_tr)},
                banniere, sortie, langues)
