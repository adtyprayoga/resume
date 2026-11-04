# PDF-Only Docling Import Implementation Plan

> **For agentic workers:** Use Superpowers executing-plans. Complete tasks sequentially with failing tests first.

**Goal:** Convert uploaded CV PDFs into editable resume drafts using local Docling extraction and deterministic field mapping.

**Architecture:** Keep the existing Svelte frontend at the repository root. Add an optional Python backend for PDF extraction. Map extracted content into the existing resume model in the browser, then require review before replacement.

**Tech stack:** Svelte 5, TypeScript, FastAPI, Docling standard pipeline, PDFium, Tesseract, Docker Compose, Vitest, pytest.

**Spec:** User-approved PDF-only import, no external AI API or generative model, editable review, and a 2.75 GB backend memory cap. Docling’s own pretrained layout and OCR models remain part of extraction.

## 1. Constraints and branch setup

- [ ] At execution time, fetch and create `codex/pdf-docling-import` from `origin/main`, preserving unrelated work.
- [ ] Save this plan to `docs/superpowers/plans/2026-11-04-pdf-docling-import.md`. Because `docs/` is ignored, explicitly add only this file when committing; retain the existing ignore policy.
- [ ] Preserve JSON import, document schema version 1, localStorage persistence, and Classic/ATS printing.
- [ ] Introduce no accounts, database, external AI service, or persistent CV storage.
- [ ] Exclude DOCX, PDF URLs, translation, rewriting, photo extraction, and new resume section types.
- [ ] Preserve static-only deployment. PDF import is optional and disabled by default.
- [ ] Do not push or deploy as part of implementation.

## 2. Intended folder structure

Root: `/home/adity/workspace/resume`

```text
resume/
├── src/
│   ├── components/
│   │   ├── ImportDialog.svelte        # Existing import entry point
│   │   ├── ImportDialog.svelte.test.ts
│   │   └── importing/
│   │       ├── PdfImportReview.svelte # Review coordinator and draft
│   │       ├── PdfReviewEntry.svelte  # Editable section entry
│   │       ├── PdfSourceText.svelte   # Source text and unmatched content
│   │       └── *.svelte.test.ts
│   ├── lib/io/pdf/
│   │   ├── types.ts / validate.ts / client.ts / mapper.ts / rules.ts / draft.ts / *.test.ts
│   └── styles/importing.css
├── services/pdf-import/
│   ├── app/{__init__,main,settings,models,jobs,extract}.py
│   ├── tests/{fixtures/,test_api.py,test_jobs.py,test_extract.py}
│   ├── scripts/benchmark.py
│   ├── pyproject.toml, uv.lock, .dockerignore, Dockerfile
├── scripts/verify-pdf-import.ts
├── nginx.pdf-import.conf, compose.yaml, .env.example
```

**Ownership boundaries**

- Backend owns PDF validation, extraction, temporary files, and conversion lifecycle.
- Frontend owns CV mapping, review drafts, document validation, persistence, and export.
- The existing TypeScript model remains the only CV schema.
- Python and TypeScript share a small extraction contract, checked through contract fixtures.
- Existing field definitions and controls are reused where possible; review must not modify the global editing session.
- No frontend relocation, generic repository framework, Redis, or additional orchestration service is introduced.

## 3. Implementation tasks

### Task 1: Extraction and resource feasibility

- [ ] Write extraction tests using synthetic English, Indonesian, two-column, scanned, mixed, and five-page CVs.
- [ ] Verify failures before implementing the extractor.
- [ ] Pin Python dependencies and CPU-only PyTorch; install Tesseract English/Indonesian packs.
- [ ] Configure the standard Docling pipeline with PDFium, CPU execution, two inference threads, one-page/stage batches, and Tesseract CLI OCR.
- [ ] Disable table-structure inference, picture enrichment, and generated images. Preserve native text and detected reading order; use OCR for scanned content.
- [ ] Return ordered source blocks containing stable IDs, page numbers, layout labels, grouping references, text, and bounding boxes where available.
- [ ] Pre-download required models so conversions require no external service.
- [ ] Run the real extractor under the memory cap before building the complete UI. If it fails the gate, report the measurements and leave the feature disabled.

### Task 2: API and conversion lifecycle

- [ ] Write tests for admission, upload validation, job status, cancellation, timeout, expiry, and process failure.
- [ ] Implement these endpoints:

| Endpoint | Contract |
|---|---|
| `GET /api/pdf-import/health` | Readiness, supported contract version, upload limits |
| `POST /api/pdf-import/jobs` | Multipart PDF; return `202` and unpredictable job ID |
| `GET /api/pdf-import/jobs/{id}` | Processing, completed, or failed status |
| `DELETE /api/pdf-import/jobs/{id}` | Cancel conversion or remove retained results |

- [ ] Accept PDF files only, with a **10 MiB file limit and five-page limit**. Check PDF readability rather than trusting extension or MIME type.
- [ ] Reserve the single conversion slot before accepting expensive upload processing. Return `429` with `Retry-After` when occupied; do not queue uploads.
- [ ] Run conversion in a child process with a **180-second timeout**. Cancellation and timeout terminate the process and its subprocesses before releasing the slot.
- [ ] Return stable error codes for invalid files, unsupported encryption, empty extraction, timeout, and conversion failure.
- [ ] Delete uploaded PDFs after success, failure, or cancellation. Retain completed results for at most ten minutes; delete sooner after client retrieval and explicit cleanup.
- [ ] Keep job metadata temporary. Clean abandoned files on startup; after a restart, expired or unknown jobs return a clear retryable error.
- [ ] Validate response shapes on the frontend at runtime, including contract version, source references, and payload bounds.

### Task 3: Deterministic CV mapping

- [ ] Write mapper tests against extraction fixtures independently of Docling.
- [ ] Start from the existing empty-document factory; do not recreate schema defaults.
- [ ] Recognize bilingual headings for profile, summary, experience, education, projects, skills, and awards.
- [ ] Extract explicit contacts, URLs, recognizable dates, and clearly grouped entries. Preserve source order and column/group boundaries.
- [ ] Preserve year-only dates. Set current employment only when explicitly stated.
- [ ] Populate the selected source locale, defaulting to the current document locale. Leave the other locale blank and retain the existing display fallback.
- [ ] Return a proposal containing the document, field-to-source references, warnings, and unmatched source content.
- [ ] Track partial block usage so extracting one contact from a block cannot hide the remaining text.
- [ ] Keep uncertain fields blank. Unsupported sections remain unmatched; do not silently force them into another section.
- [ ] Never invent employers, job titles, dates, achievements, or translations.

### Task 4: PDF import and editable review

- [ ] Write tests for conversion stages, review edits, source-language selection, cancellation, and confirmed replacement.
- [ ] Add PDF alongside existing JSON sources when enabled. Use an explicit **Convert PDF** action with a short explanation of temporary server processing.
- [ ] Show actual processing stages without fabricated progress percentages. Keep cancellation available.
- [ ] Provide editable profile/contact fields, section entries, add/remove controls, extracted source text, and unmatched content.
- [ ] Keep review state independent of `resumeDoc`, localStorage, and the suspended live editing session.
- [ ] Require acknowledgment of remaining unmatched content before replacement.
- [ ] Validate the final draft through the existing document validation and sanitization path. Preserve the current document if validation or persistence fails.
- [ ] After fetching extraction results, retain the review data in browser memory and delete the server result.
- [ ] On dismissal, abort requests, stop polling, and request server cancellation. Ignore late responses; server timeout remains the fallback if cancellation cannot be delivered.
- [ ] Keep bilingual accessible labels, announced errors, ≥44px controls, responsive scrolling, existing design tokens, and print exclusion.

### Task 5: Deployment and verification

- [ ] Keep the original static frontend deployment working. Add a combined Compose deployment using the separate proxy configuration.
- [ ] Expose one website address; keep the backend port private.
- [ ] Configure backend limits through validated environment settings. Default to **2,750,000,000 bytes RAM**, no additional swap allowance, and at most two CPU cores.
- [ ] Set readiness checks and handle backend unavailability without preventing ordinary editing, JSON import, or export.
- [ ] Keep PDF import disabled by default behind a deployment feature flag. An outage shows a retryable unavailable state.
- [ ] Document frontend and backend development commands, service limits, temporary processing, Compose/Coolify setup, and static-only behavior.
- [ ] Add exclusions for Python environments, caches, uploads, results, and benchmark output. Preserve the existing `docs/` ignore policy.

## 4. Concerns and required handling

| Concern | Required handling |
|---|---|
| **2.75 GB may be insufficient** | Treat capacity as unproven. Benchmark the entire backend, including subprocesses and cold startup. Require peak usage below **2.3 GB**, no memory kills, and no timeouts across the fixture suite. |
| **Model startup costs** | A child process per conversion reloads models. Include that cost in benchmarks; do not report warm model timings as user-visible latency. |
| **Mapping rules cannot cover every CV** | Propose only clear matches, expose uncertainty, preserve unmatched text, and allow manual correction. Do not claim universal automatic conversion accuracy. |
| **Column or bullet misassociation** | Test reading order and entry ownership explicitly. Ambiguous groups remain available for review. |
| **Malformed or expensive uploads** | Bound request size at the proxy and application, count file bytes during ingestion, validate page count, use generated temporary names, and store outside the web root. |
| **PDF parser exposure** | Run the backend as a nonroot user, keep dependencies pinned, and restrict writable locations to temporary processing directories. |
| **Sensitive CV content** | No CV text, original filenames, or access-bearing job IDs in logs. Return private job responses with `Cache-Control: no-store`; do not serve uploaded PDFs publicly. |
| **Cross-user result access** | Use unguessable job IDs as temporary capabilities, expose no job listing, and retain identifiers only in browser memory. |
| **Anonymous service exhaustion** | Enforce one global conversion slot and proxy upload rate limits. Same-origin routing is not authentication or abuse protection. |
| **Crash or backend restart** | Report failure or expired job and allow retry. Never change the current resume automatically. |
| **Incomplete cancellation** | Terminate the process group, clean files, and release the slot only after termination. Test cancellation races. |
| **API drift or invalid data** | Validate the extraction contract on both sides and run shared fixture compatibility tests. TypeScript types alone are insufficient. |
| **Privacy wording changes** | Explain that PDF imports are temporarily processed on the server while the completed resume remains stored in the browser. |

**Gate failure policy:** Keep PDF import disabled and report the failing inputs, timing, and memory measurements. Do not silently increase resources, reduce supported behavior, or substitute another converter.

## 5. Test plan and acceptance

Each task follows **failing tests → verified failure → implementation → passing checks → diff review**.

- **Backend:** file/body limits, corrupt/encrypted PDFs, empty extraction, concurrency, polling, timeout, cancellation, subprocess cleanup, restart, result expiry, and response contracts.
- **Mapping:** bilingual headings, partial dates, current employment, bullet ownership, column separation, ambiguous fields, unsupported sections, partial source-block usage, and locale fallback.
- **Review:** corrections, add/remove entries, unmatched-content acknowledgment, sanitization, storage failures, explicit replacement, dismissal, and preserved active drafts.
- **Browser:** 320/375/768/1440px widths, keyboard access, long source text, unavailable backend, polling failure, and cancellation.
- **Actual extraction:** run real Docling/Tesseract against the PDF fixtures. Mocks are sufficient only for isolated API/UI behavior.
- **Resource gate:** measure cold conversion, repeated requests, retained-result expiry, and post-cancellation memory under the enforced cap. Record software versions and CPU allocation.
- **Regression:** run backend tests, `bun run test`, `bun run build`, `bun run verify:print`, `bun run verify:ats`, and `git diff --check`.
- **Deployment:** verify both static-only and combined configurations, effective resource limits, readiness, private backend access, and failure recovery.

**Acceptance:** A user can upload a supported PDF, inspect and correct a proposed CV, and explicitly replace their resume. Unmapped text remains available, existing work survives failures, no external AI service is contacted, and PDF import is enabled only after passing the resource gate.
