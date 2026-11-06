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

- [ ] Add failing tests for duplicate bullets, embedded newlines and whitespace.
- [ ] Expand DraftValue to string | DateDraft | string[]; read/write list drafts as cloned arrays. Only normalize edited rows.
- [ ] Narrow union consumers; update storyteller snapshots and invalidation tests.
- [ ] Run focused field/session/guidance/storyteller tests and commit.

## Task 2: Independent bullet targets

- [ ] Add failing tests for indexed edits, duplicate text, append/remove, fallback, cancellation, stale lists and undo.
- [ ] Add BulletRef: owner bullet, section experience/projects, entry id, key bullets, index number/append.
- [ ] Implement unique keys, specifications, existence checks and row read/write.
- [ ] Capture source lists in sessions; reject document/list changes. Fallback edits copy displayed bullets into the captured active locale only on a changed commit.
- [ ] Trim edited rows, discard blank additions, remove blank existing rows, and record one undo step per commit.
- [ ] Run focused tests and commit.

## Task 3: Paper interaction

- [ ] Replace combined-list regression with independent first/second-row tests.
- [ ] Add shared EditableBullets and dedicated BulletEditor; preserve ul/li print DOM.
- [ ] Add print-hidden Add action and Apply/Cancel/Remove surfaces with desktop anchoring/mobile sheet.
- [ ] Restore focus to saved row; after removal use next, previous, then Add. Resolve storyteller marks through parent references.
- [ ] Run section/mobile-print/storyteller tests and commit.

## Task 4: Explicit form rows

- [ ] Add failing component tests for edit/add/remove, focus identity, Enter/Escape and outer cancellation.
- [ ] Add shared BulletRows with array value, label, scope and onchange callback; visible bullet markers, row labels, SVG removal and Add.
- [ ] Keep stable local row ids and empty new drafts local. Escape restores opening value; Enter stops submission.
- [ ] Wire entry/PDF draft state; remove obsolete LinesField and One per line copy.
- [ ] Add English/Indonesian labels. Run focused component/import tests and commit.

## Task 5: Verification and documentation

- [ ] Update README; run full test suite, build and diff check.
- [ ] Check Chromium at 320, 375, 639, 640 and desktop widths, long/empty lists, keyboard/focus and mobile viewport resizing.
- [ ] Run verify:print and verify:ats; confirm Preview/Edit PDF equivalence and control exclusion.
- [ ] Review scoped diff and commit final documentation/fixes.

**Completion:** All highlight editors have explicit rows; selecting one never loads siblings; bilingual add/remove/cancel/undo and required automated/browser checks pass.
