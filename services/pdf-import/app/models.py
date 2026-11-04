"""Extraction API contract. This is not the CV schema: the browser maps these
blocks into its own resume model. Keep in step with src/lib/io/pdf/validate.ts;
tests/fixtures/contract/*.json is checked by both test suites."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

CONTRACT_VERSION = 1

# Bounds the browser also enforces, so a valid response is never rejected client-side.
MAX_BLOCKS = 5000
MAX_BLOCK_TEXT = 20_000


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)


class BBox(Strict):
    """Page coordinates in points, origin at the page's top-left corner."""

    l: float
    t: float
    r: float
    b: float


class SourceBlock(Strict):
    id: str = Field(pattern=r"^b[1-9][0-9]*$")
    page: int = Field(ge=1)
    label: str = Field(max_length=64)
    group: str | None = Field(default=None, pattern=r"^g[1-9][0-9]*$")
    text: str = Field(min_length=1, max_length=MAX_BLOCK_TEXT)
    bbox: BBox | None = None


class Extraction(Strict):
    contract_version: Literal[1] = CONTRACT_VERSION
    pages: int = Field(ge=1)
    blocks: list[SourceBlock] = Field(max_length=MAX_BLOCKS)


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


class JobError(Strict):
    code: ErrorCode
    retryable: bool


class JobStatus(Strict):
    contract_version: Literal[1] = CONTRACT_VERSION
    id: str
    status: Literal["processing", "completed", "failed"]
    stage: Literal["queued", "extracting", "done"] | None = None
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
