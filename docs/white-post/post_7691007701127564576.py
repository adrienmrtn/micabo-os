"""White post @amayareading 7691007701127564576 — « 10/10 hobbies to make you
dangerously disciplined » (796 800 vues), rendu en FR, DE et TR.

La slide 4 d'origine est une publicité ReadUp : elle devient la slide micabo,
avec la capture de l'appli de la langue (`captures`). Les autres slides gardent
leurs photos au pixel près ; seul le texte est réécrit.

Soulignés entre crochets. Brand : « l’appli micabo » (fr), « die micabo-App »
(de), toujours en minuscules. Aucun tiret long.

    python3 -I post_7691007701127564576.py <slides_origine/> <capture_fr.jpg> <capture_de.jpg> <capture_tr.jpg> <sortie/> [fr,de,tr]

`slides_origine/` contient s1.jpg … s6.jpg (le scrape Apify du post, dans
l'ordre). La sortie reçoit <langue>/<n>.jpg, sans aucune métadonnée.
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from rendu import rendre  # noqa: E402
from sans_meta import nettoyer  # noqa: E402

T = {
 "fr": {
  1: ["10/10 hobbies pour avoir une discipline de fer", "(validé par les neurosciences)"],
  2: ["faire du sport [le matin]",
      "ton cortisol est [au plus haut le matin], et ta façon de commencer la journée [donne le ton pour la suite]",
      "faire du sport t’apprend la [gratification différée], dans un monde accro aux [vidéos courtes]",
      "la discipline devient plus facile quand [l’inconfort] fait [partie de la routine]"],
  3: ["apprendre [un instrument difficile]",
      "[impossible de sauter] la phase où tu galères au piano, à la guitare, à la batterie, peu importe",
      "on progresse en [répétant des bases ennuyeuses] jusqu’à ce qu’elles deviennent automatiques",
      "ça t’apprend [la patience, la régularité et la gratification différée] mieux que la plupart des conseils de productivité"],
  4: ["réviser [tous les jours]",
      "tu dis que tu vas [réviser en avance], puis tu finis par [tout apprendre la veille]",
      "[c’était pareil pour moi] avant l’appli micabo\u00a0: elle [transforme mes cours en flashcards] et je révise 10 min par jour",
      "ça construit la mémoire, la régularité, et la capacité à [travailler même sans motivation]"],
  5: ["faire un art martial",
      "on te [corrige sans arrêt], ta technique ratée se voit tout de suite, et tu dois continuer [quand tu n’en peux plus]",
      "les arts martiaux t’apprennent à [rester calme sous pression]",
      "au lieu d’abandonner dès que ça devient inconfortable"],
  6: ["étudier [plus longtemps que prévu]",
      "le plus utile commence souvent quand ton [cerveau veut abandonner]",
      "reste encore 20 à 30 minutes [après] le premier signe d’ennui ou de distraction",
      "tu n’apprends pas juste la matière, tu t’entraînes [à continuer quand la motivation disparaît]"],
 },
 "de": {
  1: ["10/10 Hobbys für gefährlich viel Disziplin", "(neurowissenschaftlich belegt)"],
  2: ["[morgens] Sport machen",
      "dein Cortisol ist [morgens am höchsten], und wie du in den Tag startest, [bestimmt die Stimmung für den Rest]",
      "Sport hilft dir, [Belohnungen aufzuschieben], in einer Welt voller [Kurzvideos]",
      "Disziplin wird leichter, wenn [Unbehagen] zum [Teil der Routine] wird"],
  3: ["ein [schwieriges Instrument] lernen",
      "[es gibt keine Abkürzung] durch die Phase, in der du schlecht bist, ob Klavier, Gitarre oder Schlagzeug",
      "Fortschritt kommt davon, [langweilige Grundlagen zu wiederholen], bis sie endlich automatisch sitzen",
      "es lehrt dich [Geduld, Beständigkeit und Belohnungsaufschub] besser als die meisten Produktivitätstipps"],
  4: ["[jeden Tag] ein bisschen lernen",
      "du willst [diesmal früher anfangen] und paukst dann doch [alles am Abend davor]",
      "[mir ging’s genauso] bis zur micabo-App: sie [macht aus meinen Unterlagen Karteikarten] und ich wiederhole 10 Minuten am Tag",
      "es trainiert Gedächtnis, Beständigkeit und die Fähigkeit, [auch ohne Motivation dranzubleiben]"],
  5: ["eine Kampfkunst trainieren",
      "du wirst [ständig korrigiert], bloßgestellt, wenn deine Technik schlecht ist, und musst weitermachen, [wenn du müde bist]",
      "Kampfsport bringt dir bei, [unter Druck ruhig zu bleiben]",
      "statt aufzugeben, sobald es unangenehm wird"],
  6: ["lernen, [länger als du willst]",
      "der nützliche Teil beginnt meistens, wenn dein [Gehirn aufhören will]",
      "bleib noch 20 bis 30 Minuten dran, [auch wenn] du dich gelangweilt oder abgelenkt fühlst",
      "du lernst nicht nur den Stoff, du trainierst dich, [dranzubleiben, wenn die Motivation verschwindet]"],
 },
 "tr": {
  1: ["seni tehlikeli derecede disiplinli yapacak 10/10 hobi", "(nörobilim onaylı)"],
  2: ["[sabahları] spor yap",
      "kortizol seviyen [sabahları zirvede olur] ve güne nasıl başladığın [günün geri kalanının havasını belirler]",
      "spor yapmak sana [hazzı ertelemeyi] öğretir, hem de [kısa videolarla] dönen bir dünyada",
      "[rahatsızlık] [rutinin bir parçası] olunca disiplin kolaylaşır"],
  3: ["[zor bir enstrüman] öğren",
      "piyano, gitar, davul, hangisi olursa olsun [acemilik dönemini atlayamazsın]",
      "ilerleme, [sıkıcı temelleri] otomatikleşene kadar [tekrar etmekten] gelir",
      "sana [sabrı, istikrarı ve hazzı ertelemeyi] çoğu verimlilik tavsiyesinden daha iyi öğretir"],
  4: ["[her gün] biraz ders çalış",
      "konuları [önceden tekrar edeceğini] söylüyorsun ama sonunda [her şeyi sınavdan önceki gece] çalışıyorsun",
      "[ben de aynıydım], ta ki micabo uygulamasını bulana kadar: [ders notlarımı bilgi kartlarına çeviriyor], ben de günde 10 dakika tekrar ediyorum",
      "hafızanı, düzenini ve [motivasyon yokken bile çalışmaya devam etme] becerini geliştirir"],
  5: ["bir dövüş sporu yap",
      "[sürekli düzeltilirsin], tekniğin kötüyse hemen belli olur ve [yorgunken bile] devam etmek zorundasın",
      "dövüş sporları sana [baskı altında sakin kalmayı] öğretir",
      "işler zorlaşınca hemen bırakmak yerine"],
  6: ["[istediğinden daha uzun] çalış",
      "işin en faydalı kısmı genelde [beynin bırakmak istediğinde] başlar",
      "sıkıldığını ya da dağıldığını hissettikten [sonra] 20-30 dakika daha devam et",
      "sadece konuyu öğrenmiyorsun, kendini [motivasyon kaybolduğunda bile devam etmeye] alıştırıyorsun"],
 },
}


P = 48.5


def specs(lang, captures):
    t = T[lang]
    shot = captures[lang]
    return {
     1: {"photos": [{"box": [90, 414, 837, 965]}], "blocks": [
          {"id": "titre", "x": 94, "base": 280, "size": 63, "pitch": 71, "w": 820, "text": t[1][0]},
          {"id": "sous", "x": 838, "align": "right", "base": 1037, "size": 42, "pitch": P, "w": 990, "text": t[1][1]}]},
     2: {"photos": [{"box": [36, 509, 546, 870]}], "blocks": [
          {"id": "titre", "x": 42, "base": 274, "size": 63, "pitch": 72, "w": 1000, "text": t[2][0]},
          {"id": "p1", "x": 33, "base": 425, "size": 42, "pitch": 48, "w": 990, "text": t[2][1]},
          {"id": "p2", "x": 580, "base": 588, "size": 42, "pitch": P, "w": 440, "text": t[2][2]},
          {"id": "p3", "x": 36, "base": 959, "size": 42, "pitch": 48, "w": 990, "text": t[2][3]}]},
     3: {"photos": [{"box": [503, 463, 1033, 848], "to": [503, 511]}], "blocks": [
          {"id": "titre", "x": 44, "base": 273, "size": 63, "pitch": 72, "w": 1000, "text": t[3][0]},
          {"id": "p1", "x": 42, "base": 418, "size": 42, "pitch": P, "w": 990, "text": t[3][1]},
          {"id": "p2", "x": 37, "base": 638, "size": 42, "pitch": P, "w": 450, "text": t[3][2]},
          {"id": "p3", "x": 38, "base": 963, "size": 42, "pitch": 48, "w": 990, "text": t[3][3]}]},
     4: {"images": [{"path": shot, "crop": [0, 0, 739, 1450], "box": [622, 394, 1007, 1150], "radius": 30,
                     "border": {"w": 1.5, "color": [222, 222, 226]}, "shadow": {"blur": 16, "alpha": 0.10, "dy": 6}}],
         "blocks": [
          {"id": "titre", "x": 44, "base": 275, "size": 63, "pitch": 72, "w": 1000, "text": t[4][0]},
          {"id": "p1", "x": 40, "base": 444, "size": 42, "pitch": P, "w": 560, "text": t[4][1]},
          {"id": "p2", "x": 40, "after": "p1", "gap": 136.5, "size": 42, "pitch": P, "w": 560, "text": t[4][2]},
          {"id": "p3", "x": 39, "after": "p2", "gap": 136.5, "size": 42, "pitch": P, "w": 560, "text": t[4][3]}]},
     5: {"photos": [{"box": [41, 566, 480, 1026]}], "blocks": [
          {"id": "titre", "x": 38, "base": 283, "size": 63, "pitch": 72, "w": 1000, "text": t[5][0]},
          {"id": "p1", "x": 37, "base": 418, "size": 42, "pitch": 47.5, "w": 990, "text": t[5][1]},
          {"id": "p2", "x": 518, "base": 639, "size": 42, "pitch": P, "w": 470, "text": t[5][2]},
          {"id": "p3", "x": 519, "base": 849, "size": 42, "pitch": P, "w": 470, "text": t[5][3]}]},
     6: {"photos": [{"box": [40, 540, 595, 954]}], "blocks": [
          {"id": "titre", "x": 44, "base": 275, "size": 63, "pitch": 72, "w": 1000, "text": t[6][0]},
          {"id": "p1", "x": 48, "base": 432, "size": 42, "pitch": 49, "w": 990, "text": t[6][1]},
          {"id": "p2", "x": 631, "base": 624, "size": 42, "pitch": 48.8, "w": 400, "text": t[6][2]},
          {"id": "p3", "x": 38, "base": 1033, "size": 42, "pitch": 48, "w": 990, "text": t[6][3]}]},
    }

if __name__ == "__main__":
    origine, cap_fr, cap_de, cap_tr, sortie = (Path(a) for a in sys.argv[1:6])
    captures = {"fr": str(cap_fr), "de": str(cap_de), "tr": str(cap_tr)}
    langues = sys.argv[6].split(",") if len(sys.argv) > 6 else ["fr", "de", "tr"]
    for lang in langues:
        (sortie / lang).mkdir(parents=True, exist_ok=True)
        for n, spec in specs(lang, captures).items():
            fichier = sortie / lang / f"{n}.jpg"
            rendre(spec, str(origine / f"s{n}.jpg"), str(fichier))
            fichier.write_bytes(nettoyer(fichier.read_bytes()))
            (sortie / lang / f"{n}.json").write_text(json.dumps(spec, ensure_ascii=False, indent=1))
            print(fichier)
