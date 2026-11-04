"""Extraction tests.

`blocks_from_document` is tested against hand-built Docling documents (fast).
Tests marked `docling` run the real Docling + Tesseract pipeline on the synthetic
fixtures in tests/fixtures/pdf; run them in the test image, where models are baked in.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest
from docling_core.types.doc import BoundingBox, CoordOrigin, DocItemLabel, DoclingDocument, GroupLabel, ProvenanceItem, Size, TableCell, TableData

from app.extract import blocks_from_document, extract_pdf
from app.models import CONTRACT_VERSION, Extraction

PDF = Path(__file__).parent / "fixtures" / "pdf"


def prov(page: int, l: float, t: float, r: float, b: float, text: str) -> ProvenanceItem:
    return ProvenanceItem(
        page_no=page,
        bbox=BoundingBox(l=l, t=t, r=r, b=b, coord_origin=CoordOrigin.BOTTOMLEFT),
        charspan=(0, len(text)),
    )


def sample_document() -> DoclingDocument:
    doc = DoclingDocument(name="sample")
    doc.add_page(page_no=1, size=Size(width=600, height=800))
    doc.add_page(page_no=2, size=Size(width=600, height=800))
    doc.add_title(text="Jane Doe", prov=prov(1, 50, 780, 200, 760, "Jane Doe"))
    doc.add_heading(text="Experience", prov=prov(1, 50, 700, 150, 690, "Experience"))
    doc.add_text(label=DocItemLabel.TEXT, text="   ", prov=prov(1, 50, 680, 60, 670, "   "))
    bullets = doc.add_group(label=GroupLabel.LIST, name="list")
    doc.add_list_item(text="Led migration", parent=bullets, prov=prov(1, 60, 660, 300, 650, "Led migration"))
    doc.add_list_item(text="Cut costs", parent=bullets, prov=prov(1, 60, 640, 300, 630, "Cut costs"))
    doc.add_text(label=DocItemLabel.TEXT, text="Page two text", prov=prov(2, 50, 780, 250, 770, "Page two text"))
    return doc


class TestBlocksFromDocument:
    def test_orders_blocks_and_assigns_sequential_ids(self) -> None:
        blocks = blocks_from_document(sample_document())
        assert [b.id for b in blocks] == ["b1", "b2", "b3", "b4", "b5"]
        assert [b.text for b in blocks] == ["Jane Doe", "Experience", "Led migration", "Cut costs", "Page two text"]

    def test_drops_whitespace_only_text(self) -> None:
        assert all(b.text.strip() for b in blocks_from_document(sample_document()))

    def test_keeps_layout_labels_and_pages(self) -> None:
        blocks = blocks_from_document(sample_document())
        assert [b.label for b in blocks] == ["title", "section_header", "list_item", "list_item", "text"]
        assert [b.page for b in blocks] == [1, 1, 1, 1, 2]

    def test_groups_list_items_under_one_reference(self) -> None:
        blocks = blocks_from_document(sample_document())
        assert blocks[0].group is None and blocks[1].group is None
        assert blocks[2].group is not None
        assert blocks[2].group == blocks[3].group
        assert blocks[4].group is None

    def test_converts_bbox_to_top_left_origin(self) -> None:
        bbox = blocks_from_document(sample_document())[0].bbox
        assert bbox is not None
        assert (bbox.l, bbox.t, bbox.r, bbox.b) == pytest.approx((50, 20, 200, 40))

    def test_keeps_table_text_row_by_row(self) -> None:
        doc = DoclingDocument(name="table")
        doc.add_page(page_no=1, size=Size(width=600, height=800))
        cells = [
            TableCell(text=text, start_row_offset_idx=r, end_row_offset_idx=r + 1, start_col_offset_idx=c, end_col_offset_idx=c + 1)
            for r, row in enumerate([["Go", "5 years"], ["SQL", ""]])
            for c, text in enumerate(row)
        ]
        doc.add_table(data=TableData(num_rows=2, num_cols=2, table_cells=cells), prov=prov(1, 50, 700, 300, 650, ""))
        empty = DoclingDocument(name="empty-table")
        empty.add_page(page_no=1, size=Size(width=600, height=800))
        empty.add_table(data=TableData(num_rows=0, num_cols=0, table_cells=[]))
        blocks = blocks_from_document(doc)
        assert [(b.label, b.text) for b in blocks] == [("table", "Go  5 years\nSQL")]
        assert blocks_from_document(empty) == []

    @pytest.mark.parametrize("label", [DocItemLabel.TEXT, DocItemLabel.SECTION_HEADER])
    def test_splits_provenance_spans_with_their_own_geometry(self, label) -> None:
        doc = DoclingDocument(name="progression")
        doc.add_page(page_no=1, size=Size(width=600, height=800))
        doc.add_page(page_no=2, size=Size(width=600, height=800))
        text = "Engineering Lead 2018 - Present Jan 2022 - Present"
        item = doc.add_text(label=label, text=text)
        spans = [(0, 16, 1, 50, 700), (17, 31, 1, 400, 720), (32, len(text), 2, 400, 700)]
        for start, end, page, left, top in spans:
            provenance = prov(page, left, top, left + 150, top - 10, text)
            provenance.charspan = (start, end)
            item.prov.append(provenance)
        blocks = blocks_from_document(doc)
        assert [b.text for b in blocks] == ["Engineering Lead", "2018 - Present", "Jan 2022 - Present"]
        assert [b.id for b in blocks] == ["b1", "b2", "b3"]
        assert [b.page for b in blocks] == [1, 1, 2]
        assert [(b.bbox.l, b.bbox.t) for b in blocks] == [(50, 100), (400, 80), (400, 100)]
        assert blocks[0].group is not None
        assert len({b.group for b in blocks}) == 1

    @pytest.mark.parametrize("spans", [[(0, 4), (3, 9)], [(0, 3), (5, 9)], [(0, 4), (4, 99)], [(5, 9), (0, 5)]])
    def test_unsafe_provenance_falls_back_without_losing_text(self, spans) -> None:
        doc = DoclingDocument(name="unsafe")
        doc.add_page(page_no=1, size=Size(width=600, height=800))
        item = doc.add_text(label=DocItemLabel.TEXT, text="AlphaBeta")
        for span in spans:
            provenance = prov(1, 50, 700, 250, 690, item.text)
            provenance.charspan = span
            item.prov.append(provenance)
        blocks = blocks_from_document(doc)
        assert [b.text for b in blocks] == ["AlphaBeta"]

    def test_wrapped_list_item_stays_one_semantic_block(self) -> None:
        doc = DoclingDocument(name="wrapped-bullet")
        doc.add_page(page_no=1, size=Size(width=600, height=800))
        bullets = doc.add_group(label=GroupLabel.LIST, name="list")
        item = doc.add_list_item(text="Built reliable systems", parent=bullets)
        for span in [(0, 14), (15, 22)]:
            provenance = prov(1, 50, 700, 250, 690, item.text)
            provenance.charspan = span
            item.prov.append(provenance)
        assert [b.text for b in blocks_from_document(doc)] == ["Built reliable systems"]

    def test_extraction_model_carries_contract_version(self) -> None:
        extraction = Extraction(pages=2, blocks=blocks_from_document(sample_document()))
        assert extraction.contract_version == CONTRACT_VERSION == 1


def texts(extraction: Extraction) -> str:
    return "\n".join(b.text for b in extraction.blocks)


def normalized(value: str) -> str:
    return re.sub(r"\s+", " ", value).lower()


@pytest.mark.docling
class TestRealExtraction:
    def test_guide_template_cv_keeps_every_line(self) -> None:
        extraction = extract_pdf(PDF / "guide_template.pdf")
        joined = texts(extraction)
        for phrase in ["Rina Wulandari", "Profile Summary", "Competencies & Abilities", "Working Experience",
                       "Education Background", "Course", "References", "Hobbies", "for further review.",
                       "Contoh Consulting - Bandung, Indonesia", "Sep 2024 - Present", "Anggi Pratiwi"]:
            assert phrase in joined
        assert extraction.pages == 2
        assert next(b for b in extraction.blocks if "for further review." in b.text).page == 2

    def test_english_cv_keeps_native_text_in_reading_order(self) -> None:
        extraction = extract_pdf(PDF / "en_single.pdf")
        joined = texts(extraction)
        for phrase in ["Jane Doe", "jane.doe@example.com", "Summary", "Experience", "Example Payments", "Universitas Contoh", "Kafka"]:
            assert phrase in joined
        assert joined.index("Experience") < joined.index("Example Payments") < joined.index("Sample Logistics") < joined.index("Education")
        assert extraction.pages == 1
        assert all(b.page == 1 and b.bbox is not None for b in extraction.blocks)
        assert any(b.label == "section_header" and b.text == "Experience" for b in extraction.blocks)

    def test_indonesian_cv_text_is_preserved(self) -> None:
        joined = texts(extract_pdf(PDF / "id_single.pdf"))
        for phrase in ["Budi Santoso", "Pengalaman Kerja", "Pendidikan", "Keahlian", "Penghargaan", "Sekarang"]:
            assert phrase in joined

    def test_two_column_cv_keeps_columns_contiguous(self) -> None:
        blocks = extract_pdf(PDF / "two_column.pdf").blocks
        sidebar = {"Contact", "rina.putri@example.com", "Figma", "User Research", "Design Systems"}
        main = {"Product Designer, Contoh Studio", "Junior Designer, Sample Agency", "Sample Institute of Art"}
        joined = [b.text for b in blocks]
        for phrase in sidebar | main:
            assert any(phrase in t for t in joined), phrase
        side_idx = [i for i, t in enumerate(joined) if any(p in t for p in sidebar)]
        main_idx = [i for i, t in enumerate(joined) if any(p in t for p in main)]
        assert max(side_idx) < min(main_idx) or max(main_idx) < min(side_idx)
        assert joined.index(next(t for t in joined if "Product Designer" in t)) < joined.index(next(t for t in joined if "Junior Designer" in t))

    def test_scanned_cv_is_read_with_ocr(self) -> None:
        extraction = extract_pdf(PDF / "scanned.pdf")
        joined = normalized(texts(extraction))
        for phrase in ["jane doe", "experience", "example payments", "education"]:
            assert phrase in joined
        assert all(b.bbox is not None for b in extraction.blocks)

    def test_mixed_cv_combines_native_and_ocr_pages(self) -> None:
        extraction = extract_pdf(PDF / "mixed.pdf")
        page1 = normalized("\n".join(b.text for b in extraction.blocks if b.page == 1))
        page2 = normalized("\n".join(b.text for b in extraction.blocks if b.page == 2))
        assert "jane doe" in page1
        assert "budi santoso" in page2 and "pendidikan" in page2

    def test_progression_cv_preserves_cross_page_roles_and_inline_entries(self) -> None:
        extraction = extract_pdf(PDF / "progression.pdf")
        joined = texts(extraction)
        for phrase in ["MAYA NUSANTARA", "Core Competencies", "Software Staff", "Training Staff", "Additional Experience", "Personnel Portal", "Universitas Contoh", "Certifications & Awards", "Bahasa Indonesia"]:
            assert phrase in joined
        assert extraction.pages == 2
        continuation = next(b for b in extraction.blocks if "Coordinated delivery" in b.text)
        assert continuation.page == 2
        assert any("Jan 2022" in b.text and b.bbox is not None for b in extraction.blocks)

    def test_five_page_cv_covers_every_page_in_order(self) -> None:
        extraction = extract_pdf(PDF / "five_page.pdf")
        assert extraction.pages == 5
        pages = [b.page for b in extraction.blocks]
        assert sorted(set(pages)) == [1, 2, 3, 4, 5]
        assert pages == sorted(pages)
        assert "Example Company 15" in texts(extraction)


@pytest.mark.docling
def test_child_entry_point_writes_extraction_json(tmp_path: Path) -> None:
    import subprocess
    import sys

    out = tmp_path / "result.json"
    done = subprocess.run([sys.executable, "-m", "app.extract", str(PDF / "en_single.pdf"), str(out), "--max-pages", "5"], capture_output=True, timeout=180)
    assert done.returncode == 0, done.stderr[-2000:]
    extraction = Extraction.model_validate_json(out.read_text())
    assert any(b.text == "Jane Doe" for b in extraction.blocks)


class TestChildValidation:
    """`main` checks the file with PDFium before Docling is imported, so bad
    uploads fail fast with a stable exit code and never reach the pipeline."""

    @pytest.mark.parametrize(
        ("fixture", "code"),
        [("not_a_pdf", 10), ("corrupt", 10), ("encrypted", 11), ("six_page", 12)],
    )
    def test_rejects_bad_files_with_stable_exit_codes(self, tmp_path: Path, fixture: str, code: int) -> None:
        from app.extract import main

        out = tmp_path / "out.json"
        assert main([str(PDF / f"{fixture}.pdf"), str(out), "--max-pages", "5"]) == code
        assert not out.exists()

    def test_exit_codes_match_error_codes(self) -> None:
        from app.extract import EXIT_CODES

        assert EXIT_CODES == {10: "invalid_file", 11: "encrypted", 12: "too_many_pages", 13: "empty_extraction"}


@pytest.mark.docling
def test_blank_pdf_reports_empty_extraction(tmp_path: Path) -> None:
    from app.extract import main

    out = tmp_path / "out.json"
    assert main([str(PDF / "blank.pdf"), str(out), "--max-pages", "5"]) == 13
    assert not out.exists()
