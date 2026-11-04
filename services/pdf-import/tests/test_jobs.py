"""Conversion lifecycle: one slot, child process groups, timeout, cancel, expiry."""

from __future__ import annotations

import asyncio
from pathlib import Path

import pytest

from app.jobs import Busy, JobManager
from app.settings import Settings
from tests.conftest import PDF, alive, fake_command, read_pids

pytestmark = pytest.mark.anyio


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


async def run_job(manager: JobManager, fixture: str = "en_single") -> str:
    job = manager.reserve()
    job.upload_path.write_bytes((PDF / f"{fixture}.pdf").read_bytes())
    manager.launch(job)
    return job.id


async def wait_done(manager: JobManager, job_id: str, limit: float = 10) -> None:
    for _ in range(int(limit / 0.05)):
        job = manager.get(job_id)
        if job is None or job.status != "processing":
            return
        await asyncio.sleep(0.05)
    raise AssertionError("job did not finish")


def files_in(path: Path) -> list[Path]:
    return [p for p in path.rglob("*") if p.is_file()]


async def wait_for_pids(pid_file: Path, count: int) -> list[int]:
    for _ in range(100):
        pids = read_pids(pid_file)
        if len(pids) >= count:
            return pids
        await asyncio.sleep(0.05)
    raise AssertionError("fake extractor never started")


async def test_completes_and_deletes_the_upload(settings: Settings) -> None:
    manager = JobManager(settings, fake_command("ok"))
    await manager.start()
    try:
        job_id = await run_job(manager)
        await wait_done(manager, job_id)
        job = manager.get(job_id)
        assert job is not None and job.status == "completed" and job.stage == "done"
        assert job.result is not None and job.result.blocks[0].text == "Jane Doe"
        assert files_in(settings.work_dir) == []
        assert not manager.busy
    finally:
        await manager.stop()


async def test_one_slot_is_reserved_before_upload(settings: Settings) -> None:
    manager = JobManager(settings, fake_command("slow"))
    await manager.start()
    try:
        first = manager.reserve()
        with pytest.raises(Busy):
            manager.reserve()
        first.upload_path.write_bytes(b"%PDF-1.7")
        manager.launch(first)
        with pytest.raises(Busy):
            manager.reserve()
        await wait_done(manager, first.id)
        manager.release(manager.reserve())
    finally:
        await manager.stop()


async def test_abandoned_upload_releases_slot_and_file(settings: Settings) -> None:
    manager = JobManager(settings, fake_command("ok"))
    await manager.start()
    try:
        job = manager.reserve()
        job.upload_path.write_bytes(b"partial")
        manager.release(job)
        assert not manager.busy
        assert manager.get(job.id) is None
        assert files_in(settings.work_dir) == []
    finally:
        await manager.stop()


@pytest.mark.parametrize(
    ("mode", "code", "retryable"),
    [
        ("exit:10", "invalid_file", False),
        ("exit:11", "encrypted", False),
        ("exit:12", "too_many_pages", False),
        ("exit:13", "empty_extraction", False),
        ("empty", "empty_extraction", False),
        ("exit:1", "conversion_failed", True),
        ("exit:-9", "conversion_failed", True),
        ("garbage", "conversion_failed", True),
    ],
)
async def test_maps_child_failures_to_stable_codes(settings: Settings, mode: str, code: str, retryable: bool) -> None:
    manager = JobManager(settings, fake_command(mode))
    await manager.start()
    try:
        job_id = await run_job(manager)
        await wait_done(manager, job_id)
        job = manager.get(job_id)
        assert job is not None and job.status == "failed"
        assert job.error is not None and (job.error.code, job.error.retryable) == (code, retryable)
        assert files_in(settings.work_dir) == []
        assert not manager.busy
    finally:
        await manager.stop()


async def test_timeout_kills_the_whole_process_group(tmp_path: Path, pid_file: Path) -> None:
    settings = Settings(work_dir=tmp_path / "work", timeout_seconds=1)
    manager = JobManager(settings, fake_command("hang"))
    await manager.start()
    try:
        job_id = await run_job(manager)
        pids = await wait_for_pids(pid_file, 2)
        await wait_done(manager, job_id, limit=5)
        job = manager.get(job_id)
        assert job is not None and job.error is not None and job.error.code == "timeout" and job.error.retryable
        assert not any(alive(pid) for pid in pids)
        assert files_in(settings.work_dir) == []
        assert not manager.busy
    finally:
        await manager.stop()


async def test_cancel_terminates_before_releasing_the_slot(settings: Settings, pid_file: Path) -> None:
    manager = JobManager(settings, fake_command("hang"))
    await manager.start()
    try:
        job_id = await run_job(manager)
        pids = await wait_for_pids(pid_file, 2)
        assert await manager.cancel(job_id) is True
        assert not any(alive(pid) for pid in pids)
        assert not manager.busy
        assert manager.get(job_id) is None
        assert files_in(settings.work_dir) == []
    finally:
        await manager.stop()


async def test_cancel_racing_launch_leaves_no_process(settings: Settings, pid_file: Path) -> None:
    manager = JobManager(settings, fake_command("hang"))
    await manager.start()
    try:
        job_id = await run_job(manager)
        assert await manager.cancel(job_id) is True
        await asyncio.sleep(0.5)
        assert not any(alive(pid) for pid in read_pids(pid_file))
        assert not manager.busy
        assert files_in(settings.work_dir) == []
    finally:
        await manager.stop()


async def test_cancel_unknown_job_is_false(settings: Settings) -> None:
    manager = JobManager(settings, fake_command("ok"))
    await manager.start()
    try:
        assert await manager.cancel("nope") is False
    finally:
        await manager.stop()


async def test_cancel_removes_a_retained_result(settings: Settings) -> None:
    manager = JobManager(settings, fake_command("ok"))
    await manager.start()
    try:
        job_id = await run_job(manager)
        await wait_done(manager, job_id)
        assert await manager.cancel(job_id) is True
        assert manager.get(job_id) is None
    finally:
        await manager.stop()


async def test_results_expire_after_the_ttl(tmp_path: Path) -> None:
    settings = Settings(work_dir=tmp_path / "work", result_ttl_seconds=0.3, sweep_interval_seconds=0.1)
    manager = JobManager(settings, fake_command("ok"))
    await manager.start()
    try:
        job_id = await run_job(manager)
        await wait_done(manager, job_id)
        assert manager.get(job_id) is not None
        await asyncio.sleep(0.6)
        assert manager.get(job_id) is None
        assert manager.job_count == 0
    finally:
        await manager.stop()


async def test_startup_removes_abandoned_files(settings: Settings) -> None:
    settings.work_dir.mkdir(parents=True)
    (settings.work_dir / "stale.pdf").write_bytes(b"old upload")
    (settings.work_dir / "nested").mkdir()
    (settings.work_dir / "nested" / "out.json").write_text("{}")
    manager = JobManager(settings, fake_command("ok"))
    await manager.start()
    try:
        assert list(settings.work_dir.iterdir()) == []
    finally:
        await manager.stop()


async def test_stop_kills_a_running_conversion(settings: Settings, pid_file: Path) -> None:
    manager = JobManager(settings, fake_command("hang"))
    await manager.start()
    await run_job(manager)
    pids = await wait_for_pids(pid_file, 2)
    await manager.stop()
    assert not any(alive(pid) for pid in pids)


async def test_job_ids_are_unguessable(settings: Settings) -> None:
    manager = JobManager(settings, fake_command("ok"))
    await manager.start()
    try:
        ids = set()
        for _ in range(20):
            job = manager.reserve()
            ids.add(job.id)
            manager.release(job)
        assert len(ids) == 20
        assert all(len(i) >= 32 for i in ids)
    finally:
        await manager.stop()
