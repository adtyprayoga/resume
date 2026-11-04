"""Environment configuration, validated once at startup. A bad value stops the
service instead of quietly running with limits nobody chose."""

from __future__ import annotations

import os
from collections.abc import Mapping
from dataclasses import dataclass
from pathlib import Path

MIB = 1024 * 1024


def _bounded(env: Mapping[str, str], name: str, default: float, low: float, high: float, kind: type = int) -> float:
    raw = env.get(name)
    if raw is None or raw == "":
        return default
    try:
        value = kind(raw)
    except ValueError as error:
        raise ValueError(f"{name} must be a number") from error
    if not low <= value <= high:
        raise ValueError(f"{name} must be between {low} and {high}")
    return value


@dataclass(frozen=True)
class Settings:
    work_dir: Path = Path("/tmp/pdf-import")
    max_bytes: int = 10 * MIB
    max_pages: int = 5
    timeout_seconds: float = 180
    result_ttl_seconds: float = 600
    sweep_interval_seconds: float = 30
    # Enforced by the container runtime (compose.yaml); validated here so the
    # documented limit and the configured one cannot silently disagree.
    memory_limit_bytes: int = 2_750_000_000
    cpu_limit: float = 2
    retry_after_seconds: int = 30

    @classmethod
    def from_env(cls, env: Mapping[str, str] | None = None) -> Settings:
        env = os.environ if env is None else env
        return cls(
            work_dir=Path(env.get("PDF_IMPORT_WORK_DIR") or "/tmp/pdf-import"),
            max_bytes=int(_bounded(env, "PDF_IMPORT_MAX_BYTES", 10 * MIB, 1, 10 * MIB)),
            max_pages=int(_bounded(env, "PDF_IMPORT_MAX_PAGES", 5, 1, 5)),
            timeout_seconds=_bounded(env, "PDF_IMPORT_TIMEOUT_SECONDS", 180, 10, 180, float),
            result_ttl_seconds=_bounded(env, "PDF_IMPORT_RESULT_TTL_SECONDS", 600, 30, 600, float),
            memory_limit_bytes=int(_bounded(env, "PDF_IMPORT_MEMORY_LIMIT_BYTES", 2_750_000_000, 1_000_000_000, 2_750_000_000)),
            cpu_limit=_bounded(env, "PDF_IMPORT_CPU_LIMIT", 2, 0.5, 2, float),
        )
