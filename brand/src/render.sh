#!/bin/bash
# Re-exports every logo file from logo.html using Google Chrome (headless).
# Usage: bash brand/src/render.sh   (needs internet for the Google Font)
set -e
cd "$(dirname "$0")/.."
SRC="file://$(pwd)/src/logo.html"
SRC="${SRC// /%20}"
CH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
PROFILE="$(mktemp -d)"

shot() { # out  w  h  scale  query
  "$CH" --headless=new --disable-gpu --hide-scrollbars --no-first-run --no-default-browser-check \
    --user-data-dir="$PROFILE" --default-background-color=00000000 \
    --force-device-scale-factor="$4" --window-size="$2,$3" --virtual-time-budget=8000 \
    --screenshot="$1" "$SRC?$5" >/dev/null 2>&1
  echo "  $1"
}

echo "Rendering logos..."
shot logo-primary-on-light.png      840 560 2.5 "v=primary&c=ink"
shot logo-primary-on-dark.png       840 560 2.5 "v=primary&c=light"
shot logo-horizontal-on-light.png   860 180 3   "v=horizontal&c=ink"
shot logo-horizontal-on-dark.png    860 180 3   "v=horizontal&c=light"
shot monogram-on-light.png          600 600 2   "v=monogram&c=ink"
shot monogram-on-dark.png           600 600 2   "v=monogram&c=light"
shot instagram-profile.png          1080 1080 1 "v=square&c=ink&bg=blush"
shot instagram-profile-dark.png     1080 1080 1 "v=square&c=light&bg=ink"
shot favicon.png                    512 512 1   "v=monogram&c=ink"
shot apple-touch-icon.png           600 600 1   "v=square&c=ink&bg=ivory"
sips -Z 180 apple-touch-icon.png >/dev/null   # Chrome can't render tiny windows, so shrink afterwards
shot og-image.png                   1200 630 1  "v=og&c=ink&bg=blush&tag=1"   # link preview on WhatsApp/Instagram

# Vector PDF of the primary logo (for printers: stickers, boxes, tags)
"$CH" --headless=new --disable-gpu --no-first-run --user-data-dir="$PROFILE" --no-pdf-header-footer \
  --virtual-time-budget=8000 --print-to-pdf=logo-primary-print.pdf "$SRC?v=primary&c=ink" >/dev/null 2>&1
echo "  logo-primary-print.pdf"
rm -rf "$PROFILE"
