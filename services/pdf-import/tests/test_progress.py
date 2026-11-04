"""Measured milestones and backward-compatible optional telemetry."""
import json
from pathlib import Path
from types import SimpleNamespace

import pytest

from app.extract import extract_pdf
from app.jobs import JobManager
from app.settings import Settings
from tests.conftest import PDF, fake_command
from tests.test_api import BASE, make_client, poll, upload


def test_callback_counts_completed_pages_not_page_numbers(tmp_path):
    from app.progress import ProgressWriter
    path = tmp_path / 'progress.json'
    writer = ProgressWriter(path, 5)
    for event, expected in [
        (dict(kind='phase_started', phase='build'), ('extracting', 12, 0)),
        (dict(kind='page_completed', completed_pages=1, total_pages=5, page_no=5, success=True), ('extracting', 25, 1)),
        (dict(kind='page_completed', completed_pages=1, total_pages=5, page_no=5, success=True), ('extracting', 25, 1)),
        (dict(kind='page_completed', completed_pages=0, total_pages=5, page_no=1, success=True), ('extracting', 25, 1)),
        (dict(kind='page_completed', completed_pages=5, total_pages=5, page_no=2, success=True), ('extracting', 75, 5)),
        (dict(kind='phase_started', phase='assemble'), ('assembling', 75, 5)),
        (dict(kind='phase_started', phase='enrich'), ('finalizing', 87, 5)),
        (dict(kind='document_completed'), ('finalizing', 87, 5)),
    ]:
        writer(SimpleNamespace(**event))
        data = json.loads(path.read_text())
        assert set(data) == {'phase', 'percent', 'completed_pages', 'total_pages'}
        assert (data['phase'], data['percent'], data['completed_pages']) == expected


@pytest.mark.docling
def test_real_docling_callback_writes_metadata_only(tmp_path):
    path = tmp_path / 'progress.json'
    result = extract_pdf(PDF / 'en_single.pdf', progress_path=path)
    assert result.blocks
    assert json.loads(path.read_text()) == dict(phase='finalizing', percent=75, completed_pages=1, total_pages=1)
    assert 'Jane' not in path.read_text()
    assert not list(tmp_path.glob('*.partial'))


def test_progress_is_opt_in_and_completed_survives_cleanup(settings):
    with make_client(settings) as client:
        created = upload(client).json()
        assert 'progress' not in created
        done = poll(client, created['id'])
        assert 'progress' not in done
        progress = client.get(f"{BASE}/jobs/{created['id']}?progress=1").json()['progress']
        assert progress == dict(phase='done', percent=100, completed_pages=1, total_pages=1)
        assert not list(settings.work_dir.rglob('*.json'))


def test_manager_retains_last_valid_progress_and_rejects_regression(settings):
    manager = JobManager(settings, fake_command('ok'))
    settings.work_dir.mkdir()
    job = manager.reserve()
    sidecar = job.dir / 'progress.json'
    assert manager.get(job.id).progress.percent == 0
    valid = dict(phase='extracting', percent=25, completed_pages=1, total_pages=5)
    sidecar.write_text(json.dumps(valid))
    assert manager.get(job.id).progress.model_dump() == valid
    for data in ['{', '{}', json.dumps({**valid, 'percent': 12, 'completed_pages': 0}), json.dumps({**valid, 'percent': 100})]:
        sidecar.write_text(data)
        assert manager.get(job.id).progress.model_dump() == valid
    manager.release(job)

@pytest.mark.anyio
async def test_failure_and_timeout_retain_progress_below_success(settings):
    from tests.test_jobs import run_job, wait_done
    for mode in ['exit:1', 'garbage', 'hang']:
        manager = JobManager(settings, fake_command(mode))
        await manager.start()
        try:
            job_id = await run_job(manager)
            job = manager.get(job_id)
            (job.dir / 'progress.json').write_text(json.dumps(dict(phase='finalizing', percent=75, completed_pages=1, total_pages=1)))
            await wait_done(manager, job_id)
            job = manager.get(job_id)
            assert job.status == 'failed'
            assert job.progress.percent == 75
            assert job.progress.phase == 'finalizing'
            assert not job.dir.exists()
        finally:
            await manager.stop()


def test_callback_does_not_regress_phase_on_delayed_events(tmp_path):
    from app.progress import ProgressWriter
    path = tmp_path / 'progress.json'
    writer = ProgressWriter(path, 1)
    writer(SimpleNamespace(kind='phase_started', phase='build'))
    writer(SimpleNamespace(kind='page_completed', completed_pages=1))
    writer(SimpleNamespace(kind='phase_started', phase='enrich'))
    writer(SimpleNamespace(kind='phase_started', phase='build'))
    assert json.loads(path.read_text())['phase'] == 'finalizing'

@pytest.fixture
def anyio_backend():
    return 'asyncio'
