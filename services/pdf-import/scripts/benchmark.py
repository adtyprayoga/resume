"""Resource gate for the PDF extractor.

Run inside the backend image under the production limits, e.g.
    docker run --rm --memory=2750000000 --memory-swap=2750000000 --cpus=2 \
      -v $PWD:/app/src -w /app/src pdf-import:test python scripts/benchmark.py

Every conversion is a cold child process, exactly as the API runs it, so model
loading is part of every timing. The container's cgroup peak covers the parent
and all children. The gate fails on a peak >= 2.3 GB, any OOM kill, any
non-zero exit, or any conversion over the 180 s timeout.
"""

from __future__ import annotations

import argparse
import json
import os
import platform
import resource
import signal
import subprocess
import sys
import tempfile
import time
from importlib.metadata import version
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FIXTURES = ROOT / "tests" / "fixtures" / "pdf"
CV_FIXTURES = ["en_single", "id_single", "two_column", "scanned", "mixed", "five_page"]
PEAK_LIMIT = 2_300_000_000
TIMEOUT = 180
CGROUP = Path("/sys/fs/cgroup")


def cgroup_value(name: str) -> str | None:
    try:
        return (CGROUP / name).read_text().strip()
    except OSError:
        return None


def oom_kills() -> int:
    events = cgroup_value("memory.events") or ""
    for line in events.splitlines():
        key, _, value = line.partition(" ")
        if key == "oom_kill":
            return int(value)
    return 0


def run_child(pdf: Path, cancel_after: float | None = None) -> dict:
    with tempfile.TemporaryDirectory() as tmp:
        out = Path(tmp) / "out.json"
        start = time.monotonic()
        proc = subprocess.Popen(
            [sys.executable, "-m", "app.extract", str(pdf), str(out)],
            cwd=ROOT,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
            start_new_session=True,
        )
        timed_out = cancelled = False
        deadline = start + (cancel_after if cancel_after is not None else TIMEOUT)
        reaped = None
        while reaped is None and time.monotonic() < deadline:
            pid, status, usage = os.wait4(proc.pid, os.WNOHANG)
            if pid:
                reaped = (status, usage)
            else:
                time.sleep(0.05)
        if reaped is None:
            if cancel_after is not None:
                cancelled = True
            else:
                timed_out = True
            os.killpg(proc.pid, signal.SIGKILL)
            _, status, usage = os.wait4(proc.pid, 0)
        else:
            status, usage = reaped
        proc.returncode = os.waitstatus_to_exitcode(status)
        stderr = proc.stderr.read().decode(errors="replace") if proc.stderr else ""
        blocks = len(json.loads(out.read_text())["blocks"]) if out.exists() else None
        return {
            "fixture": pdf.stem,
            "seconds": round(time.monotonic() - start, 2),
            "exit": proc.returncode,
            "child_max_rss_bytes": usage.ru_maxrss * 1024,
            "blocks": blocks,
            "timed_out": timed_out,
            "cancelled": cancelled,
            "stderr_tail": "" if proc.returncode == 0 or cancelled else stderr[-500:],
        }


def tesseract_version() -> str:
    try:
        return subprocess.run(["tesseract", "--version"], capture_output=True, text=True).stdout.splitlines()[0]
    except (OSError, IndexError):
        return "unavailable"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repeat", type=int, default=2, help="cold conversions per fixture")
    parser.add_argument("--out", type=Path, default=ROOT / "bench-results" / "benchmark.json")
    args = parser.parse_args()

    runs = []
    for round_ in range(args.repeat):
        for name in CV_FIXTURES:
            run = run_child(FIXTURES / f"{name}.pdf")
            run["round"] = round_ + 1
            runs.append(run)
            print(json.dumps(run), flush=True)
    cancel = run_child(FIXTURES / "five_page.pdf", cancel_after=5)
    cancel["round"] = "cancel"
    runs.append(cancel)
    print(json.dumps(cancel), flush=True)
    time.sleep(1)
    after_cancel = int(cgroup_value("memory.current") or 0)

    # RSS counts shared model mappings the cgroup may not charge; gate on the larger.
    cgroup_peak = int(cgroup_value("memory.peak") or 0)
    peak = max(cgroup_peak, max(r["child_max_rss_bytes"] for r in runs))
    conversions = [r for r in runs if not r["cancelled"]]
    failures = [r for r in conversions if r["exit"] != 0 or r["timed_out"] or not r["blocks"]]
    kills = oom_kills()
    report = {
        "versions": {
            "python": platform.python_version(),
            "docling": version("docling"),
            "torch": version("torch"),
            "tesseract": tesseract_version(),
        },
        "limits": {
            "memory_max": cgroup_value("memory.max"),
            "swap_max": cgroup_value("memory.swap.max"),
            "cpu_max": cgroup_value("cpu.max"),
            "visible_cpus": os.cpu_count(),
        },
        "peak_bytes": peak,
        "cgroup_peak_bytes": cgroup_peak,
        "peak_limit_bytes": PEAK_LIMIT,
        "memory_after_cancel_bytes": after_cancel,
        "parent_max_rss_bytes": resource.getrusage(resource.RUSAGE_SELF).ru_maxrss * 1024,
        "oom_kills": kills,
        "slowest_cold_seconds": max(r["seconds"] for r in conversions),
        "runs": runs,
        "passed": peak < PEAK_LIMIT and kills == 0 and not failures,
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(report, indent=2))
    print(json.dumps({k: v for k, v in report.items() if k != "runs"}, indent=2))
    return 0 if report["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
