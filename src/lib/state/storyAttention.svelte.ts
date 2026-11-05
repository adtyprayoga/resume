import { gapIds } from '$lib/guidance/story'
import { resolve } from '$lib/model/resolve'
import { LOCALES, type Locale, type ResumeDocument } from '$lib/model/types'
import { resumeDoc, type DocumentChangeEvent } from './document.svelte'
import { emptyStoryAttention, prefs } from './preferences.svelte'

class StoryAttention {
  private unsubscribe: (() => void) | undefined
  private sequence = 0
  private occurrence = $state<Record<Locale, number>>({ en: 0, id: 0 })

  /** Call once after preferences hydration and the startup document load. */
  start(): void {
    if (this.unsubscribe) return
    this.sequence = 0
    this.occurrence = { en: 0, id: 0 }
    this.reconcile(resumeDoc.current, true)
    this.unsubscribe = resumeDoc.subscribeChanges((event) => this.onChange(event))
  }

  /** Call from the mounting effect's cleanup. */
  stop(): void {
    this.unsubscribe?.()
    this.unsubscribe = undefined
  }

  private onChange(event: DocumentChangeEvent): void {
    if (event.kind === 'replace' || event.kind === 'load') {
      prefs.storyAttention = emptyStoryAttention()
    }
    this.reconcile(event.after, false)
  }

  private reconcile(doc: ResumeDocument, initial: boolean): void {
    for (const locale of LOCALES) this.reconcileLocale(doc, locale, initial)
  }

  private reconcileLocale(doc: ResumeDocument, locale: Locale, initial: boolean): void {
    const previous = prefs.storyAttention[locale]
    const present = gapIds(doc, locale)
    const presentSet = new Set(present)
    const seen = previous.seen.filter((id) => presentSet.has(id))
    const previousPresent = new Set(previous.present)
    const seenSet = new Set(seen)
    const newUnseen = present.filter((id) => !seenSet.has(id) && (initial || !previousPresent.has(id)))
    for (const _id of newUnseen) this.occurrence[locale] = ++this.sequence
    if (present.length === previous.present.length &&
      present.every((id, index) => id === previous.present[index]) &&
      seen.length === previous.seen.length) return
    prefs.storyAttention[locale] = { present, seen }
  }

  /** Marks the current active-language gaps seen, after any pending edit was committed. */
  acknowledge(): void {
    this.reconcileLocale(resumeDoc.current, prefs.documentLocale, false)
    const locale = prefs.documentLocale
    const current = prefs.storyAttention[locale]
    prefs.storyAttention[locale] = { present: current.present, seen: [...current.present] }
  }

  get ready(): boolean {
    const locale = prefs.documentLocale
    const profile = resolve(resumeDoc.current, locale).profile
    return !!profile.name.trim() && !!profile.headline.trim() && prefs.storyAttention[locale].present.length > 0
  }

  get pulse(): boolean {
    if (!this.ready) return false
    const { present, seen } = prefs.storyAttention[prefs.documentLocale]
    const seenSet = new Set(seen)
    return present.some((id) => !seenSet.has(id))
  }

  get pulseOccurrence(): number {
    return this.occurrence[prefs.documentLocale]
  }
}

export const storyAttention = new StoryAttention()
