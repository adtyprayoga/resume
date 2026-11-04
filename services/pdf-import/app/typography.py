"""Attach anonymous, dominant embedded-font hints to extracted block geometry."""

from __future__ import annotations

import ctypes
import logging
import math
from contextlib import ExitStack, closing
from pathlib import Path

import pypdfium2 as pdfium

from .models import BlockStyle, SourceBlock

logger = logging.getLogger(__name__)


def font_hints(weight: int, italic_angle: int, base_name: str) -> tuple[bool | None, bool | None]:
    name = base_name.casefold()
    bold = None
    if any(part in name for part in ("bold", "black", "heavy")) or 600 <= weight <= 900:
        bold = True
    elif 100 <= weight < 600:
        bold = False
    italic = None
    if any(part in name for part in ("italic", "oblique")) or italic_angle != 0:
        italic = True
    elif any(part in name for part in ("regular", "roman")):
        italic = False
    return bold, italic


def dominant_style(tallies: dict[tuple[int, float], int]) -> tuple[int, float] | None:
    return max(tallies, key=tallies.get) if tallies else None


def style_blocks(pdf: Path, blocks: list[SourceBlock]) -> list[SourceBlock]:
    """Styles are optional: if PDFium fails anywhere in the document, every block stays unstyled."""
    try:
        styles = _styles(pdf, blocks)
    except Exception as error:  # noqa: BLE001 - any PDFium/ctypes failure only costs the hints
        logger.warning("styles skipped: %s", type(error).__name__)
        styles = {}
    return [block.model_copy(update={"style": styles.get(i)}) for i, block in enumerate(blocks)]


def _styles(pdf: Path, blocks: list[SourceBlock]) -> dict[int, BlockStyle]:
    raw = pdfium.raw
    styles: dict[int, BlockStyle] = {}
    fonts: dict[int, tuple[int, bool | None, bool | None]] = {}
    with ExitStack() as parents:
        document = pdfium.PdfDocument(str(pdf))
        parents.callback(document.close)
        for page_index in range(len(document)):
            page_blocks = [(i, b.bbox) for i, b in enumerate(blocks) if b.page == page_index + 1 and b.bbox is not None]
            if not page_blocks:
                continue
            page = document[page_index]
            # Font/text-object handles are borrowed. Keep pages alive so their
            # pointer identities cannot be recycled while assigning document IDs.
            parents.callback(page.close)
            tallies: dict[int, dict[tuple[int, float], int]] = {i: {} for i, _ in page_blocks}
            with closing(page.get_textpage()) as textpage:
                height = page.get_height()
                for char_index in range(textpage.count_chars()):
                    codepoint = raw.FPDFText_GetUnicode(textpage, char_index)
                    if not 0 <= codepoint <= 0x10FFFF or not chr(codepoint).isalpha():
                        continue
                    size = round(raw.FPDFText_GetFontSize(textpage, char_index), 1)
                    if not math.isfinite(size) or size <= 0:
                        continue
                    obj = raw.FPDFText_GetTextObject(textpage, char_index)
                    if not obj:
                        continue
                    font = raw.FPDFTextObj_GetFont(obj)
                    if not font:
                        continue
                    identity = ctypes.cast(font, ctypes.c_void_p).value
                    if identity not in fonts:
                        length = raw.FPDFFont_GetBaseFontName(font, None, 0)
                        name = ctypes.create_string_buffer(length)
                        raw.FPDFFont_GetBaseFontName(font, name, length)
                        angle = ctypes.c_int()
                        raw.FPDFFont_GetItalicAngle(font, ctypes.byref(angle))
                        bold, italic = font_hints(raw.FPDFFont_GetWeight(font), angle.value, name.value.decode("utf-8", errors="replace"))
                        fonts[identity] = (len(fonts) + 1, bold, italic)
                    left, right, bottom, top = (ctypes.c_double() for _ in range(4))
                    if not raw.FPDFText_GetCharBox(textpage, char_index, left, right, bottom, top):
                        continue
                    x, y = (left.value + right.value) / 2, height - (bottom.value + top.value) / 2
                    for block_index, box in page_blocks:
                        if box.l <= x <= box.r and box.t <= y <= box.b:
                            key = (identity, size)
                            tallies[block_index][key] = tallies[block_index].get(key, 0) + 1
            for block_index, counts in tallies.items():
                winner = dominant_style(counts)
                if winner is not None:
                    identity, size = winner
                    number, bold, italic = fonts[identity]
                    styles[block_index] = BlockStyle(font=f"f{number}", size=size, bold=bold, italic=italic)
    return styles
