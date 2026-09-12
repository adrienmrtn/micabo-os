#!/usr/bin/env bash
# Télécharge les polices libres utilisées par le kit dans fonts/.
# Besoin de npm (polices Google via fontsource) et, pour les serif gras,
# du paquet système texlive-fonts-extra (TeX Gyre).
set -e
mkdir -p fonts && cd fonts

fetch () {  # fetch <paquet-fontsource> <graisses...>
  local pkg=$1; shift
  npm pack "@fontsource/$pkg" >/dev/null 2>&1
  tar xzf fontsource-$pkg-*.tgz
  for w in "$@"; do
    for f in package/files/$pkg-latin-$w-normal.woff package/files/$pkg-latin-$w-italic.woff; do
      [ -f "$f" ] || continue
      python3 - "$f" <<'PY'
import sys, os
from fontTools.ttLib import TTFont
src = sys.argv[1]
f = TTFont(src); f.flavor = None
name = os.path.basename(src).replace(".woff", ".ttf")
f.save(name)
print("  ", name)
PY
    done
  done
  rm -rf package fontsource-$pkg-*.tgz
}

echo "TikTok Sans"        ; fetch tiktok-sans 500 600 700
echo "Figtree"            ; fetch figtree 500 600 700
echo "Mulish"             ; fetch mulish 600 700
echo "Playfair Display"   ; fetch playfair-display 400 500
echo "Bodoni Moda"        ; fetch bodoni-moda 400

# Serif gras : clones libres de Bookman et Century Schoolbook
for f in /usr/share/texmf/fonts/opentype/public/tex-gyre/texgyrebonum-bold.otf \
         /usr/share/texmf/fonts/opentype/public/tex-gyre/texgyrebonum-italic.otf \
         /usr/share/texmf/fonts/opentype/public/tex-gyre/texgyreschola-bold.otf; do
  [ -f "$f" ] && cp "$f" . && echo "   $(basename $f)"
done
[ -f /usr/share/fonts/truetype/dejavu/DejaVuSans.ttf ] && cp /usr/share/fonts/truetype/dejavu/DejaVuSans.ttf .

# noms courts pour TikTok Sans
for w in 500 600 700; do
  [ -f tiktok-sans-latin-$w-normal.ttf ] && cp tiktok-sans-latin-$w-normal.ttf tts$w.ttf
done
echo "polices prêtes dans fonts/"
