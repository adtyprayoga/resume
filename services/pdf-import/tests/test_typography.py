import re

import pytest
from pydantic import ValidationError

from app.extract import extract_pdf
from app.models import BlockStyle
from app.typography import dominant_style, font_hints
from tests.conftest import PDF


@pytest.mark.parametrize("weight,angle,name,expected", [
    (700, 0, "ABCDEF+Calibri-Bold", (True, None)),
    (400, -12, "Calibri-Italic", (False, True)),
    (3716, 0, "CIDFont+F2", (None, None)),
    (400, 0, "CIDFont+F1", (False, None)),
    (400, 0, "Calibri-Regular", (False, False)),
    (400, 0, "Demo-Semibold", (True, None)),
    (0, 0, "Demo-Black", (True, None)),
    (0, 0, "Demo-HeavyOblique", (True, True)),
    (600, 0, "Demo-Roman", (True, False)),
    (900, 0, "CIDFont", (True, None)),
    (100, 0, "CIDFont", (False, None)),
    (99, 0, "CIDFont", (None, None)),
])
def test_font_hints(weight, angle, name, expected) -> None:
    assert font_hints(weight, angle, name) == expected


def test_dominant_style_counts_letters_and_preserves_first_tie() -> None:
    assert dominant_style({(1, 10.0): 14, (2, 10.0): 40}) == (2, 10.0)
    assert dominant_style({(2, 10.0): 14, (1, 10.0): 14}) == (2, 10.0)
    assert dominant_style({}) is None


@pytest.mark.parametrize("size", [0, -1, float("nan"), float("inf"), -float("inf")])
def test_style_rejects_invalid_size(size) -> None:
    with pytest.raises(ValidationError):
        BlockStyle(font="f1", size=size, bold=None, italic=None)


@pytest.mark.docling
def test_guide_template_styles_separate_heading_entry_role_and_body() -> None:
    blocks = {b.text: b for b in extract_pdf(PDF / "guide_template.pdf").blocks}
    heading, entry = blocks["Profile Summary"].style, blocks["Contoh Consulting - Bandung, Indonesia"].style
    role, body = blocks["Training Consultant"].style, blocks["Ran onboarding for 120 new store staff."].style
    assert heading.size > body.size and entry.font != body.font and role.font not in {body.font, entry.font}
    assert all(b.style is None or re.fullmatch(r"f[1-9][0-9]*", b.style.font) for b in blocks.values())


@pytest.mark.docling
def test_scanned_page_blocks_have_no_style() -> None:
    assert all(b.style is None for b in extract_pdf(PDF / "scanned.pdf").blocks)


def test_geometry_letter_majority_and_page_font_identity(tmp_path) -> None:
    from reportlab.pdfgen.canvas import Canvas
    from app.models import BBox, SourceBlock
    from app.typography import style_blocks

    pdf = tmp_path / "styles.pdf"
    canvas = Canvas(str(pdf), pagesize=(300, 300))
    for _ in range(2):
        canvas.setFont("Helvetica-Bold", 12)
        canvas.drawString(20, 260, "Label: 12345678901234567890")
        canvas.setFont("Helvetica", 12)
        canvas.drawString(20, 240, "The longer regular body letters win")
        canvas.setFont("Helvetica-Oblique", 12)
        canvas.drawString(20, 180, "Outside")
        canvas.showPage()
    canvas.save()
    blocks = [SourceBlock(id=f"b{i}", page=i, label="text", text="mixed", bbox=BBox(l=10, t=20, r=290, b=70)) for i in (1, 2)]
    blocks.append(SourceBlock(id="b3", page=1, label="text", text="empty", bbox=BBox(l=0, t=200, r=100, b=250)))
    blocks.append(SourceBlock(id="b4", page=1, label="text", text="no geometry"))
    styled = style_blocks(pdf, blocks)
    assert styled[0].style.font == "f2"
    assert styled[0].style.size == 12
    assert styled[0].style.font == styled[1].style.font
    assert styled[2].style is None and styled[3].style is None
    assert blocks[0].style is None
