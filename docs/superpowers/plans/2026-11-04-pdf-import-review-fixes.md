# PDF Import Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the four defects the Codex review found on `codex/pdf-docling-import`, and re-prove the resource gate on the current code.

**Architecture:** Four local fixes: one in the backend benchmark script, three in the browser-side PDF code (`src/lib/io/pdf`). No contract, schema, UI or deployment changes.

**Tech Stack:** TypeScript + Vitest (frontend); Python 3.12 + pytest inside the `pdf-import:test` Docker image (backend).

**Spec:** `docs/superpowers/plans/2026-11-04-pdf-docling-import.md` (the original plan; its Spec line, Constraints and "Concerns and required handling" table remain binding). Findings come from the Codex review of the branch diff against `main`.

## Global Constraints

- Work on the existing branch `codex/pdf-docling-import`; do not push or deploy.
- `docs/` is git-ignored: commit this plan with `git add -f`.
- The mapper must never invent, reword or translate text; uncertain fields stay blank and their text stays listed as unplaced.
- Set `current` employment only when the text says so explicitly.
- Resource gate: peak memory below **2,300,000,000 bytes**, no OOM kills, no timeouts, under `--memory=2750000000 --memory-swap=2750000000 --cpus=2`.
- Backend tests run in Docker: `cd services/pdf-import && docker run --rm --user $(id -u):$(id -g) -e HOME=/tmp -v "$PWD":/app/src -w /app/src pdf-import:test python -m pytest -p no:cacheprovider -q <args>` (rebuild with `docker build --target test -t pdf-import:test .` if the image is missing). Call this `PYTEST` below.
- Frontend tests: `bun run test <path>` (not `bun test`).

## Review Focus

- A header-labelled title followed by a non-date line (location) and then a date line is still **one** entry, not split at the location line.
- A section whose **first** entry has no date line and whose later titles are text-labelled: the later titles still start their own entries.
- Cancelling while the server's DELETE of a completed result is still in flight never opens the review.
- A real date range written in a phone-like layout (e.g. `2013 - 2017`, `05/2018 — 11/2020`) is still not read as a phone number.
- The benchmark's child processes are invoked exactly as production invokes them (same `--max-pages`).

Each line has its test in the owning task below.

---

### Task 1: Benchmark invokes the extractor the way production does

**Files:**
- Modify: `services/pdf-import/scripts/benchmark.py` (`run_child`, command list at line ~62)
- Create: `services/pdf-import/tests/test_benchmark.py`

**Interfaces:**
- Consumes: `app.extract` CLI: `python -m app.extract IN.pdf OUT.json --max-pages N` (`--max-pages` is required); `app.settings.Settings().max_pages` (default 5).
- Produces: `run_child(pdf: Path, cancel_after: float | None = None) -> dict` returning `{"exit": 0, "blocks": int, ...}` on success.

- [ ] **Step 1: Write the failing test** in `tests/test_benchmark.py`. Load the script by path (it is not a package): `importlib.util.spec_from_file_location("benchmark", ROOT / "scripts" / "benchmark.py")`.

```python
@pytest.mark.docling
def test_run_child_converts_a_fixture_like_production() -> None:
    run = benchmark.run_child(PDF / "en_single.pdf")
    assert run["exit"] == 0, run["stderr_tail"]
    assert run["blocks"] == 20
```

- [ ] **Step 2: Run it to verify it fails**

Run: `PYTEST tests/test_benchmark.py`
Expected: FAIL, `assert 2 == 0` (argparse rejects the missing `--max-pages`).

- [ ] **Step 3: Pass the page limit.** In `run_child`, append `"--max-pages", str(Settings().max_pages)` to the child command, importing `Settings` from `app.settings` (the script already runs with `cwd=ROOT`; add `ROOT` to `sys.path` before the import so `app` resolves when run as `python scripts/benchmark.py`).

- [ ] **Step 4: Run it to verify it passes**

Run: `PYTEST tests/test_benchmark.py`
Expected: 1 passed.

- [ ] **Step 5: Re-run the resource gate on the current code**

Run: `docker run --rm --memory=2750000000 --memory-swap=2750000000 --cpus=2 --user $(id -u):$(id -g) -e HOME=/tmp -v "$PWD":/app/src -w /app/src pdf-import:test python scripts/benchmark.py --repeat 2`
Expected: every run `"exit": 0` with non-null `blocks`; summary `"oom_kills": 0`, `"peak_bytes"` < 2300000000, `"passed": true`. Record peak, slowest cold seconds and memory after cancel for the final report.

- [ ] **Step 6: Run the whole backend suite**

Run: `PYTEST`
Expected: all pass (65 tests).

- [ ] **Step 7: Commit**

```bash
git add services/pdf-import/scripts/benchmark.py services/pdf-import/tests/test_benchmark.py
git commit -m "fix(pdf-import): benchmark passes --max-pages like production"
```

---

### Task 2: Entry boundaries combine heading labels and date lines

**Files:**
- Modify: `src/lib/io/pdf/mapper.ts:185-198` (`splitEntries`)
- Test: `src/lib/io/pdf/mapper.test.ts` (describe `mapExtraction: conservative rules`)

**Interfaces:**
- Consumes: `isHeaderLabel(block)`, `isDateLine(block)`, `isBullet(block)` (existing, same file).
- Produces: unchanged signature `splitEntries(blocks: SourceBlock[]): { lead: SourceBlock[]; entries: SourceBlock[][] } | null`.

- [ ] **Step 1: Write the failing tests** (use the file's `block()` / `extraction()` helpers)

```ts
it('starts a new entry at a text-labelled title even when another title is a heading', () => {
  const proposal = mapExtraction(extraction(
    block('Experience', 'section_header'),
    block('Engineer at Foo', 'section_header'), block('2019 - 2020'), block('Built Foo', 'list_item', 'g1'),
    block('Analyst at Bar'), block('2017 - 2019'), block('Built Bar', 'list_item', 'g2'),
  ), 'en')
  expect(proposal.document.content.experience.map((e) => [e.company, e.text.en.bullets])).toEqual([
    ['Foo', ['Built Foo']],
    ['Bar', ['Built Bar']],
  ])
})

it('keeps a heading title, a location line and its date line as one entry', () => {
  const proposal = mapExtraction(extraction(
    block('Experience', 'section_header'),
    block('Engineer at Foo', 'section_header'), block('Jakarta'), block('2019 - 2020'),
  ), 'en')
  expect(proposal.document.content.experience).toHaveLength(1)
  expect(proposal.document.content.experience[0]!.dates).toEqual({ start: '2019', end: '2020' })
})

it('starts later text-labelled entries after an undated heading entry', () => {
  const proposal = mapExtraction(extraction(
    block('Experience', 'section_header'),
    block('Engineer at Foo', 'section_header'), block('Built Foo', 'list_item', 'g1'),
    block('Analyst at Bar'), block('2017 - 2019'),
  ), 'en')
  expect(proposal.document.content.experience.map((e) => e.company)).toEqual(['Foo', 'Bar'])
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `bun run test src/lib/io/pdf/mapper.test.ts`
Expected: the first and third new tests FAIL (Bar's blocks attached to Foo); the second passes already and must stay passing.

- [ ] **Step 3: Rewrite `splitEntries` as a single walk over the blocks.** Track whether there is a current entry and whether it already has `content` (a date line or a bullet). Block `i` starts a new entry when:
  - it is header-labelled; or
  - the next block is a date line, block `i` is neither a date line nor a bullet, and either there is no current entry or the current entry already has `content`.

  Reset `content` to `false` at each start; set it on any date line or bullet. Return `null` when no start is found; `lead` is everything before the first start. (Sections with only one signal behave exactly as before.)

- [ ] **Step 4: Run the mapper and fixture tests**

Run: `bun run test src/lib/io/pdf`
Expected: all pass, including the five real-extraction fixture suites (`en_single`, `id_single`, `two_column`, `scanned`, `five_page`) unchanged.

- [ ] **Step 5: Commit**

```bash
git add src/lib/io/pdf/mapper.ts src/lib/io/pdf/mapper.test.ts
git commit -m "fix(pdf-import): combine heading and date-line entry boundaries"
```

---

### Task 3: Cancellation during the final cleanup wins

**Files:**
- Modify: `src/lib/io/pdf/client.ts:155-157` (completed path of `convertPdf`)
- Test: `src/lib/io/pdf/client.test.ts`

**Interfaces:**
- Consumes: existing `failure('cancelled')`, `forget()`.
- Produces: unchanged `convertPdf(file, options): Promise<Result<Extraction>>`; resolves `{ ok: false, messageKey: 'pdf.error.cancelled' }` if `signal` is aborted at any point before it returns.

- [ ] **Step 1: Write the failing test** (use the file's `server()` / `json()` helpers)

```ts
it('reports cancellation when the user cancels while the result is being cleaned up', async () => {
  const controller = new AbortController()
  const { fetch } = server((method) => {
    if (method === 'POST') return json(processing, 202)
    if (method === 'DELETE') {
      controller.abort()
      return new Response(null, { status: 204 })
    }
    return json(completed)
  })
  const result = await convertPdf(pdf(), { fetch, signal: controller.signal, pollMs: 0, onStage: () => {} })
  expect(result).toMatchObject({ ok: false, messageKey: 'pdf.error.cancelled' })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `bun run test src/lib/io/pdf/client.test.ts`
Expected: FAIL, received `{ ok: true, ... }`.

- [ ] **Step 3: After `await forget()` in the completed path, return `failure('cancelled')` when `signal.aborted`; otherwise `ok(status.result)`.**

- [ ] **Step 4: Run client and dialog tests**

Run: `bun run test src/lib/io/pdf src/components/importing`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/io/pdf/client.ts src/lib/io/pdf/client.test.ts
git commit -m "fix(pdf-import): honour cancel during result cleanup"
```

---

### Task 4: Phone numbers ending in a year-like group are kept

**Files:**
- Modify: `src/lib/io/pdf/rules.ts:167-174` (phone loop in `findContacts`)
- Test: `src/lib/io/pdf/rules.test.ts` (describe `findContacts`)

**Interfaces:**
- Consumes: `findDateRange(text): FoundRange | null` (returns `from`/`to` span).
- Produces: unchanged `findContacts(text: string): FoundContact[]`.

- [ ] **Step 1: Write the failing tests**

```ts
it.each(['+62 812 3456 2019', '0812 3456 2020', '+1 415 555 1999'])('keeps the phone number %j', (text) => {
  expect(findContacts(text).map((c) => [c.field, c.value])).toEqual([['phone', text]])
})

it.each(['2013 - 2017', '2019 – 2020', 'Jan 2019 - Dec 2020'])('still ignores the date range %j', (text) => {
  expect(findContacts(text)).toEqual([])
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `bun run test src/lib/io/pdf/rules.test.ts`
Expected: the three phone cases FAIL (empty result); the date-range cases pass.

- [ ] **Step 3: Replace the `findDateRange(raw)` rejection with "the date span covers the whole candidate":** reject only when `findDateRange(raw)` returns a span with `from === 0 && to === raw.length`.

- [ ] **Step 4: Run all PDF tests and the full suite**

Run: `bun run test src/lib/io/pdf` then `bun run test`
Expected: all pass (full suite ≥ 692 + new tests).

- [ ] **Step 5: Final checks and commit**

Run: `bun run type-check` (0 errors) and `git diff --check` (clean).

```bash
git add src/lib/io/pdf/rules.ts src/lib/io/pdf/rules.test.ts
git commit -m "fix(pdf-import): keep phone numbers whose last group looks like a year"
git add -f docs/superpowers/plans/2026-11-04-pdf-import-review-fixes.md
git commit -m "docs: plan for PDF import review fixes"
```
