import { serializeResume } from '$lib/io/exportJson'
import { validateDocument } from '$lib/model/document'
import { migrate } from '$lib/model/migrate'
import type { ResumeDocument } from '$lib/model/types'

export const DOCUMENT_KEY = 'resume-document-v1'
export const PREFERENCES_KEY = 'resume-preferences-v1'

export type SaveStatus =
  | { kind: 'idle' }
  | { kind: 'saved'; at: number }
  | { kind: 'error'; message: string }

/**
 * Reading `globalThis.localStorage` can itself throw when storage is blocked by
 * the browser's privacy settings, so access is guarded rather than assumed.
 */
const defaultStorage = (): Storage | null => {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

/**
 * `undefined` means "use this browser's storage"; `null` means "there is none".
 * A default parameter value cannot express that, because it also fires on an
 * explicitly passed `undefined`.
 */
const resolveStorage = (storage: Storage | null | undefined): Storage | null =>
  storage === undefined ? defaultStorage() : storage

/** A quota failure must be visible: a silent one loses the user's work. */
const isQuotaError = (cause: unknown): boolean =>
  cause instanceof DOMException &&
  (cause.name === 'QuotaExceededError' || cause.name === 'NS_ERROR_DOM_QUOTA_REACHED')

export const saveDocument = (
  doc: ResumeDocument,
  storage?: Storage | null,
): SaveStatus => {
  const target = resolveStorage(storage)
  if (!target) return { kind: 'error', message: 'This browser has no local storage available.' }

  try {
    target.setItem(DOCUMENT_KEY, serializeResume(doc))
    return { kind: 'saved', at: Date.now() }
  } catch (cause) {
    if (isQuotaError(cause)) {
      return {
        kind: 'error',
        message:
          'Out of browser storage, so this change was not saved. A large embedded avatar is the usual cause — use an image URL instead, then export your JSON as a backup.',
      }
    }
    return { kind: 'error', message: 'This change could not be saved to this browser.' }
  }
}

/** Returns null for absent or unusable stored data rather than throwing. */
export const loadDocument = (storage?: Storage | null): ResumeDocument | null => {
  const target = resolveStorage(storage)
  if (!target) return null

  let raw: string | null
  try {
    raw = target.getItem(DOCUMENT_KEY)
  } catch {
    return null
  }
  if (!raw) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }

  const migrated = migrate(parsed)
  if (!migrated.ok) return null

  const validated = validateDocument(migrated.value)
  return validated.ok ? validated.value : null
}

export const clearDocument = (storage?: Storage | null): void => {
  try {
    resolveStorage(storage)?.removeItem(DOCUMENT_KEY)
  } catch {
    // Nothing useful to do if removal fails.
  }
}

export const savePreferences = <T>(prefs: T, storage?: Storage | null): void => {
  try {
    resolveStorage(storage)?.setItem(PREFERENCES_KEY, JSON.stringify(prefs))
  } catch {
    // Preferences are cosmetic; losing them is not worth surfacing.
  }
}

export const loadPreferences = (storage?: Storage | null): Record<string, unknown> | null => {
  try {
    const raw = resolveStorage(storage)?.getItem(PREFERENCES_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}
