# Optional PDF extraction backend. CPU-only; models are baked in at build time
# so a conversion never reaches an external service.
FROM ghcr.io/astral-sh/uv:0.9-python3.12-bookworm-slim AS base
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 \
    UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_PYTHON_DOWNLOADS=never \
    OMP_NUM_THREADS=2 MKL_NUM_THREADS=2 OPENBLAS_NUM_THREADS=2 \
    HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1 \
    DOCLING_ARTIFACTS_PATH=/opt/docling-models \
    TESSDATA_PREFIX=/usr/share/tesseract-ocr/5/tessdata
RUN apt-get update \
 && apt-get install -y --no-install-recommends tesseract-ocr tesseract-ocr-eng tesseract-ocr-ind libgl1 libglib2.0-0 \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM base AS deps
COPY pyproject.toml uv.lock ./
RUN --mount=type=cache,target=/root/.cache/uv uv sync --locked --no-dev
ENV PATH=/app/.venv/bin:$PATH
# Layout model only: table structure, picture enrichment and EasyOCR stay off.
RUN HF_HUB_OFFLINE=0 docling-tools models download layout -o /opt/docling-models \
 && chmod -R a+rX /opt/docling-models

FROM deps AS test
RUN --mount=type=cache,target=/root/.cache/uv uv sync --locked
COPY . .
CMD ["pytest", "-q"]

FROM deps AS runtime
COPY app ./app
RUN useradd --system --uid 10001 --no-create-home app \
 && mkdir -p /tmp/pdf-import && chown app /tmp/pdf-import
USER app
ENV PDF_IMPORT_WORK_DIR=/tmp/pdf-import
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
