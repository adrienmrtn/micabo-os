import sys
import numpy as np
from PIL import Image
from collections import deque

def photos(a):
    g = a.mean(axis=2)
    nb = (np.abs(a - 254).max(axis=2) > 18)
    B = 12
    H, W = nb.shape
    gh, gw = H // B, W // B
    dens = nb[:gh*B, :gw*B].reshape(gh, B, gw, B).mean(axis=(1, 3))
    # variance de couleur : les photos ont de la couleur / des gris moyens, le texte est noir pur
    mid = ((g > 40) & (g < 225))[:gh*B, :gw*B].reshape(gh, B, gw, B).mean(axis=(1, 3))
    dense = (dens > 0.85) & (mid > 0.3)
    seen = np.zeros_like(dense)
    boxes = []
    for i in range(gh):
        for j in range(gw):
            if dense[i, j] and not seen[i, j]:
                q = deque([(i, j)]); seen[i, j] = True; cells = []
                while q:
                    y, x = q.popleft(); cells.append((y, x))
                    for dy, dx in ((1,0),(-1,0),(0,1),(0,-1)):
                        ny, nx = y+dy, x+dx
                        if 0 <= ny < gh and 0 <= nx < gw and dense[ny, nx] and not seen[ny, nx]:
                            seen[ny, nx] = True; q.append((ny, nx))
                if len(cells) > 40:
                    ys = [c[0] for c in cells]; xs = [c[1] for c in cells]
                    boxes.append([min(xs)*B, min(ys)*B, (max(xs)+1)*B, (max(ys)+1)*B])
    # raffinage au pixel : étendre tant que la colonne/ligne de bord est non-blanche à > 60 %
    out = []
    for x0, y0, x1, y1 in boxes:
        def col_ok(x, ya, yb): return 0 <= x < W and nb[ya:yb, x].mean() > 0.6
        def row_ok(y, xa, xb): return 0 <= y < H and nb[y, xa:xb].mean() > 0.6
        for _ in range(40):
            ch = False
            if col_ok(x0-1, y0, y1): x0 -= 1; ch = True
            if col_ok(x1, y0, y1): x1 += 1; ch = True
            if row_ok(y0-1, x0, x1): y0 -= 1; ch = True
            if row_ok(y1, x0, x1): y1 += 1; ch = True
            if not ch: break
        # rogner si bord blanc
        while x0 < x1 and not col_ok(x0, y0, y1): x0 += 1
        while x1 > x0 and not col_ok(x1-1, y0, y1): x1 -= 1
        while y0 < y1 and not row_ok(y0, x0, x1): y0 += 1
        while y1 > y0 and not row_ok(y1-1, x0, x1): y1 -= 1
        out.append((x0, y0, x1, y1))
    return out

def lignes(a, boxes):
    g = a.mean(axis=2)
    dark = g < 140
    for x0, y0, x1, y1 in boxes:
        dark[max(0,y0-4):y1+4, max(0,x0-4):x1+4] = False
    H, W = dark.shape
    rows = dark.sum(axis=1)
    bands = []
    y = 0
    while y < H:
        if rows[y] > 0:
            s = y
            while y < H and rows[y] > 0: y += 1
            bands.append((s, y))
        y += 1
    res = []
    for s, e in bands:
        sub = dark[s:e]
        # segments horizontaux séparés par > 60 px de blanc
        cols = sub.any(axis=0)
        xs = np.where(cols)[0]
        segs = []
        st = xs[0]; prev = xs[0]
        for x in xs[1:]:
            if x - prev > 60:
                segs.append((st, prev + 1)); st = x
            prev = x
        segs.append((st, prev + 1))
        for xa, xb in segs:
            blk = dark[s:e, xa:xb]
            # lignes de soulignement : une ligne de pixels avec un run continu long
            ul = []
            for yy in range(blk.shape[0]):
                r = blk[yy]
                # runs
                runs = []
                x = 0
                n = len(r)
                while x < n:
                    if r[x]:
                        st2 = x
                        while x < n and r[x]: x += 1
                        if x - st2 > 45: runs.append((xa + st2, xa + x))
                    else:
                        x += 1
                if runs: ul.append((s + yy, runs))
            res.append({"y": (int(s), int(e)), "x": (int(xa), int(xb)), "ul": [(int(y_), [(int(p), int(q)) for p, q in rr]) for y_, rr in ul]})
    return res

if __name__ == "__main__":
    for f in sys.argv[1:]:
        a = np.array(Image.open(f).convert("RGB")).astype(int)
        b = photos(a)
        print("==", f, "photos", b)
        for l in lignes(a, b):
            print("  ", l["y"], "h", l["y"][1]-l["y"][0], "x", l["x"], "ul", l["ul"][:3])
