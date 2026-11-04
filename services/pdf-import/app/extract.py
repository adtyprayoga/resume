"""Docling conversion of one PDF into ordered source blocks.

Runs in a child process per conversion (see jobs.py), so models load cold each
time and every byte of memory is returned to the OS when the child exits.
"""

from __future__ import annotations

import os
from pathlib import Path

from docling_core.types.doc import DoclingDocument, GroupItem, TableItem, TextItem

from .models import MAX_BLOCK_TEXT, MAX_BLOCKS, BBox, Extraction, SourceBlock

INFERENCE_THREADS = 2
OCR_LANGUAGES = ["eng", "ind"]


def item_text(item: object) -> str:
    """Text of a text item, or a table's cells row by row (table structure
    inference is off, so a sidebar the layout model calls a table keeps its text)."""
    if isinstance(item, TextItem):
        return item.text.strip()
    if isinstance(item, TableItem):
        rows = ("  ".join(c.text.strip() for c in row if c.text.strip()) for row in item.data.grid)
        return "\n".join(r for r in rows if r)
    return ""


def blocks_from_document(doc: DoclingDocument) -> list[SourceBlock]:
    """Text items in Docling's reading order. IDs are positional, so the same
    document always yields the same IDs; list/inline groups get a shared ref."""
    blocks: list[SourceBlock] = []
    groups: dict[str, str] = {}

    for item, _level in doc.iterate_items():
        text = item_text(item)
        if not text:
            continue

        group = None
        parent = item.parent.resolve(doc) if item.parent else None
        if isinstance(parent, GroupItem) and parent.self_ref != doc.body.self_ref:
            group = groups.setdefault(parent.self_ref, f"g{len(groups) + 1}")

        page, bbox = 1, None
        if item.prov:
            first = item.prov[0]
            page = first.page_no
            size = doc.pages.get(page)
            if size is not None:
                box = first.bbox.to_top_left_origin(page_height=size.size.height)
                bbox = BBox(l=box.l, t=box.t, r=box.r, b=box.b)

        blocks.append(
            SourceBlock(
                id=f"b{len(blocks) + 1}",
                page=page,
                label=str(item.label.value),
                group=group,
                text=text[:MAX_BLOCK_TEXT],
                bbox=bbox,
            )
        )
        if len(blocks) >= MAX_BLOCKS:
            break

    return blocks


def build_converter():
    """Standard pipeline, CPU, PDFium, Tesseract CLI; nothing optional enabled."""
    from docling.backend.pypdfium2_backend import PyPdfiumDocumentBackend
    from docling.datamodel.accelerator_options import AcceleratorDevice, AcceleratorOptions
    from docling.datamodel.base_models import InputFormat
    from docling.datamodel.pipeline_options import PdfPipelineOptions, TesseractCliOcrOptions
    from docling.document_converter import DocumentConverter, PdfFormatOption

    options = PdfPipelineOptions(
        artifacts_path=os.environ.get("DOCLING_ARTIFACTS_PATH") or None,
        enable_remote_services=False,
        accelerator_options=AcceleratorOptions(num_threads=INFERENCE_THREADS, device=AcceleratorDevice.CPU),
        do_ocr=True,
        ocr_options=TesseractCliOcrOptions(lang=OCR_LANGUAGES),
        do_table_structure=False,
        do_picture_classification=False,
        do_picture_description=False,
        do_code_enrichment=False,
        do_formula_enrichment=False,
        generate_page_images=False,
        generate_picture_images=False,
        ocr_batch_size=1,
        layout_batch_size=1,
        table_batch_size=1,
    )
    return DocumentConverter(
        format_options={InputFormat.PDF: PdfFormatOption(pipeline_options=options, backend=PyPdfiumDocumentBackend)}
    )


def extract_pdf(path: Path) -> Extraction:
    result = build_converter().convert(path, raises_on_error=True)
    doc = result.document
    return Extraction(pages=max(1, len(doc.pages)), blocks=blocks_from_document(doc))


def main(argv: list[str]) -> int:
    """Child-process entry: `python -m app.extract IN.pdf OUT.json`."""
    source, target = Path(argv[0]), Path(argv[1])
    extraction = extract_pdf(source)
    tmp = target.with_suffix(".partial")
    tmp.write_text(extraction.model_dump_json())
    tmp.replace(target)
    return 0


if __name__ == "__main__":
    import sys

    raise SystemExit(main(sys.argv[1:]))
