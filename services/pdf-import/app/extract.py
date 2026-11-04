"""Docling conversion of one PDF into ordered source blocks.

Runs in a child process per conversion (see jobs.py), so models load cold each
time and every byte of memory is returned to the OS when the child exits.
"""

from __future__ import annotations

import argparse
import os
from pathlib import Path

from docling_core.types.doc import DocItemLabel, DoclingDocument, GroupItem, ProvenanceItem, TableItem, TextItem

from .models import EXIT, EXIT_CODES, MAX_BLOCK_TEXT, MAX_BLOCKS, BBox, Extraction, SourceBlock
from .typography import style_blocks

__all__ = ["EXIT_CODES", "blocks_from_document", "extract_pdf", "main"]

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


def text_fragments(item: object) -> list[tuple[str, ProvenanceItem | None]]:
    """Split text only when provenance covers every meaningful character once.

    List items remain semantic bullets. Invalid/overlapping spans fall back to
    the full item, rather than silently discarding source text.
    """
    text = item_text(item)
    provenance = getattr(item, "prov", [])
    fallback = [(text, provenance[0] if provenance else None)]
    if (
        not isinstance(item, TextItem)
        or item.label not in {DocItemLabel.TEXT, DocItemLabel.SECTION_HEADER}
        or len(provenance) < 2
    ):
        return fallback
    raw = item.text
    previous = 0
    fragments = []
    for source in provenance:
        start, end = source.charspan
        if not (previous <= start < end <= len(raw)) or raw[previous:start].strip():
            return fallback
        fragment = raw[start:end].strip()
        if fragment:
            fragments.append((fragment, source))
        previous = end
    if raw[previous:].strip() or len(fragments) < 2:
        return fallback
    return fragments


def blocks_from_document(doc: DoclingDocument) -> list[SourceBlock]:
    """Ordered blocks with stable positional IDs and geometry per source span.

    Fragments of the same item share a group for frontend prose reassembly;
    unsplit items retain their existing parent-group semantics.
    """
    blocks: list[SourceBlock] = []
    groups: dict[str, str] = {}

    for item, _level in doc.iterate_items():
        if not item_text(item):
            continue
        fragments = text_fragments(item)
        group = None
        parent = item.parent.resolve(doc) if item.parent else None
        if len(fragments) > 1:
            group = groups.setdefault(item.self_ref, f"g{len(groups) + 1}")
        elif isinstance(parent, GroupItem) and parent.self_ref != doc.body.self_ref:
            group = groups.setdefault(parent.self_ref, f"g{len(groups) + 1}")

        for text, source in fragments:
            page, bbox = 1, None
            if source is not None:
                page = source.page_no
                size = doc.pages.get(page)
                if size is not None:
                    box = source.bbox.to_top_left_origin(page_height=size.size.height)
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
                return blocks
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


def extract_pdf(path: Path, max_pages: int = 5, progress_path: Path | None = None, total_pages: int | None = None) -> Extraction:
    from .progress import ProgressWriter

    if progress_path is not None and total_pages is None:
        total_pages = pdf_page_count(path, max_pages)
    callback = ProgressWriter(progress_path, total_pages) if progress_path is not None and total_pages is not None else None
    result = build_converter().convert(path, raises_on_error=True, max_num_pages=max_pages, progress_callback=callback)
    doc = result.document
    return Extraction(pages=max(1, len(doc.pages)), blocks=style_blocks(path, blocks_from_document(doc)))


def pdf_page_count(path: Path, max_pages: int) -> int:
    """Validate before loading models and return the selected page count.

    ValueError carries the stable refusal exit code.
    """
    import pypdfium2 as pdfium

    try:
        with path.open("rb") as handle:
            if not handle.read(1024).lstrip().startswith(b"%PDF-"):
                raise ValueError(EXIT["invalid_file"])
        document = pdfium.PdfDocument(str(path))
    except pdfium.PdfiumError as error:
        if getattr(error, "err_code", None) == pdfium.raw.FPDF_ERR_PASSWORD:
            raise ValueError(EXIT["encrypted"])
        raise ValueError(EXIT["invalid_file"])
    try:
        pages = len(document)
        if pages < 1:
            raise ValueError(EXIT["invalid_file"])
        if pages > max_pages:
            raise ValueError(EXIT["too_many_pages"])
    finally:
        document.close()
    return pages


def main(argv: list[str]) -> int:
    """Child-process entry: `python -m app.extract IN.pdf OUT.json --max-pages N`.
    Writes nothing to stdout/stderr that contains CV text."""
    parser = argparse.ArgumentParser(prog="app.extract")
    parser.add_argument("source", type=Path)
    parser.add_argument("target", type=Path)
    parser.add_argument("--max-pages", type=int, required=True)
    parser.add_argument("--progress", type=Path)
    args = parser.parse_args(argv)

    try:
        pages = pdf_page_count(args.source, args.max_pages)
    except ValueError as error:
        return error.args[0]

    extraction = extract_pdf(args.source, args.max_pages, progress_path=args.progress, total_pages=pages)
    if not extraction.blocks:
        return EXIT["empty_extraction"]
    tmp = args.target.with_suffix(".partial")
    tmp.write_text(extraction.model_dump_json())
    tmp.replace(args.target)
    return 0


if __name__ == "__main__":
    import sys

    raise SystemExit(main(sys.argv[1:]))
