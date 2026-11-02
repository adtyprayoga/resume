import { emptyDocument } from '$lib/model/document'
import { resolve } from '$lib/model/resolve'
import { LOCALES, type Locale, type ResolvedResume, type ResumeDocument } from '$lib/model/types'
import type { ListSectionKind } from '$lib/sections/kinds'
import { getSectionModule } from '$lib/sections/registry'

/** Minimum shape every section item shares, enough to find one by id. */
interface Identified {
  id: string
}

/**
 * Holds the live document.
 *
 * Exported as a `const` class instance, not an exported `$state` binding: the
 * compiler forbids reassigning an exported `$state` variable, and rune
 * references are rewritten one file at a time, so an importing module would
 * receive the raw proxy object rather than the unwrapped value.
 */
class ResumeDocumentStore {
  current = $state<ResumeDocument>(emptyDocument())

  /** Replaces the whole document (load from storage, import, reset to sample). */
  replace(doc: ResumeDocument): void {
    this.current = doc
  }

  /**
   * A plain, unproxied copy. Everything leaving the store for serialisation,
   * structural cloning or deep comparison must go through this.
   */
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

  /**
   * Moves an item by `delta` positions, clamped at the ends.
   *
   * Resumes are reverse-chronological and people add roles out of order, so
   * reordering within a section is not optional.
   */
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

  moveSection(kind: ListSectionKind, delta: number): void {
    const sections = this.current.sections
    const from = sections.findIndex((entry) => entry.kind === kind)
    if (from < 0) return

    const to = Math.min(sections.length - 1, Math.max(0, from + delta))
    if (to === from) return

    const [moved] = sections.splice(from, 1)
    if (moved) sections.splice(to, 0, moved)
  }

  /**
   * Copies every text field from one locale over the other, so starting the
   * second language is a bootstrap rather than re-entry. Because the structure
   * is shared, this only ever touches text — the two versions cannot differ in
   * shape, so there is nothing to merge.
   */
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

  /** Field paths left blank in `locale` but filled in the other one. */
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
