import {
  applyDraft,
  entryRefs,
  itemExists,
  profileRefs,
  readDraft,
  refKey,
  sameDraft,
  type DraftValue,
  type FieldRef,
} from '$lib/editing/fields'
import type { Locale } from '$lib/model/types'
import type { ListSectionKind } from '$lib/sections/kinds'
import { getSectionModule } from '$lib/sections/registry'
import { resumeDoc } from './document.svelte'
import { prefs } from './preferences.svelte'

export type EditMode = 'preview' | 'edit'

export type EditTarget =
  | { kind: 'field'; ref: FieldRef }
  | { kind: 'entry'; section: ListSectionKind; id: string }
  | { kind: 'new-entry'; section: ListSectionKind }
  | { kind: 'profile' }

export interface StagedEntry {
  section: ListSectionKind
  item: { id: string; [key: string]: unknown }
}

export interface ActiveEdit {
  target: EditTarget
  refs: FieldRef[]
  /** What the document held when editing began, keyed by `refKey`. */
  original: Record<string, DraftValue>
  /** Raw text as typed; normalized only when applied. */
  draft: Record<string, DraftValue>
  /** Captured so a later language switch cannot redirect the write. */
  locale: Locale
  /** Document identity; a replaced document makes the edit stale. */
  generation: number
  staged?: StagedEntry
}

export type CommitResult = 'applied' | 'unchanged' | 'stale' | 'none'

const refsFor = (target: EditTarget, staged?: StagedEntry): FieldRef[] => {
  if (target.kind === 'field') return [target.ref]
  if (target.kind === 'entry') return entryRefs(target.section, target.id)
  if (target.kind === 'new-entry') return entryRefs(target.section, staged!.item.id)
  return profileRefs()
}

/**
 * Ephemeral, never persisted. One active target at a time; the document only
 * changes on commit, and the existing autosaver persists that change.
 */
class EditingSession {
  mode = $state<EditMode>('preview')
  active = $state.raw<ActiveEdit | null>(null)
  /** Settings is open: the draft is kept but its surface is hidden. */
  suspended = $state(false)
  /** The entry most recently confirmed from a staged draft, so the UI can focus it. */
  lastAdded = $state.raw<{ section: ListSectionKind; id: string } | null>(null)
  /** The entry whose actions are shown. */
  selected = $state.raw<{ section: ListSectionKind; id: string } | null>(null)
  /** Polite announcement for moves, deletions and additions. */
  announcement = $state('')

  select(section: ListSectionKind, id: string): void {
    if (this.selected?.section !== section || this.selected.id !== id) this.selected = { section, id }
  }

  /** A repeat of the same text toggles a zero-width space, so the live region changes and is read again. */
  announce(text: string): void {
    this.announcement = this.announcement === text ? `${text}\u200B` : text
  }

  enter(): void {
    this.mode = 'edit'
  }

  /** Done: apply whatever is open, then return to Preview. */
  finish(): void {
    this.commit()
    this.suspended = false
    this.selected = null
    this.mode = 'preview'
  }

  begin(target: EditTarget): boolean {
    if (this.mode !== 'edit') return false
    this.commit()

    const doc = resumeDoc.current
    const locale = prefs.documentLocale
    const staged: StagedEntry | undefined =
      target.kind === 'new-entry'
        ? { section: target.section, item: getSectionModule(target.section).emptyItem() }
        : undefined
    const refs = refsFor(target, staged)

    const original: Record<string, DraftValue> = {}
    for (const ref of refs) {
      const value = readDraft(doc, ref, locale, staged?.item)
      if (value === undefined) return false
      original[refKey(ref)] = value
    }

    this.suspended = false
    this.active = {
      target,
      refs,
      original,
      draft: structuredClone(original),
      locale,
      generation: resumeDoc.generation,
      ...(staged ? { staged } : {}),
    }
    return true
  }

  setDraft(key: string, value: DraftValue): void {
    const active = this.active
    if (!active || !(key in active.draft)) return
    this.active = { ...active, draft: { ...active.draft, [key]: value } }
  }

  get isStale(): boolean {
    const active = this.active
    if (!active) return false
    if (active.generation !== resumeDoc.generation) return true
    if (active.staged) return false
    return !active.refs.every((ref) => itemExists(resumeDoc.current, ref))
  }

  commit(): CommitResult {
    const active = this.active
    if (!active) return 'none'
    this.active = null
    this.suspended = false

    if (active.generation !== resumeDoc.generation) return 'stale'
    const doc = resumeDoc.current

    if (active.staged) {
      const { section, item } = active.staged
      for (const ref of active.refs) applyDraft(doc, ref, active.locale, active.draft[refKey(ref)]!, item)
      resumeDoc.addItem(section, item)
      this.lastAdded = { section, id: item.id }
      return 'applied'
    }

    if (!active.refs.every((ref) => itemExists(doc, ref))) return 'stale'
    const changed = active.refs.filter((ref) => !sameDraft(active.draft[refKey(ref)], active.original[refKey(ref)]))
    // One undo step for the whole form, however many fields it changed.
    resumeDoc.change(() => {
      for (const ref of changed) applyDraft(doc, ref, active.locale, active.draft[refKey(ref)]!)
    })
    return changed.length ? 'applied' : 'unchanged'
  }

  /**
   * Closing without choosing Apply or Cancel (an outside click): keeps what was
   * typed, but a new entry nobody typed into is dropped rather than added blank.
   */
  dismiss(): CommitResult {
    const active = this.active
    if (!active) return 'none'
    const untouched = active.refs.every((ref) => sameDraft(active.draft[refKey(ref)], active.original[refKey(ref)]))
    if (active.staged && untouched) {
      this.cancel()
      return 'unchanged'
    }
    return this.commit()
  }

  cancel(): void {
    this.active = null
    this.suspended = false
  }

  suspend(): void {
    if (this.active) this.suspended = true
  }

  resume(): void {
    this.suspended = false
  }

  /** After a confirmed import or reset: an edit of the old document must not land on the new one. */
  discardStale(): void {
    if (this.isStale) this.cancel()
  }

  setDocumentLocale(locale: Locale): void {
    this.commit()
    prefs.documentLocale = locale
  }

  setLayout(themeKey: string): void {
    this.commit()
    prefs.themeKey = themeKey
  }

  /** Test isolation for the module singleton. */
  reset(): void {
    this.mode = 'preview'
    this.active = null
    this.suspended = false
    this.lastAdded = null
    this.selected = null
    this.announcement = ''
  }
}

export const editing = new EditingSession()
