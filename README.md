# Resume Builder

A bilingual (Indonesian / English) resume builder that runs entirely in the
browser. No account, no server, no tracking: your resume lives in this browser's
local storage and exports to PDF through the browser's own print dialog.

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

Any static host works. `vercel.json` is included for Vercel, with the SPA
rewrite and `bun` as the build toolchain:

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
