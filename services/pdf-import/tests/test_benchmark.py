"""The resource benchmark must launch conversions exactly as the API does."""

from __future__ import annotations

import importlib.util
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
PDF = ROOT / "tests" / "fixtures" / "pdf"

_spec = importlib.util.spec_from_file_location("benchmark", ROOT / "scripts" / "benchmark.py")
assert _spec and _spec.loader
benchmark = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(benchmark)


@pytest.mark.docling
def test_run_child_converts_a_fixture_like_production() -> None:
    run = benchmark.run_child(PDF / "en_single.pdf")
    assert run["exit"] == 0, run["stderr_tail"]
    assert run["blocks"] == 20
