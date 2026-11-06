# Single-Bullet Editing Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans task by task, with a failing-test → implementation → passing-test cycle.

**Goal:** Edit exactly the bullet selected, with explicit controls to add and remove individual highlights.

**Architecture:** Keep stored `bullets: string[]`. Add typed bullet-row references and array-valued list drafts; share explicit row controls between entry forms and PDF review.

**Tech stack:** Svelte 5, TypeScript, existing CSS tokens, Vitest, Chromium. No new dependencies.

## Behavior and constraints

- Cover Experience and Projects in Classic/ATS, entry forms, and PDF review.
- One selected bullet per editor; wrapping text, Enter saves, Escape cancels, IME confirmation does not save. Multiline paste remains one bullet.
- Add highlight opens a staged draft; empty/cancelled additions create nothing. Remove exists in individual editors and forms; clearing a saved bullet removes it.
- Full forms retain outer Apply/Cancel; Enter finishes a row without submitting the form.
- Preserve duplicates, untouched strings, locale independence, undo/export behavior and stored schema.
- All controls are print-hidden, translated, use existing SVG icons/tokens and 44px targets. Mobile uses the existing full-size sheet below 640px.
- Preserve printed structure/reading order. Skills and technology tags stay unchanged.

## Task 1: Preserve arrays in drafts

- [x] Add failing tests for duplicate bullets, embedded newlines and whitespace.
- [x] Expand DraftValue to string | DateDraft | string[]; read/write list drafts as cloned arrays. Only normalize edited rows.
- [x] Narrow union consumers; update storyteller snapshots and invalidation tests.
- [x] Run focused field/session/guidance/storyteller tests and commit.

## Task 2: Independent bullet targets

- [x] Add failing tests for indexed edits, duplicate text, append/remove, fallback, cancellation, stale lists and undo.
- [x] Add BulletRef: owner bullet, section experience/projects, entry id, key bullets, index number/append.
- [x] Implement unique keys, specifications, existence checks and row read/write.
- [x] Capture source lists in sessions; reject document/list changes. Fallback edits copy displayed bullets into the captured active locale only on a changed commit.
- [x] Trim edited rows, discard blank additions, remove blank existing rows, and record one undo step per commit.
- [x] Run focused tests and commit.

## Task 3: Paper interaction

- [x] Replace combined-list regression with independent first/second-row tests.
- [x] Add shared EditableBullets and dedicated BulletEditor; preserve ul/li print DOM.
- [x] Add print-hidden Add action and Apply/Cancel/Remove surfaces with desktop anchoring/mobile sheet.
- [x] Restore focus to saved row; after removal use next, previous, then Add. Resolve storyteller marks through parent references.
- [x] Run section/mobile-print/storyteller tests and commit.

## Task 4: Explicit form rows

- [x] Add failing component tests for edit/add/remove, focus identity, Enter/Escape and outer cancellation.
- [x] Add shared BulletRows with array value, label, scope and onchange callback; visible bullet markers, row labels, SVG removal and Add.
- [x] Keep stable local row ids and empty new drafts local. Escape restores opening value; Enter stops submission.
- [x] Wire entry/PDF draft state; remove obsolete LinesField and One per line copy.
- [x] Add English/Indonesian labels. Run focused component/import tests and commit.

## Task 5: Verification and documentation

- [x] Update README; run full test suite, build and diff check.
- [x] Check Chromium at 320, 375, 639, 640 and desktop widths, long/empty lists, keyboard/focus and mobile viewport resizing.
- [x] Run verify:print and verify:ats; confirm Preview/Edit PDF equivalence and control exclusion.
- [x] Review scoped diff and commit final documentation/fixes.

**Completion:** All highlight editors have explicit rows; selecting one never loads siblings; bilingual add/remove/cancel/undo and required automated/browser checks pass.

## Verification results

- `bun run test`: 1,229 passed, 1 existing skipped test (74 passing files, 1 skipped).
- `bun run build`: zero Svelte errors/warnings; production build passed.
- `git diff --check`: passed.
- `bun run verify:print http://127.0.0.1:5173/`: passed; A4, selectable text and page margins confirmed.
- `bun run verify:ats http://127.0.0.1:5173/`: passed, including Classic/ATS Preview/Edit equivalence, text order, print exclusions and responsive checks.
- Additional Chromium interactions: 352 checks passed across Classic/ATS, English/Indonesian, 320/375/639/640/1280px widths, long/empty lists, individual saves, form markers/spacing, Add focus, Escape cancellation and reduced mobile viewport height.
- Final review added regressions for untouched whitespace-only siblings and section/language isolation. Stored schema, theme presets and print styles were unchanged.

## Follow-up: Enter continues the bullet list

The user changed the keyboard behavior after reviewing the single-bullet editor:

- Enter saves the current nonempty bullet and opens a fresh, focused input immediately after it, including in entry forms and PDF review.
- Alt+Enter inserts a line break at the caret or replaces the selection, within the same bullet. Preserve that break on screen and in PDF output.
- New blank inputs are session-only, print-hidden, and discarded on cancellation/empty completion. IME confirmation must not continue the list.
- Apply and Ctrl/Cmd+Enter retain explicit completion; Escape cancels the current draft. Keep locale, stale-edit, undo and form-transaction behavior.

Implementation: optional insertion position on BulletRef, session continuation, a print-hidden draft-row anchor, shared keyboard interpretation/native textarea insertion, localized shortcut hints, and regression/browser/PDF checks.

Follow-up verification: 1,237 tests passed (1 existing skipped), zero Svelte diagnostics, production build and diff checks passed. Print/ATS verification passed. Chromium keyboard checks passed 140 assertions across both layouts/languages and 375/640/1280px, including next-input focus, insertion position, Alt+Enter, form cancellation and PDF line breaks; an additional bottom-of-viewport continuation check passed.
