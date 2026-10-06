"""Capture micabo en turc, construite sur la capture FR : chaque texte est
effacé sur son fond exact puis réécrit dans la même police (Outfit / DM Sans),
la même couleur et le même alignement."""
import sys
from PIL import Image, ImageDraw, ImageFont
SRC, F, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
SS = 4
def police(nom, poids, taille):
    base = f"{F}/{nom}/package/files/{nom}-%s-{poids}-normal.woff"
    return (ImageFont.truetype(base % "latin", taille * SS), ImageFont.truetype(base % "latin-ext", taille * SS))
def latin(ch):
    o = ord(ch)
    return o <= 0xFF or o == 0x131
def largeur(p, txt, tracking=0.0):
    return sum(( (p[0] if latin(c) else p[1]).getlength(c) ) for c in txt) / SS + tracking * (len(txt) - 1)
im = Image.open(SRC).convert("RGB")
W, H = im.size
calque = Image.new("RGBA", (W * SS, H * SS), (0, 0, 0, 0))
d = ImageDraw.Draw(calque)
dsrc = ImageDraw.Draw(im)
def ecrire(txt, p, couleur, x=None, cx=None, base=None, tracking=0.0):
    w = largeur(p, txt, tracking)
    if cx is not None:
        x = cx - w / 2
    cur = x * SS
    for c in txt:
        f = p[0] if latin(c) else p[1]
        d.text((cur, base * SS), c, font=f, fill=tuple(couleur) + (255,), anchor="ls")
        cur += f.getlength(c) + tracking * SS
def effacer(box, fond, pad=3):
    x0, y0, x1, y1 = box
    dsrc.rectangle([x0 - pad, y0 - pad, x1 + pad, y1 + pad], fill=tuple(fond))

O7 = police("outfit", 700, 31.5); O6 = police("outfit", 600, 26); O6s = police("outfit", 600, 21)
O5 = police("outfit", 500, 20.5); O5b = police("outfit", 500, 24); D5 = police("dm-sans", 500, 27)
D4 = police("dm-sans", 400, 26.5); OC = police("outfit", 700, 20)

# lignes de base : bas de l'encre des glyphes sans jambage, mesurés sur la capture FR
elts = [
 # (boîte à effacer, fond, texte, police, couleur, mode, ancrage, base, tracking)
 ((88,294,197,315), (254,255,255), "CEVAP", OC, (84,63,184), "g", 88, 315, 2.6),
 ((88,354,521,387), (254,254,254), "Enerjinin birimi nedir?", O7, (9,9,11), "g", 88, 380, 0),
 ((174,472,265,493), (255,255,255), "Watt", D5, (154,154,156), "g", 174, 493, 0),
 ((174,569,290,597), (223,245,232), "Joule", D5, (1,13,6), "g", 174, 591, 0),
 ((174,669,302,690), (255,255,255), "Newton", D5, (154,154,157), "g", 174, 690, 0),
 ((174,768,256,789), (255,255,255), "Volt", D5, (154,153,157), "g", 174, 789, 0),
 ((89,857,623,884), (253,253,253), "Joule (J). Watt ise bir güç birimidir,", D4, (65,65,68), "g", 89, 878, 0),
 ((88,894,554,921), (254,254,254), "yani saniye başına düşen enerji.", D4, (66,66,68), "g", 88, 915, 0),
 ((250,1155,489,1175), (254,254,254), "Nasıl cevapladın?", O5, (154,154,158), "c", 369.5, 1170, 0),
 ((152,1224,246,1251), (253,233,226), "Tekrar", O6, (155,83,64), "c", 199, 1251, 0),
 ((175,1267,224,1282), (253,233,226), "1 dk", O6s, (154,84,68), "c", 199.5, 1282, 0),
 ((495,1231,585,1251), (253,242,214), "Zor", O6, (121,92,20), "c", 540, 1251, 0),
 ((514,1267,565,1282), (253,242,214), "6 dk", O6s, (115,93,26), "c", 539.5, 1282, 0),
 ((154,1354,245,1374), (223,245,232), "Doğru", O6, (46,107,80), "c", 199.5, 1374, 0),
 ((169,1389,230,1405), (223,245,232), "10 dk", O6s, (49,105,79), "c", 199.5, 1405, 0),
 ((506,1353,574,1373), (228,237,252), "Kolay", O6, (59,101,164), "c", 540, 1373, 0),
 ((529,1389,549,1409), (228,237,252), "4 g", O6s, (64,99,157), "c", 539, 1405, 0),
 ((223,1465,314,1484), (255,255,255), "Düzenle", O5b, (154,153,158), "g", 223, 1484, 0),
 ((393,1465,549,1484), (255,255,255), "Kenara koy", O5b, (153,152,157), "g", 393, 1484, 0),
]
for box, fond, txt, p, coul, mode, anc, base, tr in elts:
    effacer(box, fond)
for box, fond, txt, p, coul, mode, anc, base, tr in elts:
    if mode == "c":
        ecrire(txt, p, coul, cx=anc, base=base, tracking=tr)
    else:
        ecrire(txt, p, coul, x=anc, base=base, tracking=tr)
calque = calque.resize((W, H), Image.BOX)
im.paste(calque, (0, 0), calque)
im.save(OUT, quality=95, subsampling=0)
print(OUT)
