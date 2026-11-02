# Resume Builder

A bilingual (Indonesian / English) resume builder that runs entirely in the
browser. No account, no server, no tracking: your resume lives in this browser's
local storage and exports to PDF through the browser's own print dialog.

The A4 preview fits the available screen width, while editor controls stay full
size. Browser pinch zoom remains available; screen scaling does not change the
exported PDF's dimensions or typography.

Built with Svelte 5, Vite and Tailwind v4.

## Why it works the way it does

**One resume, two languages.** The document has a single shared structure and a
per-item text node holding each locale. Adding a job adds it to both language
versions, so they cannot drift apart in shape, and shared facts — email, phone,
links, dates, company names — are stored once. Every field in the editor is
marked `BOTH` or `THIS` so it is obvious which values change when you switch
language.

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
switches layouts and languages through the toolbar, and prints to PDF. It then
extracts the text with `pdftotext`, in both normal and raw modes, and asserts
that every field appears once and in reading order. It also checks A4 pages,
margins, selectable text, embedded fonts, that the ATS output has no images,
controls, consent notices or page-guide labels, and that Classic still shows
the photo afterwards. The same output must come from phone and desktop preview
widths, with background graphics on or off. Generated PDFs are deleted on
success and kept for inspection on failure. Needs `chromium` and
`poppler-utils`.

## Layouts

The **Resume layout** buttons beside the language controls switch between two
presentations of the same content:

- **Classic** (the default) has a photo, a single contact line, and dates
  aligned on the right.
- **ATS** is plain single-column reading order for applicant tracking systems.
  It uses 11pt Arial or a close equivalent, puts each contact detail on its own
  line with full URLs, and lists each entry top to bottom: title, details,
  dates, then description or bullets. Skills appear as `Category: a, b, c`.
  It leaves the photo out.

Switching layouts changes presentation only. Content, section order, languages,
the stored photo and any unfinished edit stay as they are, and the choice is
remembered in this browser. The ATS layout aims for formatting that parsers
handle well; it is not a score and cannot guarantee that every system reads a
resume correctly. To see what a parser is likely to get, save the PDF and
select all of its text, or run `pdftotext resume.pdf -`, and read it top to
bottom.

## Printing

In the print dialog: choose **A4**, set margins to **Default** or **None**, and
turn **off** headers and footers. Browsers stamp a URL and date onto each page
and no stylesheet can suppress it.

The dashed red guides in the preview mark where each new page starts. They model
`break-inside: avoid` on entries and `break-after: avoid` on headings, but not
margin collapsing or widow and orphan control, so treat them as approximate —
the print preview is authoritative.

## Data

Your resume is held in this browser's local storage, which means clearing site
data will erase it. **Export JSON** regularly; **Import JSON** restores from a
file, a pasted payload or an `https` URL.

Every import is validated and reviewed before it replaces your resume. The
review shows the imported name and section counts; **Replace resume** applies
it to both languages. **Back** returns to the source inputs, and **Cancel** or
Escape leaves your current resume unchanged. Export your current JSON first if
you want to keep a copy.

The interface language and resume language are independent. Changing the
interface language translates controls and messages without changing your
resume content or discarding an unfinished field draft. In **Sections**, use
the move buttons, drag a section, or focus its handle and press the arrow keys
to change the order.

There is no server, so a photo cannot be uploaded anywhere. Choosing one resizes
it to 320px and embeds it in the document itself, which means it survives an
export and travels with the JSON — and is why it is resized rather than stored
whole, since the browser's storage budget is a few megabytes in total.

Imported data is validated field by field rather than trusted: containers must
have the right shape, leaves are coerced to safe defaults, URLs are restricted
to safe schemes (`javascript:` and `data:image/svg+xml` are rejected), and a file
from a newer schema version is refused rather than silently downgraded.

## Project layout

```text
src/
├─ lib/
│  ├─ model/        document shape, resolve(), validation, migration, sanitizing
│  ├─ sections/     one folder per section: descriptor, Preview, Editor
│  ├─ state/        reactive stores and the autosave logic
│  ├─ storage/      versioned localStorage read/write
│  ├─ pagination/   pure page-break simulation plus DOM measurement
│  ├─ print/        the print trigger
│  ├─ themes/       typed theme presets to CSS custom properties
│  └─ i18n/         interface strings only, never resume content
├─ components/      preview, editor and the two side-effect hosts
└─ styles/
   ├─ print.css     everything governing how the resume prints
   └─ paper.css     screen-only preview chrome
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

### Other static hosts

Any static host can serve the build output. `vercel.json` is also included for
Vercel, with the SPA rewrite and `bun` as the build toolchain:

```bash
bun run build
```

The build output is `dist/`.

## Acknowledgements

The idea, and two good patterns, come from
[dodolalorc/resume.dodolalorc.cn](https://github.com/dodolalorc/resume.dodolalorc.cn):
a theme registry that maps typed presets onto CSS custom properties, and
canvas-free PDF export via `window.print()`. This is an independent
implementation, written for a bilingual Indonesian/English audience rather than
that project's Chinese campus-recruiting one.
