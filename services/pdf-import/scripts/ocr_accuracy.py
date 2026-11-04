"""Compare native and scanned fixture extraction, including reading-order differences.

Run inside the backend test image: python scripts/ocr_accuracy.py
The reference is native PDF extraction, not a manually transcribed OCR truth set.
"""

from __future__ import annotations

import argparse
import json
import sys
from importlib.metadata import version
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


def levenshtein(a: str, b: str) -> int:
    """Return edit distance using two rows and O(min(len(a), len(b))) space."""
    if len(a) < len(b):
        a, b = b, a
    previous = list(range(len(b) + 1))
    for i, left in enumerate(a, 1):
        current = [i]
        for j, right in enumerate(b, 1):
            current.append(min(current[-1] + 1, previous[j] + 1,
                               previous[j - 1] + (left != right)))
        previous = current
    return previous[-1]


def cer(reference: str, hypothesis: str) -> float:
    """Character error rate after collapsing whitespace; may exceed one."""
    reference = " ".join(reference.split())
    hypothesis = " ".join(hypothesis.split())
    return levenshtein(reference, hypothesis) / max(1, len(reference))


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, default=ROOT / "bench-results" / "ocr.json")
    args = parser.parse_args(argv)

    # Keep metric helpers usable without loading the extraction dependencies.
    from app.extract import OCR_LANGUAGES, extract_pdf

    fixtures = ROOT / "tests" / "fixtures" / "pdf"
    reference = extract_pdf(fixtures / "en_single.pdf")
    hypothesis = extract_pdf(fixtures / "scanned.pdf")
    pages = []
    for page in range(1, max(reference.pages, hypothesis.pages) + 1):
        # extract_pdf already returns blocks in document reading order.
        expected = " ".join(block.text for block in reference.blocks if block.page == page)
        actual = " ".join(block.text for block in hypothesis.blocks if block.page == page)
        measurement = {"page": page, "cer": cer(expected, actual),
                       "reference_chars": len(" ".join(expected.split()))}
        pages.append(measurement)
        print(json.dumps(measurement), flush=True)
    report = {"pages": pages, "docling": version("docling"), "ocr_languages": OCR_LANGUAGES}
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
