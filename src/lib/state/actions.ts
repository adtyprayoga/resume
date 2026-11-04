import { t } from '$lib/i18n/ui'
import { emptyDocument } from '$lib/model/document'
import type { Locale } from '$lib/model/types'
import { resumeDoc } from './document.svelte'
import { editing } from './editing.svelte'

/** Replaces the document with an empty one; an open draft belongs to the old document and is dropped. */
export const startBlank = (): void => {
  editing.cancel()
  resumeDoc.replace(emptyDocument())
}

/**
 * Settles the open draft first: real changes are committed as their own step
 * (and so are what this undo takes back); an untouched new entry is dropped.
 */
export const undo = (uiLocale: Locale): boolean => {
  editing.dismiss()
  if (!resumeDoc.undo()) return false
  editing.announce(t(uiLocale, 'history.undone'))
  return true
}

export const redo = (uiLocale: Locale): boolean => {
  editing.dismiss()
  if (!resumeDoc.redo()) return false
  editing.announce(t(uiLocale, 'history.redone'))
  return true
}
