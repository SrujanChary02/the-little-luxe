#!/bin/bash
# Re-exports the Instagram posts from posts.html using Google Chrome (headless).
# Usage: bash brand/src/render-posts.sh   (needs internet for the Google Fonts)
set -e
cd "$(dirname "$0")/.."
SRC="file://$(pwd)/src/posts.html"
SRC="${SRC// /%20}"
CH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
PROFILE="${TMPDIR:-/tmp}/ruvi-posts-chrome"

post() { # out  number
  "$CH" --headless=new --disable-gpu --hide-scrollbars --no-first-run --no-default-browser-check \
    --user-data-dir="$PROFILE" --force-device-scale-factor=1 --window-size=1080,1350 \
    --virtual-time-budget=8000 --screenshot="$1" "$SRC?p=$2" >/dev/null 2>&1
  echo "  $1"
}

echo "Rendering Instagram posts..."
post instagram-post-1-welcome.png 1
post instagram-post-2-our-story.png 2
post instagram-post-3-how-to-order.png 3
