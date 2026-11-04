"""Extraction API contract. This is not the CV schema: the browser maps these
blocks into its own resume model. Keep in step with src/lib/io/pdf/validate.ts;
tests/fixtures/contract/*.json is checked by both test suites."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

CONTRACT_VERSION = 1

# Bounds the browser also enforces, so a valid response is never rejected client-side.
MAX_BLOCKS = 5000
MAX_BLOCK_TEXT = 20_000


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True, strict=True)


class BBox(Strict):
    """Page coordinates in points, origin at the page's top-left corner."""

    l: float
    t: float
    r: float
    b: float


class BlockStyle(Strict):
    font: str = Field(pattern=r"^f[1-9][0-9]*$")
    size: float = Field(gt=0, allow_inf_nan=False)
    bold: bool | None
    italic: bool | None


class SourceBlock(Strict):
    id: str = Field(pattern=r"^b[1-9][0-9]*$")
    page: int = Field(ge=1)
    label: str = Field(max_length=64)
    group: str | None = Field(default=None, pattern=r"^g[1-9][0-9]*$")
    text: str = Field(min_length=1, max_length=MAX_BLOCK_TEXT)
    bbox: BBox | None = None
    style: BlockStyle | None = None


class Extraction(Strict):
    contract_version: Literal[1] = CONTRACT_VERSION
    pages: int = Field(ge=1)
    blocks: list[SourceBlock] = Field(max_length=MAX_BLOCKS)

    @model_validator(mode="after")
    def references_are_consistent(self) -> Extraction:
        if len({b.id for b in self.blocks}) != len(self.blocks):
            raise ValueError("duplicate block id")
        if any(b.page > self.pages for b in self.blocks):
            raise ValueError("block page beyond page count")
        return self


ErrorCode = Literal[
    "invalid_file",
    "too_large",
    "too_many_pages",
    "encrypted",
    "empty_extraction",
    "timeout",
    "conversion_failed",
    "busy",
    "not_found",
    "cancelled",
]


# Child-process exit codes (app.extract) for files refused before conversion.
EXIT_CODES: dict[int, ErrorCode] = {10: "invalid_file", 11: "encrypted", 12: "too_many_pages", 13: "empty_extraction"}
EXIT: dict[str, int] = {code: number for number, code in EXIT_CODES.items()}
RETRYABLE: frozenset[str] = frozenset({"busy", "timeout", "conversion_failed", "not_found"})


class JobError(Strict):
    code: ErrorCode
    retryable: bool


class PdfProgress(Strict):
    phase: Literal["initializing", "extracting", "assembling", "finalizing", "done"]
    percent: int = Field(ge=0, le=100)
    completed_pages: int = Field(ge=0)
    total_pages: int | None = Field(default=None, ge=1)

    @model_validator(mode="after")
    def consistent(self) -> PdfProgress:
        if self.total_pages is None and self.completed_pages != 0:
            raise ValueError("unknown total with completed pages")
        if self.total_pages is not None and self.completed_pages > self.total_pages:
            raise ValueError("completed pages beyond total")
        if (self.phase == "done") != (self.percent == 100):
            raise ValueError("only validated completion reaches 100")
        return self


class JobStatus(Strict):
    contract_version: Literal[1] = CONTRACT_VERSION
    id: str = Field(pattern=r"^[A-Za-z0-9_-]{43}$")
    status: Literal["processing", "completed", "failed"]
    stage: Literal["queued", "extracting", "done"] | None = None
    progress: PdfProgress | None = None
    result: Extraction | None = None
    error: JobError | None = None


class Limits(Strict):
    max_bytes: int
    max_pages: int
    timeout_seconds: int


class Health(Strict):
    contract_version: Literal[1] = CONTRACT_VERSION
    ready: bool
    busy: bool
    limits: Limits
