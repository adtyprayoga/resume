#!/usr/bin/env bash
# Renders the running dev server to a PDF with headless Chromium and asserts the
# things that silently break: page geometry, that text is selectable rather than
# rasterised, and that no app chrome reached the page.
#
# jsdom has no layout engine, so none of this is testable in the unit suite.
# Needs `bun run dev` running, plus chromium and poppler-utils.
set -euo pipefail

URL="${1:-http://localhost:5173/}"
OUT="$(mktemp -d)/resume.pdf"

chromium --headless --disable-gpu --no-sandbox --no-pdf-header-footer \
  --print-to-pdf="$OUT" --virtual-time-budget=6000 "$URL" >/dev/null 2>&1

pages=$(pdfinfo "$OUT" | awk '/^Pages:/ {print $2}')
size=$(pdfinfo "$OUT" | awk -F': +' '/^Page size:/ {print $2}')
text=$(pdftotext "$OUT" -)

echo "pages:     $pages"
echo "page size: $size"

fail=0
grep -q '(A4)' <<<"$size" || { echo "FAIL: page size is not A4"; fail=1; }
grep -q 'Budi Santoso' <<<"$text" || { echo "FAIL: no selectable text found"; fail=1; }
for chrome in 'Save as PDF' 'Export JSON' 'fictional example'; do
  if grep -qF "$chrome" <<<"$text"; then
    echo "FAIL: app chrome leaked into the PDF: $chrome"
    fail=1
  fi
done

if [ "$fail" -eq 0 ]; then echo "print check: OK"; fi
exit "$fail"
