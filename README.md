# Resume Builder

A bilingual (Indonesian / English) resume builder that runs entirely in the
browser. No account, no server, no tracking: your resume lives in this browser's
local storage and exports to PDF through the browser's own print dialog.

The one exception is optional: a deployment can add **PDF import**, which sends
an uploaded CV to a small extraction service on the same site for temporary
processing (see [PDF import](#pdf-import)). The static-only build has no server
at all.

The resume sits on a quiet workspace under a compact toolbar, and you edit it in
place: click text on the page to change it. The A4 preview fits the available
screen width, while editors, forms and buttons stay full size. Browser pinch zoom
remains available; screen scaling does not change the exported PDF's dimensions
or typography.

Built with Svelte 5, Vite and Tailwind v4.

## Why it works the way it does

**One resume, two languages.** The document has a single shared structure and a
per-item text node holding each locale. Adding a job adds it to both language
versions, so they cannot drift apart in shape, and shared facts — email, phone,
links, dates, company names — are stored once. Every editor names its field as
**this language** or **both languages**, so it is obvious which values change
when you switch language.

**PDF export is the browser's print dialog, not a screenshot.** There is no
`html2canvas` and no offscreen iframe: the page you see is the page that prints.
Text in the PDF stays selectable, searchable and copyable, and the file is a
fraction of the size of a rasterised one.

**Page margins live on `@page`, not on the element.** An element's padding
applies once at the very top and once at the very bottom, which leaves interior
pages flush against the paper edge. Putting the margin on `@page` gives every
page the same margin.

**The paper is block flow, not flex.** Pagination inside flex and grid
containers is poorly specified and inconsistently implemented, and `gap` does
not collapse at a page break. Spacing therefore uses margins.

**The default theme has no background fills.** The print dialog's "Background
graphics" setting belongs to the reader and cannot be overridden, so the design
uses rules and whitespace instead and prints identically either way.

## Getting started

```bash
bun install
```

```bash
bun run dev
```

Then open `http://localhost:5173`.

## Commands

```bash
bun run dev
```

```bash
bun run test
```

```bash
bun run type-check
```

```bash
bun run build
```

```bash
bun run verify:print
```

`verify:print` is the one check the unit suite cannot do. jsdom has no layout
engine — `offsetHeight` is `0` and `getBoundingClientRect` returns zeros — so
page geometry is verified by rendering the running dev server to a real PDF with
headless Chromium and asserting A4 sizing, per-page margins, selectable text and
the absence of app chrome. It needs `chromium` and `poppler-utils` installed,
and `bun run dev` already running.

```bash
bun run verify:ats
```

`verify:ats` checks what a text extractor reads from each layout. It starts its
own dev server (or takes a URL argument), drives headless Chromium over the
DevTools protocol with a throwaway profile, seeds a multipage bilingual fixture,
switches layouts and languages through Settings, and prints to
PDF. It then
extracts the text with `pdftotext`, in both normal and raw modes, and asserts
that every field appears once and in reading order. It also checks A4 pages,
margins, selectable text, embedded fonts, that the ATS output has no images,
controls, consent notices or page-guide labels, and that Classic still shows
the photo afterwards. The same output must come from phone and desktop preview
widths, with background graphics on or off. Generated PDFs are deleted on
success and kept for inspection on failure. It then edits through the new
interface: it prints the same document from Preview and Edit mode and requires
identical text, reading order, pages and word positions; applies and cancels
inline edits; adds an entry; checks that printing and JSON export include an
open draft; confirms no idle animation frames and no listeners left behind once
editors close; reloads to confirm persistence; and checks the phone sheet with a
shortened (keyboard-open) viewport plus 44px targets and no horizontal overflow
at 320, 375, 768 and 1440px and phone landscape. It opens the Sections and
Settings panels across the phone, tablet and desktop breakpoints, checking
header reflow, popup clearance, internal scrolling, heading focus, Escape,
44px targets and overflow, and that narrowing the window keeps the panel
opened last. It checks that phone section navigation closes the popup and
focuses its destination, leaves a visible heading in place, reaches a later
one in a long resume, and requires
identical PDFs with the panels open and closed for both layouts, both
languages, and Preview and Edit. Needs `chromium` and `poppler-utils`.

### PDF import backend

The extraction service lives in `services/pdf-import` (Python 3.12, FastAPI,
Docling). Its dependencies, OCR languages and models are installed in its Docker
image, so the tests run there:

```bash
cd services/pdf-import
docker build --target test -t pdf-import:test .
docker run --rm -v "$PWD":/app/src -w /app/src pdf-import:test python -m pytest -q -m "not docling"  # fast
docker run --rm -v "$PWD":/app/src -w /app/src pdf-import:test python -m pytest -q                   # plus real Docling/Tesseract
```

The resource gate converts every synthetic fixture as a cold child process
under the production limits and fails above 2.3 GB peak, on any OOM kill or on
a timeout:

```bash
docker run --rm --memory=2750000000 --memory-swap=2750000000 --cpus=2 \
  -v "$PWD":/app/src -w /app/src pdf-import:test python scripts/benchmark.py
# against a running deployment: cold conversions, result expiry, cancellation
python3 scripts/benchmark.py --api http://127.0.0.1:8080 --container <pdf-import container>
```

To work on the frontend against a local backend, run the service on port 8000
(`docker run --rm -p 127.0.0.1:8000:8000 pdf-import:runtime` after building
`--target runtime`) and start Vite with the feature on; it proxies
`/api/pdf-import` there (override with `PDF_IMPORT_DEV_URL`):

```bash
VITE_PDF_IMPORT=1 bun run dev
```

```bash
bun run verify:pdf-import http://127.0.0.1:8080/                 # combined deployment
bun run verify:pdf-import http://127.0.0.1:8080/ --backend-down  # with the service stopped
bun run verify:pdf-import http://127.0.0.1:8080/ --static        # static-only build
```

`verify-pdf-import.ts` uploads the synthetic PDFs through headless Chromium at
320, 375, 768 and 1440px, checking fit, 44px targets, focus, keyboard use, long
extracted text, replacement, cancellation and the unavailable state.

## Workspace

Above the resume, five icon buttons have tooltips and accessible names:
**Sections**, **Edit**, **Upload**, **Export** and **Settings**. **Edit**
opens the editor. **Upload** offers JSON and, when enabled, PDF. Choose a format to open its import dialog. **Export** offers
**Export PDF**, which prints the current resume, and **Export JSON**.
**Sections** and **Settings** open and close side panels. The status shows
whether work is saved in this browser or needs attention.
On phones, the title and status sit above the action buttons. Text and controls
wrap to fit without overlapping.

The side panels are not dialogs. Nothing dims the page, and clicking the resume
leaves them open, so you can keep editing beside them. At 1024px and wider,
Sections sits left of the resume and Settings right of it, and both can stay
open. At 640–1023px, one panel opens above the resume. Below 640px, it rises
from the bottom into a rounded popup centered in the space below the visible
header. It uses at most 60% of the viewport height, with a scrolling body so
the exposed resume stays usable. Opening the other panel replaces it.
Escape closes the panel that has focus. Both panels start closed on every
visit and never print. Reduced motion skips the popup animation.

**Sections** lists Profile first, then one row per section: a drag handle, the
section name with its entry count, and a checkbox that shows or hides the
section. Select a name to go to that section; the page scrolls only when its
heading is off screen. On phones, selecting a name also closes the popup and
focuses that section's heading. A hidden section, or an empty one outside Edit mode,
cannot be selected, and the row says why. **Settings** holds
the Classic / ATS layout selector, languages, font size, page guides, data
actions and help.

### Editing

On a first visit the page shows a fictional sample resume. A disclaimer below
the toolbar appears only while the sample is unchanged; it is separate from
the save status and excluded from print. A short introduction above the resume
offers **Start blank**. Use **Edit** or **Upload** to
edit or import. The introduction disappears once the sample is changed or
the introduction is dismissed. **Start blank** is also in Settings → Data, where it
asks for confirmation.

The available sections are Experience, Education, Projects, Skills, Awards,
Courses & Certifications, and References. Reference names, positions and notes
are localized; phone and email are shared plain text.

The app starts in **Preview**. Press **Edit** to reveal what can be changed;
editable text gets a dashed outline and a hint above the page explains the
keys:

- **Click any text** on the page. Single-line text opens a native input over it:
  **Enter** or clicking away applies, **Escape** cancels. Multi-line text keeps
  Enter as a newline and applies with **Apply**, **Ctrl/Cmd+Enter**, or clicking
  away. Bullets are edited one per line; skills and technologies as a
  comma-separated list. Lists are tidied only when you apply.
- **Dates, contact details, links, tags and the photo** open a small labelled
  form beside what you clicked. Classic shows shortened URLs, but the form edits
  the full stored address.
- **Empty fields** appear as `+ Field` prompts, and enabled sections with no
  entries appear with a placeholder, only while editing.
- **+ Add entry** under each enabled section opens a form for a new entry; it is
  added only when you apply, so cancelling leaves nothing behind.
- **Select an entry** to show **Edit entry**, **Move up**, **Move down** and
  **Delete** (delete asks for confirmation). Focus stays on a moved entry, and
  moves to the next entry or the section's Add action after a delete.
- **Profile details** edits every profile and contact field at once, including
  the photo. Use it in ATS, which leaves the photo off the page.

Nothing reaches your resume until an edit is applied, and applied edits are
saved automatically. Changing the resume language or layout applies the open
edit first. Opening or closing a panel, going to a section, and reordering or
hiding one also apply it first, and drop a new entry you never typed in.
Opening Import sets the edit aside and brings it back after.
Changing the interface language translates labels without touching what you
have typed. Importing a replacement or resetting discards any edit of the old
document.

On phones (below 640px), tapping a field or an entry opens it in a full-size
bottom sheet whose buttons stay visible above the on-screen keyboard. Every
action is at least 44px, and text can also be reached with Tab and opened with
Enter or Space.

Exporting, or printing from the browser's own menu, applies the open edit
first. Edit mode prints exactly what Preview prints: prompts, actions and
editors are never part of the page.

## Layouts

The **Classic / ATS** selector in Settings switches between two presentations
of the same content:

- **Classic** (the default) has a photo, a single contact line, and dates
  aligned on the right.
- **ATS** adapts a LaTeX-style layout in the browser, using a system serif
  stack (Latin Modern Roman, Computer Modern, Times New Roman, Liberation Serif),
  11pt body text, a 14.4pt uppercase name, 12pt section headings, and 1.2 line
  spacing. A4 pages have 16mm margins on all sides; the font-size control still
  applies. The centered header shows location separately and labelled contacts
  with full URLs, separated by pipes. Entry headings have right-aligned dates;
  dates move intact to the next row when space is short. Experience starts with
  company, dates, then italic role and team/location. Education shows school,
  degree and field, then dates and GPA; projects show name, italic role and
  technologies before dates. Skills appear as `Category: a, b, c`. The photo
  stays off the page. This uses browser PDF printing, with no LaTeX compilation
  or `.tex` export; exact serif glyphs depend on installed fonts.

Switching layouts changes presentation only. Content, section order, languages
and the stored photo stay as they are, an open edit is applied first, and the
choice is remembered in this browser. The ATS layout aims for formatting that parsers
handle well; it is not a score and cannot guarantee that every system reads a
resume correctly. Some text extractors place right-aligned dates after the
rest of their entry; raw PDF extraction preserves the rendered field order.
To see what a parser is likely to get, save the PDF and
select all of its text, or run `pdftotext resume.pdf -`, and read it top to
bottom.

## Printing

In the print dialog: choose **A4**, set margins to **Default** or **None**, and
turn **off** headers and footers. Browsers stamp a URL and date onto each page
and no stylesheet can suppress it.

The dashed red guides in Preview mark where each new page starts; they are
hidden while editing and can be turned off in Settings. They model
`break-inside: avoid` on entries and `break-after: avoid` on headings, but not
margin collapsing or widow and orphan control, so treat them as approximate —
the print preview is authoritative.

## Data

Your resume is held in this browser's local storage, which means clearing site
data will erase it. **Export JSON** regularly; **Upload → Upload JSON** restores from a file (up to 1,000,000 bytes).
Choose a file or drop one in the picker; selection opens a local review.
**Other ways to import JSON** offers paste and `https` URL methods.
The picker shows the filename and size, with **Change file** and **Remove file**;
Back retains the selected file so it can be reviewed again.

Every import is validated and reviewed before it replaces your resume. The
review shows the imported name and section counts; **Replace resume** applies
it to both languages. **Back** returns to the source inputs, and **Cancel** or
Escape leaves your current resume unchanged. Export your current JSON first if
you want to keep a copy.

The interface language and resume language are independent; both are in
Settings. Changing the interface language translates controls and messages
without changing your resume content or discarding an unfinished draft. In the
**Sections** panel, drag a section by its handle, or focus the handle and press
the arrow keys, to change the order. On a phone, where dragging is unreliable,
each row also has move up and move down buttons.

There is no server, so a photo cannot be uploaded anywhere. Choosing one resizes
it to 320px and embeds it in the document itself, which means it survives an
export and travels with the JSON — and is why it is resized rather than stored
whole, since the browser's storage budget is a few megabytes in total.

### PDF import

When the deployment enables it, **Upload → Upload PDF** opens the PDF picker
(PDF only, up to 10 MiB and 5 pages). Choose or drop a single PDF, then select
**Convert PDF** to send it; selecting a file alone makes no server request.
The PDF is uploaded to this site's own
extraction service, which reads its text and layout with
[Docling](https://github.com/docling-project/docling) and Tesseract OCR for
scanned pages, entirely on that server: no external AI service or generative
model is involved. The upload is deleted as soon as conversion ends, the
extracted text is deleted once the browser has fetched it (or after ten minutes
at most), and nothing is logged about its content. The finished resume is stored
in your browser like any other.

During upload, progress is indeterminate. When the server provides progress,
the percentage measures completed conversion work: converter initialization,
each completed page, assembly, and validated output. It is not an estimate of
time remaining. The page count reports completed pages, and progress stays at
most 99% until the browser has validated and mapped the review draft. Review
announces 100%. Older servers still show stage messages without a percentage.
**Cancel conversion** remains available; retry starts progress afresh.

The browser then maps the text to resume fields with fixed bilingual rules.
Headings are found by typography: the service reports each block's font and
size (as opaque ids, never the embedded font names), the browser learns which
style the recognised section headings use, and from that reads entry headings
(employer, school, course) and the role lines under them. Where a PDF gives no
usable styles, the same wording rules as before decide. Within that outline,
rules match dates, contact details, bullets and entry boundaries. The mapper
fills only what a rule matches with confidence and never invents, rewords or
translates anything. Uncertain fields stay blank, and any text it could not
place is listed separately. Conversion will not be perfect for every CV
layout.

PDF import keeps your selected Classic or ATS layout, font size, and existing
photo. It imports text into that layout; photos are not extracted from the PDF.
The photo remains visible in Classic and stays stored when using ATS.

The mapper also recognises core competencies, additional experience, multiple
roles under one employer, and inline project and education entries. Where the
PDF provides usable geometry, dates are matched to their title row rather than
chosen from reading order alone. Wrapped text retains its source references.
Conflicting dates stay blank for review. Courses and certifications ("Title -
Issuer" with a month and year, then a line of topics or scores) and references
(a name, then position and contacts, or a single note such as "available on
request") are imported into their own sections. In a mixed
certifications-and-awards section, award-like lines go to Awards and
certificate-like lines to Courses & Certifications. Sections outside the
recommended structure (hobbies, for example) are listed with a note that they
are not part of it, and their text stays in the unplaced list. No translation
or qualification is inferred.

The review lets you correct every field, add or remove entries, choose which
language the text is in (the other language stays blank and falls back as
usual), see the PDF text behind each entry, and read all extracted text. If any
text was not placed, **Replace resume** asks you to confirm you have checked it
first. Replacement goes through the same validation as
JSON import and is saved before your current resume changes, so a validation or
storage failure leaves it untouched. Cancelling or closing at any point, even
mid-conversion, cancels the job on the server. While you review, Escape and
clicks outside the dialog are ignored so your corrections are not lost by
accident; use **Cancel** or **Close**.

Imported data is validated field by field rather than trusted: containers must
have the right shape, leaves are coerced to safe defaults, URLs are restricted
to safe schemes (`javascript:` and `data:image/svg+xml` are rejected), and a file
from a newer schema version is refused rather than silently downgraded.

### How accurate is PDF import?

Each synthetic test CV (invented people only) has a hand-written answer key.
The benchmark maps every fixture twice, with typography and with the styles
stripped (text rules only), and scores each field: a value is correct if it
matches after whitespace normalisation, and a list (bullets, skill items)
scores matched items over the larger of the expected and imported counts.
Recall is correct fields over expected fields, precision is correct fields over
filled fields, and "unplaced" counts the text fragments left for review.
"Before" is the mapper prior to the typography outline and the Courses &
Certifications and References sections.

| Fixture | Before | Now, typography | Now, text rules only |
| --- | --- | --- | --- |
| `en_single` | 100.0% / 100.0% / 0 | 100.0% / 100.0% / 0 | 100.0% / 100.0% / 0 |
| `id_single` | 100.0% / 100.0% / 0 | 100.0% / 100.0% / 0 | 100.0% / 100.0% / 0 |
| `two_column` | 100.0% / 100.0% / 0 | 100.0% / 100.0% / 0 | 100.0% / 100.0% / 0 |
| `five_page` | 100.0% / 100.0% / 0 | 100.0% / 100.0% / 0 | 100.0% / 100.0% / 0 |
| `progression` | 92.0% / 98.9% / 5 | 95.0% / 99.0% / 4 | 95.0% / 99.0% / 4 |
| `scanned` | 100.0% / 100.0% / 0 | 100.0% / 100.0% / 0 | 100.0% / 100.0% / 0 |
| `mixed` | 95.1% / 86.7% / 0 | 95.1% / 86.7% / 0 | 95.1% / 86.7% / 0 |
| `guide_template` | 7.4% / 80.0% / 32 | 79.6% / 100.0% / 6 | 79.6% / 100.0% / 6 |

Cells are recall / precision / unplaced. The synthetic fixtures use standard
heading wording, so both modes score the same on them; typography matters when
wording alone is ambiguous. On a real CV checked locally (not published), the
text rules alone left the name, headline and location blank, while typography
filled them. In `guide_template`, Docling merges the school and degree lines
into one block, which the mapper leaves for review rather than guessing.

OCR is measured on `scanned.pdf`, a 200-dpi raster of `en_single.pdf`, against
the native text extraction of `en_single.pdf`: the character error rate
(Levenshtein distance over reference length, after whitespace normalisation) is
**0.91%** on its one page (657 reference characters).

```bash
bun run bench:import                     # prints the table; fails if any correct field is lost
BENCH_UPDATE=1 bun run bench:import      # re-records services/pdf-import/bench-results/accuracy.json
docker run --rm -v "$PWD/services/pdf-import/app:/app/app" -v "$PWD/services/pdf-import/tests:/app/tests" \
  -v "$PWD/services/pdf-import/scripts:/app/scripts" -v "$PWD/services/pdf-import/bench-results:/app/bench-results" \
  pdf-import:test python scripts/ocr_accuracy.py  # writes services/pdf-import/bench-results/ocr.json
```

Text recognition is Docling's: its layout model finds the blocks and reading
order, and Tesseract reads scanned pages. This project adds the typography
outline, the mapping rules, and the resource and progress tuning of the
service.

## Project layout

```text
src/
├─ lib/
│  ├─ model/        document shape, resolve(), validation, migration, sanitizing
│  ├─ sections/     one folder per section: descriptor and Preview
│  ├─ editing/      typed edit targets: field registry, drafts, normalization
│  ├─ state/        reactive stores and the autosave logic
│  ├─ storage/      versioned localStorage read/write
│  ├─ pagination/   pure page-break simulation plus DOM measurement
│  ├─ print/        the print trigger
│  ├─ themes/       typed theme presets to CSS custom properties
│  ├─ io/pdf/       PDF service client, contract validation, field mapping, review draft
│  └─ i18n/         interface strings only, never resume content
├─ components/
│  ├─ shell/        toolbar, Export menu, side panels, inline SVG icons
│  ├─ editing/      in-page targets, inline editor, contextual forms, phone sheet
│  ├─ importing/    PDF import review
│  └─ preview/      the resume paper, plus the two side-effect hosts beside it
└─ styles/
   ├─ print.css     everything governing how the resume prints
   └─ paper.css     screen-only preview chrome

services/pdf-import/  optional PDF extraction service (FastAPI + Docling)
├─ app/            routes, settings, job lifecycle, child-process extractor
├─ tests/          pytest, synthetic CV PDFs, shared contract fixtures
└─ scripts/        resource benchmark
```

Adding a section means adding a folder under `src/lib/sections/` and one entry to
`kinds.ts`. A test asserts the registry and that list cannot drift apart.

## Deployment

The Dockerfile builds the app with Node 22 and Bun, then copies only `dist/`
into an Nginx runtime serving port `80`. Base-image versions are pinned in the
Dockerfile. Installation uses the committed `bun.lock` with
`bun install --frozen-lockfile`, including the development dependencies needed
for type checking and compilation.

Build and run locally:

```bash
docker build -t resume .
docker run --rm -p 8080:80 resume
```

Open `http://localhost:8080`. The image includes a health check at `/healthz`,
SPA fallback for client-side paths, revalidated HTML, and immutable caching for
generated assets. Missing files under `/assets/` return `404`.

### Coolify via Git

Commit and push the source, Dockerfile, `.dockerignore`, and `nginx.conf` to the
branch you want to deploy. In Coolify, connect the repository through a GitHub
App, deploy key, or public repository URL, then use these settings:

| Setting | Value |
| --- | --- |
| Build Pack / Build Strategy | Dockerfile |
| Branch | The branch containing these files |
| Base Directory / Build Context | `/` |
| Dockerfile Location | `/Dockerfile` |
| Ports Exposes | `80` |
| Health-check path, if enabled in Coolify | `/healthz` |

The Dockerfile owns dependency installation, the build command, and the runtime
command. Clear any previous Nixpacks install/build/start overrides and remove
`NIXPACKS_*` variables. No publish-directory setting, application environment
variables, database, or persistent volume is required.

Set your domain and point its DNS at the Coolify server, then deploy. Enable
deployment on push for the connected Git integration if you want subsequent
pushes to the configured branch to deploy automatically. See
[Coolify's Dockerfile guide](https://coolify.io/docs/applications/builds/dockerfile).

### With PDF import (Docker Compose)

`compose.yaml` runs the same frontend image built with `VITE_PDF_IMPORT=1` and
`nginx.pdf-import.conf`, plus the `pdf-import` service. nginx proxies
`/api/pdf-import` to the service over the private Compose network; the service
is never published.

`compose.yaml` itself binds no host ports, so a platform proxy can route a
domain to `web:80`. Locally, `docker compose` also loads
`compose.override.yaml`, which publishes the site on `WEB_PORT` (default
`8080`):

```bash
cp .env.example .env   # optional; every value has a default
docker compose up -d --build              # http://localhost:8080
WEB_PORT=8090 docker compose up -d --build  # if 8080 is taken
```

| Limit | Default | Where |
| --- | --- | --- |
| Upload size | 10 MiB (proxy allows 10 MiB + multipart framing) | `PDF_IMPORT_MAX_BYTES`, nginx `client_max_body_size` |
| Pages | 5 | `PDF_IMPORT_MAX_PAGES` |
| Conversion timeout | 180 s, then the whole process group is killed | `PDF_IMPORT_TIMEOUT_SECONDS` |
| Result retention | 600 s at most | `PDF_IMPORT_RESULT_TTL_SECONDS` |
| Memory | 2,750,000,000 bytes, no swap on top | `PDF_IMPORT_MEMORY_LIMIT_BYTES` (`mem_limit` = `memswap_limit`) |
| CPU | 2 cores | `PDF_IMPORT_CPU_LIMIT` |
| Concurrency | 1 conversion; others get `429` with `Retry-After` | built in |
| Upload rate | 6 per minute per client, burst 2 | `nginx.pdf-import.conf` |

The service validates its settings at startup and refuses values above these
caps. It runs as a non-root user on a read-only filesystem with a 96 MB `/tmp`
tmpfs for uploads, with an init process to reap killed converters, no Linux
capabilities, and a health check at `/api/pdf-import/health`. Models are baked
into the image at build time, so conversions need no network access. The image
is large (PyTorch CPU and the layout model); a cold conversion of the bundled
fixtures takes 13–20 s on two cores, with peak memory near 1 GB.

The website does not depend on the service: if it is starting, unhealthy or
stopped, the site, editing, JSON import and export keep working, and **Convert
PDF** reports that conversion is unavailable and can be retried.

On Coolify, switch the application's **Build Pack** to **Docker Compose** (or
create a Docker Compose resource), with Base Directory `/` and Docker Compose
Location `/compose.yaml`. Assign the domain to the `web` service only (it
listens on port `80`) and leave `pdf-import` without a domain. Coolify deploys
`compose.yaml` by name, so `compose.override.yaml` and its host port are not
used there. The first build is slow and the backend image is several GB
(PyTorch CPU and the layout model). The proxy config trusts `X-Forwarded-For`
from private addresses only, so the upload and polling limits apply per visitor
behind Coolify's proxy; if your proxy reaches the site from a public address,
add it with `set_real_ip_from` in `nginx.pdf-import.conf`. The static-only deployment above is
unchanged and remains the default.

### Other static hosts

Any static host can serve the build output. `vercel.json` is also included for
Vercel, with the SPA rewrite and `bun` as the build toolchain:

```bash
bun run build
```

The build output is `dist/`.

## Acknowledgements

The idea, and several good patterns, come from
[dodolalorc/resume.dodolalorc.cn](https://github.com/dodolalorc/resume.dodolalorc.cn):
a theme registry that maps typed presets onto CSS custom properties,
canvas-free PDF export via `window.print()`, and a minimal, document-centred
workspace with a compact toolbar where you edit the resume on the page itself.
This is an independent implementation adapted for a bilingual
Indonesian/English audience rather than that project's Chinese
campus-recruiting one: edits are typed, plain-text drafts that are applied or
cancelled explicitly, each scoped to one language or shared by both, with
contextual forms on desktop and bottom sheets on phones.
