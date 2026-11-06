import { readDraft, refKey, sameDraft, specFor, type FieldRef } from '$lib/editing/fields'
import type { Locale, ResumeDocument } from '$lib/model/types'
import type { Written } from '$lib/guidance/apply'
import { resumeDoc, type DocumentChangeEvent } from './document.svelte'
import { prefs } from './preferences.svelte'

interface Mark {
  ref: FieldRef
  locale: Locale
  value: Written['value']
  /** For list fields: only these lines are marked. */
  lines?: string[]
  identity: number
}

const storedValue = (doc: ResumeDocument, ref: FieldRef, locale: Locale): unknown => {
  if (ref.owner === 'profile') return doc.profile.text[locale][ref.key]
  if (ref.owner === 'contact') return doc.contact[ref.key]
  const items = doc.content[ref.section] as unknown as Array<{
    id: string
    text: Record<Locale, Record<string, unknown>>
    [key: string]: unknown
  }>
  const item = items.find((entry) => entry.id === ref.id)
  return specFor(ref).scope === 'shared' ? item?.[ref.key] : item?.text[locale]?.[ref.key]
}

class StoryHighlights {
  private marks = $state<Record<string, Mark>>({})
  private unsubscribe = resumeDoc.subscribeChanges((event) => this.invalidate(event))

  private key(locale: Locale, ref: FieldRef): string {
    return `${locale}:${refKey(ref)}`
  }

  private invalidate(event: DocumentChangeEvent): void {
    if (event.kind === 'replace' || event.kind === 'load') {
      this.clear()
      return
    }
    for (const [key, mark] of Object.entries(this.marks)) {
      if (JSON.stringify(storedValue(event.before, mark.ref, mark.locale)) !==
        JSON.stringify(storedValue(event.after, mark.ref, mark.locale))) {
        delete this.marks[key]
      }
    }
  }

  add(written: Written[]): void {
    for (const entry of written) {
      if (!sameDraft(readDraft(resumeDoc.current, entry.ref, entry.locale), entry.value)) continue
      if (entry.lines && entry.lines.length === 0) continue
      this.marks[this.key(entry.locale, entry.ref)] = { ...entry, identity: resumeDoc.identity }
    }
  }

  /** `shown` is the text being rendered; for a list field only the added lines match. */
  isHighlighted(ref: FieldRef, shown?: string): boolean {
    if (ref.owner === 'bullet') ref = { owner: 'item', section: ref.section, id: ref.id, key: 'bullets' }
    const mark = this.marks[this.key(prefs.documentLocale, ref)]
    if (!mark || mark.identity !== resumeDoc.identity) return false
    if (mark.lines && (shown === undefined || !mark.lines.includes(shown))) return false
    return sameDraft(readDraft(resumeDoc.current, ref, mark.locale), mark.value)
  }

  get count(): number {
    return Object.values(this.marks).filter((mark) =>
      mark.locale === prefs.documentLocale && mark.identity === resumeDoc.identity &&
      sameDraft(readDraft(resumeDoc.current, mark.ref, mark.locale), mark.value),
    ).length
  }

  clear(): void {
    this.marks = {}
  }

  reset(): void {
    this.unsubscribe()
    this.clear()
    this.unsubscribe = resumeDoc.subscribeChanges((event) => this.invalidate(event))
  }
}

export const storyHighlights = new StoryHighlights()
