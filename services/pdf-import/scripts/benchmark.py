"""Resource gate for the PDF extractor.

Run inside the backend image under the production limits, e.g.
    docker run --rm --memory=2750000000 --memory-swap=2750000000 --cpus=2 \
      -v $PWD:/app/src -w /app/src pdf-import:test python scripts/benchmark.py

Or, against a running deployment (from the host; stdlib only):
    python3 scripts/benchmark.py --api http://127.0.0.1:8080 --container <pdf-import container>
which adds retained-result expiry and post-cancellation memory, read from the
container's own cgroup.

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
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
from app.settings import Settings  # noqa: E402  (needs ROOT on sys.path)

MAX_PAGES = Settings().max_pages
FIXTURES = ROOT / "tests" / "fixtures" / "pdf"
CV_FIXTURES = ["en_single", "id_single", "two_column", "scanned", "mixed", "five_page", "progression"]
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


def progress_summary(observations: list[dict], terminal: bool = True) -> dict:
    """Validate measured metadata, retaining no extracted document text."""
    valid = bool(observations)
    previous_percent = previous_pages = 0
    total = None
    phases = []
    for item in observations:
        phase = item.get("phase")
        percent, pages, count = (item.get(key) for key in ("percent", "completed_pages", "total_pages"))
        valid &= phase in ("initializing", "extracting", "assembling", "finalizing", "done")
        valid &= type(percent) is int and previous_percent <= percent <= 100
        valid &= type(pages) is int and pages >= previous_pages
        valid &= count is None or (type(count) is int and 1 <= count <= MAX_PAGES and pages <= count)
        valid &= total is None or count == total
        previous_percent, previous_pages = percent, pages
        if count is not None:
            total = count
        if phase not in phases:
            phases.append(phase)
    valid &= bool(observations) and observations[-1].get("phase") == ("done" if terminal else "finalizing") and (previous_percent == 100 if terminal else previous_percent < 100)
    valid &= total is not None and previous_pages == total
    return {"progress_valid": bool(valid), "progress_observations": len(observations),
            "progress_phases": phases, "completed_pages": previous_pages, "total_pages": total}


def run_child(pdf: Path, cancel_after: float | None = None) -> dict:
    with tempfile.TemporaryDirectory() as tmp:
        out = Path(tmp) / "out.json"
        telemetry = Path(tmp) / "progress.json"
        observations = []
        start = time.monotonic()
        proc = subprocess.Popen(
            [sys.executable, "-m", "app.extract", str(pdf), str(out), "--max-pages", str(MAX_PAGES), "--progress", str(telemetry)],
            cwd=ROOT,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
            start_new_session=True,
        )
        timed_out = cancelled = False
        deadline = start + (cancel_after if cancel_after is not None else TIMEOUT)
        reaped = None
        while reaped is None and time.monotonic() < deadline:
            if telemetry.exists():
                try:
                    item = json.loads(telemetry.read_text())
                    if not observations or observations[-1] != item:
                        observations.append(item)
                except (OSError, ValueError):
                    pass
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
        if telemetry.exists():
            try:
                item = json.loads(telemetry.read_text())
                if not observations or observations[-1] != item:
                    observations.append(item)
            except (OSError, ValueError):
                pass
        blocks = len(json.loads(out.read_text())["blocks"]) if out.exists() else None
        return {
            "fixture": pdf.stem,
            **progress_summary(observations, terminal=False),
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


def container_value(container: str, name: str) -> str:
    return subprocess.run(["docker", "exec", container, "cat", f"/sys/fs/cgroup/{name}"], capture_output=True, text=True, check=True).stdout.strip()


def api(base: str, method: str, path: str, body: bytes | None = None, headers: dict[str, str] | None = None) -> tuple[int, dict]:
    import urllib.error
    import urllib.request

    request = urllib.request.Request(f"{base}/api/pdf-import{path}", data=body, method=method, headers=headers or {})
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            raw = response.read()
            return response.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as error:
        raw = error.read()
        try:
            return error.code, json.loads(raw)
        except ValueError:
            return error.code, {}


def upload(base: str, pdf: Path) -> tuple[int, dict]:
    boundary = "benchmark-boundary"
    body = (
        f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"cv.pdf\"\r\nContent-Type: application/pdf\r\n\r\n".encode()
        + pdf.read_bytes()
        + f"\r\n--{boundary}--\r\n".encode()
    )
    return api(base, "POST", "/jobs", body, {"Content-Type": f"multipart/form-data; boundary={boundary}"})


def api_convert(base: str, pdf: Path, delete: bool = True) -> dict:
    start = time.monotonic()
    observations = []
    status, job = upload(base, pdf)
    if status != 202:
        return {"fixture": pdf.stem, "http": status, "error": job.get("error")}
    while job.get("status") == "processing" and time.monotonic() - start < TIMEOUT + 10:
        time.sleep(0.5)
        status, job = api(base, "GET", f"/jobs/{job['id']}?progress=1")
        if isinstance(job.get("progress"), dict):
            observations.append(job["progress"])
    run = {
        "fixture": pdf.stem,
        **progress_summary(observations),
        "seconds": round(time.monotonic() - start, 2),
        "status": job.get("status"),
        "error": job.get("error"),
        "blocks": len((job.get("result") or {}).get("blocks", [])),
        "id": job.get("id"),
    }
    if delete and run["id"]:
        api(base, "DELETE", f"/jobs/{run['id']}")
    return run


def conversion_passes(run: dict) -> bool:
    return (run.get("status") == "completed" and bool(run.get("blocks"))
            and run.get("seconds", TIMEOUT + 1) <= TIMEOUT and run.get("progress_valid") is True)


MEMORY_LIMIT = 2_750_000_000
PAGE_BYTES = 4096


def limits_valid(limits: dict) -> bool:
    """The kernel rounds memory.max down to whole pages; allow exactly that."""
    memory = limits.get("memory.max", "")
    return (memory.isdigit() and MEMORY_LIMIT // PAGE_BYTES * PAGE_BYTES <= int(memory) <= MEMORY_LIMIT
            and limits.get("memory.swap.max") == "0" and limits.get("cpu.max") == "200000 100000")


def api_main(base: str, container: str, repeat: int, out: Path) -> int:
    runs = []
    for round_ in range(repeat):
        for name in CV_FIXTURES:
            run = api_convert(base, FIXTURES / f"{name}.pdf")
            run.pop("id", None)
            run["round"] = round_ + 1
            run["memory_current_after"] = int(container_value(container, "memory.current"))
            runs.append(run)
            print(json.dumps(run), flush=True)

    # Retained result: not deleted, so only the TTL removes it.
    kept = api_convert(base, FIXTURES / "en_single.pdf", delete=False)
    done_at = time.monotonic()
    expired_after = None
    while time.monotonic() - done_at < 700:
        status, _ = api(base, "GET", f"/jobs/{kept['id']}")
        if status == 404:
            expired_after = round(time.monotonic() - done_at, 1)
            break
        time.sleep(1)
    print(json.dumps({"retained_result_expired_after_seconds": expired_after}), flush=True)

    # Cancellation mid-conversion.
    status, job = upload(base, FIXTURES / "five_page.pdf")
    time.sleep(4)
    cancel_status, _ = api(base, "DELETE", f"/jobs/{job['id']}")
    time.sleep(1)
    _, health = api(base, "GET", "/health")
    after_cancel = int(container_value(container, "memory.current"))
    print(json.dumps({"cancel_http": cancel_status, "busy_after_cancel": health.get("busy"), "memory_after_cancel": after_cancel}), flush=True)

    events = dict(line.split(" ", 1) for line in container_value(container, "memory.events").splitlines())
    peak = int(container_value(container, "memory.peak"))
    failures = [r for r in runs if not conversion_passes(r)]
    limits = {name: container_value(container, name) for name in ("memory.max", "memory.swap.max", "cpu.max")}
    configured_limits = limits_valid(limits)
    report = {
        "configured_limits_valid": configured_limits,
        "limits": {
            "memory_max": container_value(container, "memory.max"),
            "swap_max": container_value(container, "memory.swap.max"),
            "cpu_max": container_value(container, "cpu.max"),
        },
        "cgroup_peak_bytes": peak,
        "peak_limit_bytes": PEAK_LIMIT,
        "oom_kills": int(events.get("oom_kill", "0")),
        "slowest_seconds": max(r.get("seconds", 0) for r in runs),
        "retained_result_expired_after_seconds": expired_after,
        "busy_after_cancel": health.get("busy"),
        "memory_after_cancel_bytes": after_cancel,
        "runs": runs,
        "passed": configured_limits and peak < PEAK_LIMIT and int(events.get("oom_kill", "0")) == 0 and not failures
        and expired_after is not None and health.get("busy") is False and cancel_status == 204,
    }
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, indent=2))
    print(json.dumps({k: v for k, v in report.items() if k != "runs"}, indent=2))
    return 0 if report["passed"] else 1


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repeat", type=int, default=2, help="cold conversions per fixture")
    parser.add_argument("--out", type=Path, default=ROOT / "bench-results" / "benchmark.json")
    parser.add_argument("--api", help="base URL of a running deployment")
    parser.add_argument("--container", help="pdf-import container name (with --api)")
    args = parser.parse_args()
    if args.api:
        if not args.container:
            parser.error("--api needs --container")
        return api_main(args.api.rstrip("/"), args.container, args.repeat, args.out)

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
    failures = [r for r in conversions if r["exit"] != 0 or r["timed_out"] or not r["blocks"] or not r["progress_valid"] or r["seconds"] > TIMEOUT]
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
