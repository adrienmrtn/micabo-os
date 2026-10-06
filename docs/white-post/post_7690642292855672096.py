"""White post @amayareading 7690642292855672096 — « 10/10 niche traits of
highly successful people (science-backed) » (91 400 vues, 6 slides), en FR, DE
et TR.

La slide 4 d'origine (« they read classic books written by the greats ») vend
ReadUp. Elle devient « ils ne recopient pas leurs cours en fiches », dans
l'esprit de la slide « leverage » : recopier donne l'impression de travailler,
eux gardent ce temps pour comprendre et se tester, et l'appli micabo fait les
flashcards à partir des cours. La capture micabo remplace la capture ReadUp, la
carte App Store micabo remplace celle de ReadUp.

La photo de la slide 1 porte un sous-titre anglais incrusté (« i will win i
promise. ») : il fait partie de la photo, on n'y touche pas.

    python3 -I post_7690642292855672096.py <slides_origine/> <cap_fr> <cap_de> <cap_tr> <fiche_app_store> <sortie/> [fr,de,tr]
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from post_lib import banniere_app_store, rendre_post  # noqa: E402

ID = "7690642292855672096"
NB = " "

SLIDES = [
    {  # 1 — titre
        "effacer": [(85, 224, 805, 372), (494, 1152, 818, 1208)],
        "blocks": [
            {"id": "titre", "x": 91, "base": 278, "size": 63, "pitch": 73, "w": 960, "text": {
                "fr": "10/10 traits méconnus des\ngens qui réussissent vraiment",
                "de": "10/10 seltene Eigenschaften\nerfolgreicher Menschen",
                "tr": "çok başarılı insanların\naz bilinen 10/10 özelliği",
            }},
            {"id": "sous", "x": 811, "align": "right", "base": 1194, "size": 42, "pitch": 48, "w": 990, "text": {
                "fr": "(validé par la science)",
                "de": "(wissenschaftlich belegt)",
                "tr": "(bilimle kanıtlanmış)",
            }},
        ],
    },
    {  # 2 — décider vite
        "effacer": [(38, 230, 728, 310), (30, 362, 928, 516), (598, 594, 952, 796), (38, 962, 914, 1116)],
        "blocks": [
            {"id": "titre", "x": 46, "base": 286, "size": 63, "pitch": 73, "w": 1000, "text": {
                "fr": "ils [décident vite]",
                "de": "sie [entscheiden schnell]",
                "tr": "[hızlı karar verirler]",
            }},
            {"id": "p1", "x": 40, "base": 402, "size": 42, "pitch": 48, "w": 900, "text": {
                "fr": "les gens qui réussissent [ne procrastinent pas]. ils [ne demandent pas la permission], ils agissent et [demandent pardon ensuite]",
                "de": "erfolgreiche Menschen [prokrastinieren nicht]. sie [fragen nicht um Erlaubnis], sie handeln und [entschuldigen sich hinterher]",
                "tr": "başarılı insanlar [işleri ertelemez]. [izin istemezler], harekete geçer ve [gerekirse sonra özür dilerler]",
            }},
            {"id": "p2", "x": 607, "base": 634, "size": 42, "pitch": 48, "w": 400, "text": {
                "fr": f"ils ne passent pas 3{NB}semaines à réfléchir à [un choix réversible]",
                "de": f"sie grübeln nicht 3{NB}Wochen lang über [eine Entscheidung, die man rückgängig machen kann]",
                "tr": f"[geri alınabilecek bir karar] için 3{NB}hafta düşünüp durmazlar",
            }},
            {"id": "p3", "x": 47, "base": 1003, "size": 42, "pitch": 48.5, "w": 880, "text": {
                "fr": "si l’enjeu est faible, ils décident, agissent, puis ajustent. [la vitesse compte le plus] quand on peut revenir sur sa décision",
                "de": "wenn wenig auf dem Spiel steht, entscheiden sie, handeln und korrigieren nach. [Tempo zählt am meisten], wenn sich eine Entscheidung später ändern lässt",
                "tr": "risk küçükse karar verir, harekete geçer, sonra düzeltirler. karar sonradan değiştirilebiliyorsa [en önemli şey hızdır]",
            }},
        ],
    },
    {  # 3 — avoir l'air bête
        "effacer": [(50, 232, 850, 384), (50, 420, 1000, 527), (50, 574, 345, 824), (50, 914, 716, 1020)],
        "blocks": [
            {"id": "titre", "x": 60, "base": 288, "size": 63, "pitch": 73, "w": 1000, "text": {
                "fr": "ils n’ont pas peur [d’avoir]\n[l’air bêtes]",
                "de": "sie haben [keine Angst davor],\n[dumm dazustehen]",
                "tr": "[aptal görünmekten]\n[çekinmezler]",
            }},
            {"id": "p1", "x": 59, "base": 460, "size": 42, "pitch": 48, "w": 940, "text": {
                "fr": "ils posent des questions basiques, essaient avant d’être prêts et [admettent quand ils ne savent pas]",
                "de": "sie stellen einfache Fragen, probieren aus, bevor sie bereit sind, und [geben zu, was sie nicht wissen]",
                "tr": "basit sorular sorar, hazır hissetmeden bir şeyler dener ve [bilmediklerinde bunu kabul ederler]",
            }},
            {"id": "p2", "x": 60, "base": 614, "size": 42, "pitch": 48, "w": 300, "text": {
                "fr": "protéger ton\nego rassure,\nmais ça [freine]\n[énormément]\n[tes progrès]",
                "de": "dein Ego zu schützen fühlt sich sicher an, aber es [bremst dein Lernen massiv aus]",
                "tr": "egonu korumak sana güven verir ama [öğrenmeni çok yavaşlatır]",
            }},
            {"id": "p3", "x": 60, "base": 954, "size": 42, "pitch": 48, "w": 940, "text": {
                "fr": "progresser met mal à l’aise, mais [rien ne change si tu ne changes rien]",
                "de": "Wachstum ist unbequem, aber [nichts ändert sich, wenn du nichts änderst]",
                "tr": "gelişmek rahatsız eder ama [hiçbir şeyi değiştirmezsen hiçbir şey değişmez]",
            }},
        ],
    },
    {  # 4 — la slide micabo (à la place de « they read classic books written by the greats »)
        "effacer": [(22, 208, 884, 362), (22, 401, 823, 460), (22, 452, 556, 1112), (570, 461, 1031, 1286),
                    (264, 1196, 560, 1335)],
        "pub": {"box": (578, 469, 1023, 1278), "banniere": (271, 1203, 282)},
        "blocks": [
            {"id": "titre", "x": 32, "base": 264, "size": 63, "pitch": 75, "w": 900, "text": {
                "fr": "ils ne recopient pas leurs\n[cours en fiches]",
                "de": "sie schreiben ihren Stoff\n[nicht auf Karteikarten ab]",
                "tr": "ders notlarını saatlerce\n[temize çekmezler]",
            }},
            {"id": "p1", "x": 31, "base": 441, "size": 42, "pitch": 48, "w": 800, "text": {
                "fr": "ils savent que tout recopier [donne juste]\n[l’impression de travailler]",
                "de": "sie wissen, dass Abschreiben [sich nur nach]\n[Lernen anfühlt]",
                "tr": "bilirler ki uzun uzun yazıp çizmek [sadece]\n[çalışıyormuş gibi hissettirir]",
            }},
            {"id": "p2", "x": 31, "base": 566, "size": 42, "pitch": 48, "w": 515, "text": {
                "fr": "à la place, ils gardent ce temps pour [comprendre] et [se tester]",
                "de": "sie nutzen die Zeit lieber, um [den Stoff zu verstehen] und [sich abzufragen]",
                "tr": "onun yerine [konuyu anlamaya] ve [kendilerini test etmeye] vakit ayırırlar",
            }},
            {"id": "p3", "x": 31, "after": "p2", "gap": 96, "size": 42, "pitch": 48, "w": 515, "text": {
                "fr": "une réponse retrouvée de tête leur apprend plus qu’une soirée à [surligner] et [décorer des fiches]",
                "de": "eine Antwort aus dem Kopf bringt ihnen mehr als ein Abend voller [Textmarker] und [Schönschrift]",
                "tr": "akıldan bulunan bir cevap, onlara bütün bir akşam [renkli kalemlerle yazmaktan] daha çok şey öğretir",
            }},
            {"id": "p4", "x": 31, "after": "p3", "gap": 96, "size": 42, "pitch": 48, "w": 515, "text": {
                "fr": f"moi, c’est l’appli micabo qui fait mes flashcards à partir de mes cours{NB}: [je n’ai plus qu’à me tester]",
                "de": "meine Karteikarten macht die micabo-App aus meinen Unterlagen, ich muss [mich nur noch abfragen]",
                "tr": "bilgi kartlarımı ders notlarımdan micabo uygulaması hazırlıyor, [bana kendimi test etmek kalıyor]",
            }},
        ],
    },
    {  # 5 — longues périodes sans récompense
        "effacer": [(20, 196, 862, 276), (20, 270, 310, 346), (22, 426, 560, 628), (22, 667, 560, 818),
                    (22, 886, 590, 1038)],
        "blocks": [
            {"id": "titre", "x": 29, "base": 251, "size": 63, "pitch": 73, "w": 900, "text": {
                "fr": "ils tiennent [de longs mois]\n[sans récompense]",
                "de": "sie ertragen [lange Phasen]\n[ohne Belohnung]",
                "tr": "[uzun süre ödülsüz]\n[kalmaya] katlanırlar",
            }},
            {"id": "p1", "x": 32, "base": 466, "size": 42, "pitch": 48, "w": 540, "text": {
                "fr": "ils continuent à travailler quand [personne ne regarde], quand rien ne fait le buzz et que les résultats [ne paient pas de mine]",
                "de": "sie arbeiten weiter, wenn [niemand zusieht], nichts viral geht und die Ergebnisse noch [unscheinbar] aussehen",
                "tr": "[kimse izlemezken], hiçbir şey viral olmazken ve sonuçlar hâlâ [sönük] görünürken çalışmaya devam edebilirler",
            }},
            {"id": "p2", "x": 33, "after": "p1", "gap": 97, "size": 42, "pitch": 47.5, "w": 540, "text": {
                "fr": "la plupart des gens ont besoin de preuves constantes que ça marche",
                "de": "die meisten brauchen ständig Beweise, dass etwas wirkt",
                "tr": "çoğu insan, bir şeyin işe yaradığını sürekli görmek ister",
            }},
            {"id": "p3", "x": 32, "after": "p2", "gap": 124, "size": 42, "pitch": 48, "w": 540, "text": {
                "fr": "les gens qui réussissent savent [rester réguliers assez longtemps] pour que ça finisse par payer.",
                "de": "erfolgreiche Menschen [bleiben lange genug dran], bis es sich auszahlt.",
                "tr": "başarılı insanlar, karşılığını alana kadar [yeterince uzun süre istikrarlı kalabilir].",
            }},
        ],
    },
    {  # 6 — l'effet de levier
        "effacer": [(24, 200, 755, 276), (24, 363, 508, 565), (24, 603, 508, 755), (24, 795, 510, 950)],
        "blocks": [
            {"id": "titre", "x": 33, "base": 255, "size": 63, "pitch": 73, "w": 1000, "text": {
                "fr": "ils sont obsédés par [l’effet de levier]",
                "de": "sie sind besessen von [Hebelwirkung]",
                "tr": "[kaldıraç etkisine] kafayı takarlar",
            }},
            {"id": "p1", "x": 32, "base": 403, "size": 42, "pitch": 48, "w": 460, "text": {
                "fr": "ils cherchent sans cesse comment faire pour qu’[une heure de travail en rapporte plus d’une]",
                "de": "sie suchen ständig nach Wegen, damit [eine Stunde Arbeit mehr als eine Stunde Wert] schafft",
                "tr": "[bir saatlik emeğin bir saatten fazla değer] üretmesinin yollarını sürekli ararlar",
            }},
            {"id": "p2", "x": 33, "after": "p1", "gap": 96, "size": 42, "pitch": 48, "w": 460, "text": {
                "fr": "logiciels, systèmes,\ncontenu, capital,\nautomatisation, équipes",
                "de": "Software, Systeme,\nContent, Kapital,\nAutomatisierung, Teams",
                "tr": "yazılım, sistemler,\niçerik, sermaye,\notomasyon, ekipler",
            }},
            {"id": "p3", "x": 32, "after": "p2", "gap": 96, "size": 42, "pitch": 48, "w": 460, "text": {
                "fr": "ils n’essaient pas juste de bosser plus dur, [ils veulent que leurs efforts se démultiplient]",
                "de": "sie versuchen nicht nur, härter zu arbeiten, [sie wollen, dass sich ihr Einsatz vervielfacht]",
                "tr": "sadece daha çok çalışmaya uğraşmazlar, [emeklerinin katlanarak karşılık vermesini isterler]",
            }},
        ],
    },
]

HASHTAGS = {
    "fr": "#revisions #methodedetude #etudiant #flashcards #examens",
    "de": "#lernen #lerntipps #studium #karteikarten #prüfungen",
    "tr": "#dersçalışma #öğrenci #bilgikartı #sınav #yks",
}

if __name__ == "__main__":
    origine, cap_fr, cap_de, cap_tr, fiche, sortie = (Path(a) for a in sys.argv[1:7])
    langues = sys.argv[7].split(",") if len(sys.argv) > 7 else ["fr", "de", "tr"]
    sortie.mkdir(parents=True, exist_ok=True)
    banniere = banniere_app_store(str(fiche), str(sortie / "banniere.jpg"))
    rendre_post(SLIDES, origine, ID, {"fr": str(cap_fr), "de": str(cap_de), "tr": str(cap_tr)},
                banniere, sortie, langues)
