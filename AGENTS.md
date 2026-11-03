# AGENTS.md

This file provides guidance to Claude Code (claude.ai/code) and other coding agents when working with code in this repository.

A bilingual (Indonesian / English) resume builder that runs entirely in the browser: Svelte 5 (runes), Vite, Tailwind v4, TypeScript, Bun. No server, no account; data lives in localStorage and PDF export is the browser's print dialog. `README.md` is the user-facing source of truth for behaviour.

## Commands

```bash
bun install
bun run dev                 # http://localhost:5173
bun run test                # Vitest (jsdom). Use `bun run test`, not `bun test` (Bun's own runner).
bun run test src/lib/model/dates.test.ts          # one file
bun run test src/lib/model -t "rejects javascript" # filter by test name
bun run type-check          # svelte-check
bun run build               # type-check + vite build
bun run verify:print        # needs `bun run dev` running, plus chromium + poppler-utils
bun run verify:ats          # starts its own dev server; needs chromium + poppler-utils
```

jsdom has no layout engine (`offsetHeight` is 0, rects are zeros) and Vitest does not process CSS (`?raw` CSS imports come back empty; tests use `readFileSync`, see `src/lib/themes/ats.test.ts`). Anything about page geometry, print output, or text-extraction order is only verified by `verify:print` / `verify:ats`. Run them after any change that could affect the printed page.

## Architecture

**Document model (`src/lib/model`).** A single shared structure; each item has one `text: Record<Locale, Text>` node holding per-locale strings, while shared facts (dates, URLs, contact, ids) are stored once. `resolve()` flattens a document for one locale into the `Resolved*` shape that every preview component reads. Imports are never trusted: `validate`/`coerce`/`sanitize` coerce field by field, restrict URL schemes, and `migrate` refuses newer `SCHEMA_VERSION`s.

**Sections (`src/lib/sections`).** One folder per list section (`index.ts` descriptor + `Preview.svelte`), discovered by `import.meta.glob` in `registry.ts`. Adding a section = new folder + entry in `kinds.ts`; `registry.test.ts` fails if the two drift. Glob order is lexicographic, so each module declares `order`.

**State (`src/lib/state`).** Stores are `const` class instances with `$state` fields (exported `$state` bindings can't be reassigned). `resumeDoc` holds the document and a `generation` counter bumped on wholesale replacement (import/reset) so per-document session state can detect staleness. `editing` is the ephemeral edit session: Preview/Edit mode, one active target, a raw draft kept separate from the document until commit. `prefs` holds UI/document locale, theme, font scale, save status. `recovery` blocks the app behind `RecoveryScreen` when stored data is unreadable. `App.svelte` calls `prefs.hydrate()` and `recovery.open()` before `PersistenceHost` mounts so autosave can't overwrite stored work with the sample.

**Editing (`src/lib/editing`, `src/components/editing`).** Edit targets are typed (profile/contact field or section + item id), never derived from displayed text. Desktop: native input/textarea positioned over the text via `trackAnchor` (`src/lib/ui/anchor.ts`) or a small `FormPopover`. Below 640px (`(max-width: 639px)` in `EditLayer`/`EntryShell`) the form opens in a bottom sheet. Opening Import calls `editing.suspend()`/`resume()`; toggling the Sections or Settings side panel (nonmodal) and section navigation/reordering call `editing.dismiss()`; changing document locale or layout commits first; every export path calls `commitForExport()` (also on `beforeprint`). Elements marked `data-keeps-draft` don't commit the inline draft on blur.

**Paper and print.** `ResumePaper` renders both presentations (`classic` and `ats`) from the same content; themes in `src/lib/themes/presets` (also glob-registered) map to CSS custom properties via `buildThemeStyleVars`, with fallbacks in `print.css`. Invariants that look odd but are deliberate (see README "Why it works the way it does"):
- Page margins live on `@page`, not padding on the element.
- The paper is block flow, not flex/grid (pagination and `gap` misbehave across page breaks); spacing uses margins.
- The default theme uses no background fills; theme colours are hex, not OKLCH.
- Preview scaling uses `zoom` on `.resume-paper-frame`, not `transform`; in-paper controls divide sizes by `--preview-zoom` to stay 44px on screen.
- Anything not part of the resume carries `data-print-hide`. Edit mode must print exactly what Preview prints; in-paper positioning is screen-only because a positioned box changes PDF text order.
- The ATS layout's reading order is asserted by `verify:ats`; don't reorder its DOM casually.

**Pagination (`src/lib/pagination`).** `paginate.ts` is a pure page-break simulation (unit-tested); `measure.ts` reads the DOM. The page-break overlay is approximate; the print preview is authoritative.

**i18n (`src/lib/i18n/ui.ts`).** Interface strings only, never resume content. Interface language and document language are independent.

## Conventions

- UI: icons are bundled inline SVG paths in `src/components/shell/Icon.svelte` (no icon library); every control has a translated accessible name and a ≥44px target.
- Styling is plain CSS files per area (`shell.css`, `drawer.css`, `field.css`, `editing.css`, `paper.css`) imported from `src/app.css`; Tailwind is used mainly for `@theme` and utilities like `sr-only`. There is no `screen:` variant, hence hand-written screen-only CSS.
- Plans live in `docs/superpowers/plans/` and are executed task-by-task with a failing test first.

## Design system (in progress)

`design.md` is the target visual system (Minimalism & Swiss Style). It is being applied to the **app chrome only**; the printed resume (`print.css`, theme presets) must not change. The implementation plan, including how the spec's internal contradictions were resolved and the exact token values, is `docs/superpowers/plans/2026-11-02-swiss-design-system.md`. Key rules once implemented:
- All chrome colours, type sizes, shadows, z-indices and motion values come from `src/styles/tokens.css`. Use the off-black `#111111` ink, never pure black; secondary text is `#4d4d4d` (`#808080` is for borders only). Text contrast must be ≥7:1 (WCAG AAA).
- Square corners (radius 0), except the outer Sections/Settings popup below 640px: `--radius-mobile-panel` (16px), confined to the mobile `.side-panel` rule in `shell.css`. Its controls and all tablet/desktop panels stay square. Z-index only via `--z-base|sticky|overlay|modal|toast` (0/100/200/300/500).
- Animate only opacity/transform; hover transitions are 200ms and may change colour/shadow; respect `prefers-reduced-motion`.
- No emoji or symbol glyphs as icons, no cliché copy ("Elevate", "Seamless", "Unleash", "Next-Gen"), no `100vh` (use `100dvh`).
- The paper and everything inside it stay light in dark mode.
- `src/styles/designContract.test.ts` audits stylesheets against these rules.
