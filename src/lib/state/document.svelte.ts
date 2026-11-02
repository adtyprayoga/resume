import { emptyDocument } from '$lib/model/document'
import { resolve } from '$lib/model/resolve'
import { LOCALES, type Locale, type ResolvedResume, type ResumeDocument } from '$lib/model/types'
import type { ListSectionKind } from '$lib/sections/kinds'
import { getSectionModule } from '$lib/sections/registry'

interface Identified {
  id: string
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

  replace(doc: ResumeDocument): void {
    this.current = doc
    this.generation += 1
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

  addItem(kind: ListSectionKind): string {
    const item = getSectionModule(kind).emptyItem() as Identified
    this.list(kind).push(item)
    return item.id
  }

  removeItem(kind: ListSectionKind, id: string): void {
    const items = this.list(kind)
    const index = items.findIndex((item) => item.id === id)
    if (index >= 0) items.splice(index, 1)
  }

  /** Clamped at the ends. */
  moveItem(kind: ListSectionKind, id: string, delta: number): void {
    const items = this.list(kind)
    const from = items.findIndex((item) => item.id === id)
    if (from < 0) return

    const to = Math.min(items.length - 1, Math.max(0, from + delta))
    if (to === from) return

    const [moved] = items.splice(from, 1)
    if (moved) items.splice(to, 0, moved)
  }

  setSectionEnabled(kind: ListSectionKind, enabled: boolean): void {
    const section = this.current.sections.find((entry) => entry.kind === kind)
    if (section) section.enabled = enabled
  }

  /** Absolute reposition, for a drag landing on a specific row. */
  moveSectionTo(kind: ListSectionKind, toIndex: number): void {
    const sections = this.current.sections
    const from = sections.findIndex((entry) => entry.kind === kind)
    if (from < 0) return

    const to = Math.min(sections.length - 1, Math.max(0, toIndex))
    if (to === from) return

    const [moved] = sections.splice(from, 1)
    if (moved) sections.splice(to, 0, moved)
  }

  moveSection(kind: ListSectionKind, delta: number): void {
    const sections = this.current.sections
    const from = sections.findIndex((entry) => entry.kind === kind)
    if (from < 0) return

    const to = Math.min(sections.length - 1, Math.max(0, from + delta))
    if (to === from) return

    const [moved] = sections.splice(from, 1)
    if (moved) sections.splice(to, 0, moved)
  }

/** Only touches text: the structure is shared, so there is nothing to merge. */
  copyLocale(from: Locale, to: Locale): void {
    if (from === to) return

    const profile = this.current.profile.text
    profile[to] = structuredClone($state.snapshot(profile[from])) as typeof profile.en

    for (const kind of Object.keys(this.current.content) as ListSectionKind[]) {
      for (const item of this.list(kind) as unknown as Array<{
        text: Record<Locale, unknown>
      }>) {
        item.text[to] = structuredClone($state.snapshot(item.text[from]))
      }
    }
  }

  /** Fields blank in `locale` but filled in the other. */
  untranslatedCount(locale: Locale): number {
    const other = LOCALES.find((candidate) => candidate !== locale)
    if (!other) return 0

    const isBlank = (value: unknown) =>
      value === '' || (Array.isArray(value) && value.length === 0)

    let count = 0
    const compare = (a: Record<string, unknown>, b: Record<string, unknown>) => {
      for (const [key, value] of Object.entries(a)) {
        if (isBlank(value) && !isBlank(b[key])) count += 1
      }
    }

    compare(
      this.current.profile.text[locale] as unknown as Record<string, unknown>,
      this.current.profile.text[other] as unknown as Record<string, unknown>,
    )

    for (const kind of Object.keys(this.current.content) as ListSectionKind[]) {
      for (const item of this.list(kind) as unknown as Array<{
        text: Record<Locale, Record<string, unknown>>
      }>) {
        compare(item.text[locale], item.text[other])
      }
    }

    return count
  }
}

export const resumeDoc = new ResumeDocumentStore()
