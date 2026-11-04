"""Admission, status, expiry and cleanup for conversions.

One global slot, reserved before the upload is read. Each conversion is a child
process in its own process group; timeout, cancellation and shutdown kill the
whole group and wait for it before the slot is released. Job state lives only
in this process's memory: after a restart every old ID is simply unknown.
"""

from __future__ import annotations

import asyncio
import contextlib
import os
import secrets
import shutil
import signal
import sys
import time
from collections.abc import Callable
from dataclasses import dataclass, field
from pathlib import Path
from typing import Literal

from .models import EXIT_CODES, RETRYABLE, ErrorCode, Extraction, JobError, JobStatus
from .settings import Settings

Command = Callable[[Path, Path], list[str]]


class Busy(Exception):
    """The single conversion slot is taken."""


def extractor_command(settings: Settings) -> Command:
    return lambda source, target: [sys.executable, "-m", "app.extract", str(source), str(target), "--max-pages", str(settings.max_pages)]


def job_error(code: ErrorCode) -> JobError:
    return JobError(code=code, retryable=code in RETRYABLE)


@dataclass(eq=False)
class Job:
    id: str
    dir: Path
    status: Literal["processing", "completed", "failed"] = "processing"
    stage: Literal["queued", "extracting", "done"] | None = "queued"
    result: Extraction | None = None
    error: JobError | None = None
    expires_at: float | None = None
    cancel_requested: bool = False
    process: asyncio.subprocess.Process | None = field(default=None, repr=False)
    task: asyncio.Task[None] | None = field(default=None, repr=False)

    @property
    def upload_path(self) -> Path:
        return self.dir / "upload.pdf"

    def to_status(self) -> JobStatus:
        return JobStatus(id=self.id, status=self.status, stage=self.stage, result=self.result, error=self.error)


def kill_group(process: asyncio.subprocess.Process) -> None:
    with contextlib.suppress(ProcessLookupError, PermissionError):
        os.killpg(process.pid, signal.SIGKILL)


class JobManager:
    def __init__(self, settings: Settings, command: Command | None = None) -> None:
        self.settings = settings
        self.command = command or extractor_command(settings)
        self.jobs: dict[str, Job] = {}
        self.active: Job | None = None
        self._sweeper: asyncio.Task[None] | None = None

    @property
    def busy(self) -> bool:
        return self.active is not None

    @property
    def job_count(self) -> int:
        return len(self.jobs)

    async def start(self) -> None:
        work = self.settings.work_dir
        work.mkdir(parents=True, exist_ok=True)
        for entry in work.iterdir():
            if entry.is_dir() and not entry.is_symlink():
                shutil.rmtree(entry, ignore_errors=True)
            else:
                entry.unlink(missing_ok=True)
        self._sweeper = asyncio.create_task(self._sweep())

    async def stop(self) -> None:
        if self._sweeper:
            self._sweeper.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self._sweeper
        for job_id in list(self.jobs):
            await self.cancel(job_id)

    def reserve(self) -> Job:
        if self.active is not None:
            raise Busy
        job_dir = self.settings.work_dir / secrets.token_hex(16)
        job_dir.mkdir(mode=0o700)
        job = Job(id=secrets.token_urlsafe(32), dir=job_dir)
        self.jobs[job.id] = job
        self.active = job
        return job

    def release(self, job: Job) -> None:
        """Gives back a slot whose upload never became a conversion."""
        shutil.rmtree(job.dir, ignore_errors=True)
        self.jobs.pop(job.id, None)
        if self.active is job:
            self.active = None

    def launch(self, job: Job) -> None:
        job.stage = "extracting"
        job.task = asyncio.create_task(self._run(job))

    def get(self, job_id: str) -> Job | None:
        job = self.jobs.get(job_id)
        if job and job.expires_at is not None and job.expires_at <= time.monotonic():
            self.jobs.pop(job_id, None)
            return None
        return job

    async def cancel(self, job_id: str) -> bool:
        job = self.jobs.get(job_id)
        if job is None:
            return False
        job.cancel_requested = True
        if job.process is not None:
            kill_group(job.process)
        if job.task is not None:
            await asyncio.shield(job.task)
        elif self.active is job:
            self.release(job)
        self.jobs.pop(job_id, None)
        return True

    async def _run(self, job: Job) -> None:
        target = job.dir / "out.json"
        try:
            if job.cancel_requested:
                self._finish(job, error="cancelled")
                return
            process = await asyncio.create_subprocess_exec(
                *self.command(job.upload_path, target),
                stdin=asyncio.subprocess.DEVNULL,
                stdout=asyncio.subprocess.DEVNULL,
                stderr=asyncio.subprocess.DEVNULL,
                start_new_session=True,
            )
            job.process = process
            if job.cancel_requested:
                kill_group(process)
            try:
                code = await asyncio.wait_for(process.wait(), self.settings.timeout_seconds)
            except TimeoutError:
                kill_group(process)
                await process.wait()
                self._finish(job, error="timeout")
                return
            # Reap anything the child left behind in its group (e.g. tesseract).
            kill_group(process)
            if job.cancel_requested:
                self._finish(job, error="cancelled")
            elif code == 0:
                self._complete(job, target)
            else:
                self._finish(job, error=EXIT_CODES.get(code, "conversion_failed"))
        except Exception:
            if job.process is not None:
                kill_group(job.process)
                await job.process.wait()
            self._finish(job, error="conversion_failed")
        finally:
            shutil.rmtree(job.dir, ignore_errors=True)
            if self.active is job:
                self.active = None

    def _complete(self, job: Job, target: Path) -> None:
        try:
            result = Extraction.model_validate_json(target.read_bytes())
        except (OSError, ValueError):
            self._finish(job, error="conversion_failed")
            return
        if not result.blocks:
            self._finish(job, error="empty_extraction")
            return
        job.result = result
        self._finish(job)

    def _finish(self, job: Job, error: ErrorCode | None = None) -> None:
        job.process = None
        job.status = "failed" if error else "completed"
        job.stage = "done" if not error else None
        job.error = job_error(error) if error else None
        job.expires_at = time.monotonic() + self.settings.result_ttl_seconds

    async def _sweep(self) -> None:
        while True:
            await asyncio.sleep(self.settings.sweep_interval_seconds)
            now = time.monotonic()
            for job_id, job in list(self.jobs.items()):
                if job.expires_at is not None and job.expires_at <= now:
                    self.jobs.pop(job_id, None)
