"""FastAPI routes for /api/pdf-import.

The upload is parsed as a stream so the slot is reserved and the size limit is
enforced before the body is buffered anywhere. Nothing here logs CV text,
filenames or job IDs (run uvicorn with --no-access-log: paths contain IDs).
"""

from __future__ import annotations

import os
import re
import shutil
from collections.abc import AsyncIterator, Callable
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request, Response
from fastapi.responses import JSONResponse
from python_multipart.multipart import MultipartParser, parse_options_header
from starlette.requests import ClientDisconnect

from .jobs import Busy, Command, Job, JobManager, job_error
from .models import ErrorCode, Health, Limits
from .settings import Settings

PREFIX = "/api/pdf-import"
# Multipart framing around a single file part; anything bigger is not one PDF.
MULTIPART_OVERHEAD = 16 * 1024
JOB_ID = re.compile(r"^[A-Za-z0-9_-]{43}$")
STATUS: dict[ErrorCode, int] = {"invalid_file": 400, "too_large": 413, "busy": 429, "not_found": 404}


class UploadRejected(Exception):
    def __init__(self, code: ErrorCode) -> None:
        self.code = code


def error_response(code: ErrorCode, headers: dict[str, str] | None = None) -> JSONResponse:
    body = {"contract_version": 1, "error": job_error(code).model_dump()}
    return JSONResponse(body, status_code=STATUS.get(code, 400), headers=headers)


def default_ready() -> bool:
    artifacts = os.environ.get("DOCLING_ARTIFACTS_PATH")
    return shutil.which("tesseract") is not None and (not artifacts or Path(artifacts).is_dir())


async def receive_pdf(request: Request, job: Job, max_bytes: int) -> None:
    """Streams the multipart body, writing only the `file` part to disk."""
    content_type, options = parse_options_header(request.headers.get("content-type", ""))
    boundary = options.get(b"boundary")
    if content_type != b"multipart/form-data" or not boundary:
        raise UploadRejected("invalid_file")
    body_limit = max_bytes + MULTIPART_OVERHEAD
    declared = request.headers.get("content-length")
    if declared and declared.isdigit() and int(declared) > body_limit:
        raise UploadRejected("too_large")

    state = {"field": b"", "value": b"", "name": None, "is_file": False, "written": 0, "files": 0}
    sink = job.upload_path.open("wb")

    def on_part_begin() -> None:
        state["name"] = None

    def on_header_field(data: bytes, start: int, end: int) -> None:
        state["field"] += data[start:end]

    def on_header_value(data: bytes, start: int, end: int) -> None:
        state["value"] += data[start:end]

    def on_header_end() -> None:
        if state["field"].lower() == b"content-disposition":
            _, params = parse_options_header(state["value"])
            state["name"] = params.get(b"name")
        state["field"] = state["value"] = b""

    def on_headers_finished() -> None:
        state["is_file"] = state["name"] == b"file"
        if state["is_file"]:
            state["files"] += 1
            if state["files"] > 1:
                raise UploadRejected("invalid_file")

    def on_part_data(data: bytes, start: int, end: int) -> None:
        if not state["is_file"]:
            return
        state["written"] += end - start
        if state["written"] > max_bytes:
            raise UploadRejected("too_large")
        sink.write(data[start:end])

    parser = MultipartParser(
        boundary,
        {
            "on_part_begin": on_part_begin,
            "on_header_field": on_header_field,
            "on_header_value": on_header_value,
            "on_header_end": on_header_end,
            "on_headers_finished": on_headers_finished,
            "on_part_data": on_part_data,
        },
    )
    received = 0
    try:
        async for chunk in request.stream():
            received += len(chunk)
            if received > body_limit:
                raise UploadRejected("too_large")
            try:
                parser.write(chunk)
            except UploadRejected:
                raise
            except Exception as error:
                raise UploadRejected("invalid_file") from error
        parser.finalize()
    finally:
        sink.close()

    if state["files"] != 1 or state["written"] == 0:
        raise UploadRejected("invalid_file")
    with job.upload_path.open("rb") as handle:
        if not handle.read(1024).lstrip().startswith(b"%PDF-"):
            raise UploadRejected("invalid_file")


def create_app(
    settings: Settings | None = None,
    command: Command | None = None,
    ready: Callable[[], bool] | None = None,
) -> FastAPI:
    settings = settings or Settings.from_env()
    manager = JobManager(settings, command)
    is_ready = ready or default_ready

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        await manager.start()
        try:
            yield
        finally:
            await manager.stop()

    app = FastAPI(lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)
    app.state.manager = manager

    @app.middleware("http")
    async def private_responses(request: Request, call_next):
        response = await call_next(request)
        response.headers["Cache-Control"] = "no-store"
        response.headers["X-Content-Type-Options"] = "nosniff"
        return response

    @app.get(f"{PREFIX}/health")
    async def health() -> JSONResponse:
        body = Health(
            ready=is_ready(),
            busy=manager.busy,
            limits=Limits(max_bytes=settings.max_bytes, max_pages=settings.max_pages, timeout_seconds=int(settings.timeout_seconds)),
        )
        return JSONResponse(body.model_dump(), status_code=200 if body.ready else 503)

    @app.post(f"{PREFIX}/jobs")
    async def create_job(request: Request) -> Response:
        try:
            job = manager.reserve()
        except Busy:
            return error_response("busy", {"Retry-After": str(settings.retry_after_seconds)})
        try:
            await receive_pdf(request, job, settings.max_bytes)
        except UploadRejected as rejected:
            manager.release(job)
            return error_response(rejected.code)
        except ClientDisconnect:
            manager.release(job)
            return Response(status_code=400)
        except BaseException:
            manager.release(job)
            raise
        manager.launch(job)
        return JSONResponse(job.to_status().model_dump(exclude={"progress"}), status_code=202)

    @app.get(f"{PREFIX}/jobs/{{job_id}}")
    async def get_job(job_id: str, progress: str | None = None) -> Response:
        job = manager.get(job_id) if JOB_ID.match(job_id) else None
        if job is None:
            return error_response("not_found")
        return JSONResponse(job.to_status().model_dump(exclude=set() if progress == "1" else {"progress"}))

    @app.delete(f"{PREFIX}/jobs/{{job_id}}")
    async def delete_job(job_id: str) -> Response:
        if not JOB_ID.match(job_id) or not await manager.cancel(job_id):
            return error_response("not_found")
        return Response(status_code=204)

    return app


app = create_app()
