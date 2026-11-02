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
for chrome in 'Save as PDF' 'Export JSON' 'fictional example' 'This is a sample resume'; do
  if grep -qF "$chrome" <<<"$text"; then
    echo "FAIL: app chrome leaked into the PDF: $chrome"
    fail=1
  fi
done

if grep -Eq '^[[:space:]]*(Page|Halaman)[[:space:]]+[0-9]+[[:space:]]*$' <<<"$text"; then
  echo "FAIL: a page guide leaked into the PDF"
  fail=1
fi

# Every page must carry the top margin, not just the first. With the margin on
# the element instead of @page, interior pages printed flush to the paper edge.
margins=$(pdftotext -bbox-layout "$OUT" - 2>/dev/null | python3 -I -c '
import sys, re
doc = sys.stdin.read()
for index, page in enumerate(re.split(r"<page ", doc)[1:], 1):
    words = re.findall(r"<word xMin=\"([\d.]+)\" yMin=\"([\d.]+)\"", page)
    if not words:
        continue
    top = min(float(y) for _, y in words)
    left = min(float(x) for x, _ in words)
    print(f"{index} {top:.1f} {left:.1f}")
')

echo "$margins" | while read -r page top left; do
  echo "page $page: top ${top}pt, left ${left}pt"
done

if echo "$margins" | awk '{ if ($2 < 40 || $3 < 45) exit 1 }'; then
  :
else
  echo "FAIL: a page is missing its margin (expected top >= 40pt, left >= 45pt)"
  fail=1
fi

if [ "$fail" -eq 0 ]; then echo "print check: OK"; fi
exit "$fail"
