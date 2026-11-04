"""HTTP contract for /api/pdf-import, with the fake extractor standing in for Docling."""

from __future__ import annotations

import json
import logging
import time
from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.models import Extraction, Health, JobStatus
from app.settings import Settings
from tests.conftest import PDF, fake_command

BASE = "/api/pdf-import"
CONTRACT = Path(__file__).parent / "fixtures" / "contract"


def make_client(settings: Settings, mode: str = "ok", ready: bool = True) -> TestClient:
    return TestClient(create_app(settings, command=fake_command(mode), ready=lambda: ready))


@pytest.fixture
def client(settings: Settings) -> Iterator[TestClient]:
    with make_client(settings) as c:
        yield c


def upload(client: TestClient, data: bytes | None = None, name: str = "cv.pdf", field: str = "file"):
    body = (PDF / "en_single.pdf").read_bytes() if data is None else data
    return client.post(f"{BASE}/jobs", files={field: (name, body, "application/pdf")})


def poll(client: TestClient, job_id: str) -> dict:
    for _ in range(200):
        body = client.get(f"{BASE}/jobs/{job_id}").json()
        if body["status"] != "processing":
            return body
        time.sleep(0.05)
    raise AssertionError("job did not finish")


def files_in(path: Path) -> list[Path]:
    return [p for p in path.rglob("*") if p.is_file()]


class TestHealth:
    def test_reports_contract_and_limits(self, client: TestClient) -> None:
        response = client.get(f"{BASE}/health")
        assert response.status_code == 200
        health = Health.model_validate(response.json())
        assert health.ready and not health.busy
        assert (health.limits.max_bytes, health.limits.max_pages, health.limits.timeout_seconds) == (10 * 1024 * 1024, 5, 5)

    def test_not_ready_is_503(self, settings: Settings) -> None:
        with make_client(settings, ready=False) as c:
            response = c.get(f"{BASE}/health")
        assert response.status_code == 503
        assert response.json()["ready"] is False


class TestJobs:
    def test_upload_poll_and_delete(self, client: TestClient, settings: Settings) -> None:
        response = upload(client)
        assert response.status_code == 202
        assert response.headers["cache-control"] == "no-store"
        created = JobStatus.model_validate(response.json())
        assert created.status == "processing" and len(created.id) >= 32

        done = JobStatus.model_validate(poll(client, created.id))
        assert done.status == "completed" and done.result is not None
        assert client.get(f"{BASE}/jobs/{created.id}").headers["cache-control"] == "no-store"

        assert client.delete(f"{BASE}/jobs/{created.id}").status_code == 204
        gone = client.get(f"{BASE}/jobs/{created.id}")
        assert gone.status_code == 404
        assert gone.json()["error"] == {"code": "not_found", "retryable": True}
        assert files_in(settings.work_dir) == []

    def test_failed_conversion_reports_code(self, settings: Settings) -> None:
        with make_client(settings, mode="exit:11") as c:
            job_id = upload(c).json()["id"]
            body = poll(c, job_id)
        assert body["status"] == "failed"
        assert body["error"] == {"code": "encrypted", "retryable": False}

    def test_busy_slot_returns_429_with_retry_after(self, settings: Settings) -> None:
        with make_client(settings, mode="slow") as c:
            assert upload(c).status_code == 202
            second = upload(c)
            assert second.status_code == 429
            assert int(second.headers["retry-after"]) > 0
            assert second.json()["error"] == {"code": "busy", "retryable": True}
            assert c.get(f"{BASE}/health").json()["busy"] is True

    def test_unknown_or_malformed_ids_are_404(self, client: TestClient) -> None:
        for job_id in ["x" * 43, "../../etc/passwd", "short"]:
            response = client.get(f"{BASE}/jobs/{job_id}")
            assert response.status_code == 404
        assert client.delete(f"{BASE}/jobs/{'x' * 43}").status_code == 404

    def test_there_is_no_job_listing(self, client: TestClient) -> None:
        assert client.get(f"{BASE}/jobs").status_code in (404, 405)


class TestUploadValidation:
    def test_rejects_non_pdf_bytes_and_frees_the_slot(self, client: TestClient, settings: Settings) -> None:
        response = upload(client, (PDF / "not_a_pdf.pdf").read_bytes())
        assert response.status_code == 400
        assert response.json()["error"] == {"code": "invalid_file", "retryable": False}
        assert files_in(settings.work_dir) == []
        assert upload(client).status_code == 202

    def test_rejects_missing_file_field(self, client: TestClient) -> None:
        response = upload(client, field="document")
        assert response.status_code == 400
        assert response.json()["error"]["code"] == "invalid_file"

    def test_rejects_non_multipart_body(self, client: TestClient) -> None:
        response = client.post(f"{BASE}/jobs", content=(PDF / "en_single.pdf").read_bytes(), headers={"content-type": "application/pdf"})
        assert response.status_code == 400
        assert response.json()["error"]["code"] == "invalid_file"

    def test_rejects_oversized_file_while_streaming(self, tmp_path: Path) -> None:
        settings = Settings(work_dir=tmp_path / "work", max_bytes=4096)
        with make_client(settings) as c:
            response = upload(c, b"%PDF-1.7\n" + b"0" * 5000)
            assert response.status_code == 413
            assert response.json()["error"] == {"code": "too_large", "retryable": False}
            assert files_in(settings.work_dir) == []
            assert c.get(f"{BASE}/health").json()["busy"] is False

    def test_rejects_declared_oversized_body_before_reading(self, tmp_path: Path) -> None:
        settings = Settings(work_dir=tmp_path / "work", max_bytes=4096)
        with make_client(settings) as c:
            response = c.post(
                f"{BASE}/jobs",
                content=b"x",
                headers={"content-type": "multipart/form-data; boundary=abc", "content-length": str(10_000_000)},
            )
        assert response.status_code == 413

    def test_does_not_log_cv_content_names_or_ids(self, client: TestClient, caplog: pytest.LogCaptureFixture) -> None:
        caplog.set_level(logging.DEBUG)
        job_id = upload(client, name="Secret Person CV.pdf").json()["id"]
        poll(client, job_id)
        client.delete(f"{BASE}/jobs/{job_id}")
        # httpx (the test client) logs its own request URLs; only server-side loggers count.
        server_log = "\n".join(r.getMessage() for r in caplog.records if not r.name.startswith("httpx"))
        assert job_id not in server_log
        assert "Secret Person" not in server_log
        assert "Jane Doe" not in server_log


class TestSettings:
    def test_defaults_match_the_plan(self) -> None:
        settings = Settings.from_env({})
        assert settings.max_bytes == 10 * 1024 * 1024
        assert settings.max_pages == 5
        assert settings.timeout_seconds == 180
        assert settings.result_ttl_seconds == 600
        assert settings.memory_limit_bytes == 2_750_000_000
        assert settings.cpu_limit == 2

    def test_reads_environment(self) -> None:
        settings = Settings.from_env({"PDF_IMPORT_MAX_PAGES": "3", "PDF_IMPORT_WORK_DIR": "/tmp/x"})
        assert settings.max_pages == 3 and settings.work_dir == Path("/tmp/x")

    @pytest.mark.parametrize(
        "env",
        [
            {"PDF_IMPORT_MAX_BYTES": "abc"},
            {"PDF_IMPORT_MAX_BYTES": "0"},
            {"PDF_IMPORT_MAX_PAGES": "-1"},
            {"PDF_IMPORT_TIMEOUT_SECONDS": "100000"},
            {"PDF_IMPORT_RESULT_TTL_SECONDS": "601"},
            {"PDF_IMPORT_CPU_LIMIT": "3"},
            {"PDF_IMPORT_MEMORY_LIMIT_BYTES": "100"},
        ],
    )
    def test_rejects_invalid_values(self, env: dict[str, str]) -> None:
        with pytest.raises(ValueError):
            Settings.from_env(env)


class TestContractFixtures:
    """The same files are validated by src/lib/io/pdf/validate.test.ts."""

    def test_valid_fixtures_parse(self) -> None:
        valid = sorted((CONTRACT / "valid").glob("*.json"))
        assert valid
        for path in valid:
            data = json.loads(path.read_text())
            model = {"health": Health, "extraction": Extraction}.get(path.stem.split("_")[0], JobStatus)
            model.model_validate(data)

    def test_invalid_fixtures_are_rejected(self) -> None:
        invalid = sorted((CONTRACT / "invalid").glob("*.json"))
        assert invalid
        for path in invalid:
            with pytest.raises(ValueError):
                JobStatus.model_validate(json.loads(path.read_text()))
