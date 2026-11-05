import { readDraft, refKey, sameDraft, type FieldRef } from '$lib/editing/fields'
import type { Locale } from '$lib/model/types'
import type { Written } from '$lib/guidance/apply'
import { resumeDoc, type DocumentChangeEvent } from './document.svelte'
import { prefs } from './preferences.svelte'

interface Mark {
  ref: FieldRef
  locale: Locale
  value: Written['value']
  identity: number
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
      if (!sameDraft(readDraft(event.before, mark.ref, mark.locale), readDraft(event.after, mark.ref, mark.locale))) {
        delete this.marks[key]
      }
    }
  }

  add(written: Written[]): void {
    for (const entry of written) {
      if (!sameDraft(readDraft(resumeDoc.current, entry.ref, entry.locale), entry.value)) continue
      this.marks[this.key(entry.locale, entry.ref)] = { ...entry, identity: resumeDoc.identity }
    }
  }

  isHighlighted(ref: FieldRef): boolean {
    const mark = this.marks[this.key(prefs.documentLocale, ref)]
    return !!mark && mark.identity === resumeDoc.identity &&
      sameDraft(readDraft(resumeDoc.current, ref, mark.locale), mark.value)
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
