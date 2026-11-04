from __future__ import annotations

import os
import sys
from collections.abc import Callable
from pathlib import Path

import pytest

from app.settings import Settings

HERE = Path(__file__).parent
PDF = HERE / "fixtures" / "pdf"
FAKE = HERE / "fake_extractor.py"


def fake_command(mode: str) -> Callable[[Path, Path], list[str]]:
    return lambda source, target: [sys.executable, str(FAKE), mode, str(source), str(target)]


def alive(pid: int) -> bool:
    """A zombie counts as dead: it no longer runs and holds no memory."""
    try:
        state = Path(f"/proc/{pid}/stat").read_text().rsplit(")", 1)[1].split()[0]
    except (FileNotFoundError, IndexError):
        return False
    return state != "Z"


@pytest.fixture
def settings(tmp_path: Path) -> Settings:
    return Settings(work_dir=tmp_path / "work", timeout_seconds=5, result_ttl_seconds=600, sweep_interval_seconds=0.2)


@pytest.fixture
def pid_file(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    path = tmp_path / "pids"
    monkeypatch.setenv("FAKE_PID_FILE", str(path))
    return path


def read_pids(path: Path) -> list[int]:
    return [int(p) for p in path.read_text().split()] if path.exists() else []


__all__ = ["PDF", "alive", "fake_command", "read_pids", "os"]
