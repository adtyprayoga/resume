import { emptyDocument } from '$lib/model/document'
import { resolve } from '$lib/model/resolve'
import { LOCALES, type Locale, type ResolvedResume, type ResumeDocument } from '$lib/model/types'
import type { ListSectionKind } from '$lib/sections/kinds'
import { getSectionModule } from '$lib/sections/registry'

/** The single rule for "untranslated", shared by the count and the fill. */
const isBlank = (value: unknown): boolean =>
  value === '' || (Array.isArray(value) && value.length === 0)

/** Undo steps kept; the oldest is dropped first. */
export const HISTORY_LIMIT = 100

interface Identified {
  id: string
  [key: string]: unknown
}

export interface DocumentChangeEvent {
  before: ResumeDocument
  after: ResumeDocument
  kind: 'change' | 'undo' | 'redo' | 'replace' | 'load'
}

/**
 * A `const` instance, not an exported `$state` binding: the compiler forbids
 * reassigning an exported `$state`, and rune references are rewritten per file,
 * so importers would get the raw proxy rather than the value.
 */
class ResumeDocumentStore {
  current = $state<ResumeDocument>(emptyDocument())
  /** Bumped on every wholesale replacement, so per-document session state can tell documents apart. */
  generation = $state(0)
  /**
   * Bumped only when a different document arrives (replace or load), not when
   * undo or redo restores a version of this one; consent to load a remote photo
   * is keyed on it.
   */
  identity = $state(0)

  /**
   * Session-only history of whole-document snapshots, never persisted. The
   * stacks are plain arrays so snapshots are not proxied; the counts make
   * `canUndo`/`canRedo` reactive.
   */
  private undoStack: ResumeDocument[] = []
  private redoStack: ResumeDocument[] = []
  private undoCount = $state(0)
  private redoCount = $state(0)
  private depth = 0
  private listeners = new Set<(event: DocumentChangeEvent) => void>()

  subscribeChanges(listener: (event: DocumentChangeEvent) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private notify(before: ResumeDocument, after: ResumeDocument, kind: DocumentChangeEvent['kind']): void {
    for (const listener of this.listeners) listener({ before: structuredClone(before), after: structuredClone(after), kind })
  }

  get canUndo(): boolean {
    return this.undoCount > 0
  }

  get canRedo(): boolean {
    return this.redoCount > 0
  }

  /**
   * Runs `fn` as one undo step. Nested calls fold into the outermost one, and a
   * step that leaves the document unchanged records nothing.
   */
  change<T>(fn: () => T): T {
    if (this.depth > 0) return fn()

    const before = this.snapshot()
    const beforeJson = JSON.stringify(before)
    const beforeIdentity = this.identity
    this.depth += 1
    try {
      return fn()
    } finally {
      this.depth -= 1
      const after = this.snapshot()
      const changed = JSON.stringify(after) !== beforeJson
      if (changed) {
        this.undoStack.push(before)
        if (this.undoStack.length > HISTORY_LIMIT) this.undoStack.shift()
        this.redoStack = []
        this.syncCounts()
      }
      if (this.identity !== beforeIdentity) this.notify(before, after, 'replace')
      else if (changed) this.notify(before, after, 'change')
    }
  }

  /** A user action (import, reset, start blank): one undoable step. */
  replace(doc: ResumeDocument): void {
    this.change(() => {
      this.current = doc
      this.generation += 1
      this.identity += 1
    })
  }

  /** Startup and recovery: the loaded document starts a fresh history. */
  load(doc: ResumeDocument): void {
    const before = this.snapshot()
    this.current = doc
    this.generation += 1
    this.identity += 1
    this.undoStack = []
    this.redoStack = []
    this.syncCounts()
    this.notify(before, this.snapshot(), 'load')
  }

  undo(): boolean {
    return this.restore(this.undoStack, this.redoStack, 'undo')
  }

  redo(): boolean {
    return this.restore(this.redoStack, this.undoStack, 'redo')
  }

  /** A restore is a wholesale replacement, so open drafts of the old state go stale. */
  private restore(from: ResumeDocument[], to: ResumeDocument[], kind: 'undo' | 'redo'): boolean {
    const previous = from.pop()
    if (!previous) return false
    const before = this.snapshot()
    to.push(before)
    this.current = previous
    this.generation += 1
    this.syncCounts()
    this.notify(before, previous, kind)
    return true
  }

  private syncCounts(): void {
    this.undoCount = this.undoStack.length
    this.redoCount = this.redoStack.length
  }

  /** Unproxied copy. Everything leaving the store for serialisation goes through this. */
  snapshot(): ResumeDocument {
    return $state.snapshot(this.current) as ResumeDocument
  }

  resolved(locale: Locale): ResolvedResume {
    return resolve(this.current, locale)
  }

  private list(kind: ListSectionKind): Identified[] {
    return this.current.content[kind] as unknown as Identified[]
  }

  /** `prepared` is a staged entry confirmed by the editor; otherwise a blank item. */
  addItem(kind: ListSectionKind, prepared?: Identified): string {
    return this.change(() => {
      const item = prepared ?? (getSectionModule(kind).emptyItem() as Identified)
      this.list(kind).push(item)
      return item.id
    })
  }

  removeItem(kind: ListSectionKind, id: string): void {
    this.change(() => {
      const items = this.list(kind)
      const index = items.findIndex((item) => item.id === id)
      if (index >= 0) items.splice(index, 1)
    })
  }

  /** Clamped at the ends. */
  moveItem(kind: ListSectionKind, id: string, delta: number): void {
    this.change(() => {
      const items = this.list(kind)
      const from = items.findIndex((item) => item.id === id)
      if (from < 0) return

      const to = Math.min(items.length - 1, Math.max(0, from + delta))
      if (to === from) return

      const [moved] = items.splice(from, 1)
      if (moved) items.splice(to, 0, moved)
    })
  }

  setSectionEnabled(kind: ListSectionKind, enabled: boolean): void {
    this.change(() => {
      const section = this.current.sections.find((entry) => entry.kind === kind)
      if (section) section.enabled = enabled
    })
  }

  /** Absolute reposition, for a drag landing on a specific row. */
  moveSectionTo(kind: ListSectionKind, toIndex: number): void {
    this.change(() => {
      const sections = this.current.sections
      const from = sections.findIndex((entry) => entry.kind === kind)
      if (from < 0) return

      const to = Math.min(sections.length - 1, Math.max(0, toIndex))
      if (to === from) return

      const [moved] = sections.splice(from, 1)
      if (moved) sections.splice(to, 0, moved)
    })
  }

  moveSection(kind: ListSectionKind, delta: number): void {
    this.change(() => {
      const sections = this.current.sections
      const from = sections.findIndex((entry) => entry.kind === kind)
      if (from < 0) return

      const to = Math.min(sections.length - 1, Math.max(0, from + delta))
      if (to === from) return

      const [moved] = sections.splice(from, 1)
      if (moved) sections.splice(to, 0, moved)
    })
  }

/** Profile text plus every list item's text, keyed by locale. */
  private textRecords(): Array<Record<Locale, Record<string, unknown>>> {
    const records = [this.current.profile.text as unknown as Record<Locale, Record<string, unknown>>]
    for (const kind of Object.keys(this.current.content) as ListSectionKind[]) {
      for (const item of this.list(kind) as unknown as Array<{ text: Record<Locale, Record<string, unknown>> }>) {
        records.push(item.text)
      }
    }
    return records
  }

  /**
   * Copies only fields blank in `to` but filled in `from`. It never overwrites:
   * text someone already translated is theirs, and undo is a net, not a licence.
   */
  fillUntranslated(from: Locale, to: Locale): void {
    this.change(() => {
      if (from === to) return

      for (const record of this.textRecords()) {
        const source = record[from]
        const target = record[to]
        for (const [key, value] of Object.entries(target)) {
          if (isBlank(value) && !isBlank(source[key])) {
            target[key] = structuredClone($state.snapshot(source[key]))
          }
        }
      }
    })
  }

  /** Fields blank in `locale` but filled in the other. */
  untranslatedCount(locale: Locale): number {
    const other = LOCALES.find((candidate) => candidate !== locale)
    if (!other) return 0

    let count = 0
    for (const record of this.textRecords()) {
      for (const [key, value] of Object.entries(record[locale])) {
        if (isBlank(value) && !isBlank(record[other][key])) count += 1
      }
    }
    return count
  }
}

export const resumeDoc = new ResumeDocumentStore()
