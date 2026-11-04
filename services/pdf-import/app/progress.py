"""Content-free progress from Docling's public conversion events."""
from __future__ import annotations

import contextlib
from pathlib import Path

from docling.datamodel.progress import ConversionProgressEvent

from .models import PdfProgress


class ProgressWriter:
    def __init__(self, path: Path, total_pages: int) -> None:
        self.path = path
        self.total_pages = total_pages
        self.completed_pages = 0
        self.initialized = 0
        self.assembled = 0
        self.phase = "initializing"
        self.write()

    def write(self) -> None:
        progress = PdfProgress(
            phase=self.phase,
            percent=100 * (self.initialized + self.completed_pages + self.assembled) // (self.total_pages + 3),
            completed_pages=self.completed_pages,
            total_pages=self.total_pages,
        )
        # Telemetry is optional; an unavailable sidecar must not break extraction.
        with contextlib.suppress(OSError):
            temporary = self.path.with_suffix(".partial")
            temporary.write_text(progress.model_dump_json())
            temporary.replace(self.path)

    def __call__(self, event: ConversionProgressEvent) -> None:
        if event.kind == "phase_started":
            if event.phase == "build":
                self.initialized = 1
                if self.phase == "initializing":
                    self.phase = "extracting"
            elif event.phase == "assemble":
                if self.phase != "finalizing":
                    self.phase = "assembling"
            elif event.phase == "enrich":
                self.assembled = 1
                self.phase = "finalizing"
        elif event.kind == "page_completed":
            self.completed_pages = max(self.completed_pages, min(event.completed_pages, self.total_pages))
        self.write()
