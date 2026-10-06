"""Retire toutes les métadonnées d'un JPEG : segments APP0–APP15 (sauf APP14
Adobe, paramètre de décodage) et COM. Les données image ne sont pas touchées."""
import sys

def nettoyer(b: bytes) -> bytes:
    assert b[:2] == b"\xff\xd8", "pas un JPEG"
    out = bytearray(b[:2])
    i = 2
    while i < len(b):
        assert b[i] == 0xFF, f"marqueur attendu en {i}"
        while b[i] == 0xFF:
            i += 1
        m = b[i]; i += 1
        if m == 0xDA:  # SOS : le reste est l'image
            out += bytes([0xFF, m]) + b[i:]
            return bytes(out)
        if m in (0xD8, 0x01) or 0xD0 <= m <= 0xD7:
            out += bytes([0xFF, m]); continue
        n = (b[i] << 8) | b[i + 1]
        seg = b[i:i + n]
        i += n
        if (0xE0 <= m <= 0xEF and m != 0xEE) or m == 0xFE:
            continue
        out += bytes([0xFF, m]) + seg
    return bytes(out)

def marqueurs(b: bytes) -> list[str]:
    r, i = [], 2
    while i < len(b) and b[i] == 0xFF:
        m = b[i + 1]
        if m == 0xDA:
            r.append("SOS"); break
        n = (b[i + 2] << 8) | b[i + 3]
        r.append(hex(m)); i += 2 + n
    return r

if __name__ == "__main__":
    for f in sys.argv[1:]:
        b = open(f, "rb").read()
        c = nettoyer(b)
        open(f, "wb").write(c)
        print(f, len(b), "→", len(c), marqueurs(c))
