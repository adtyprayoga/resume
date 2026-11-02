import type { UiMessage } from '$lib/i18n/ui'
import { serializeResume } from '$lib/io/exportJson'
import { validateDocument } from '$lib/model/document'
import { migrate } from '$lib/model/migrate'
import type { ResumeDocument } from '$lib/model/types'

export const DOCUMENT_KEY = 'resume-document-v1'
export const PREFERENCES_KEY = 'resume-preferences-v1'

export type SaveStatus =
  | { kind: 'idle' }
  | { kind: 'saved'; at: number }
  | ({ kind: 'error'; message: string } & Partial<UiMessage>)

/** Reading localStorage can itself throw when storage is blocked. */
const defaultStorage = (): Storage | null => {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

/** `undefined` means this browser's storage, `null` means none. A default param cannot express that. */
const resolveStorage = (storage: Storage | null | undefined): Storage | null =>
  storage === undefined ? defaultStorage() : storage

/** Quota failures must be visible; a silent one loses the user's work. */
const isQuotaError = (cause: unknown): boolean =>
  cause instanceof DOMException &&
  (cause.name === 'QuotaExceededError' || cause.name === 'NS_ERROR_DOM_QUOTA_REACHED')

export const saveDocument = (
  doc: ResumeDocument,
  storage?: Storage | null,
): SaveStatus => {
  const target = resolveStorage(storage)
  if (!target) return { kind: 'error', message: 'This browser has no local storage available.', messageKey: 'error.storageUnavailable' }

  try {
    target.setItem(DOCUMENT_KEY, serializeResume(doc))
    return { kind: 'saved', at: Date.now() }
  } catch (cause) {
    if (isQuotaError(cause)) {
      return {
        kind: 'error',
        message:
          'Out of browser storage, so this change was not saved. Remove or resize your photo, then export your JSON as a backup.',
        messageKey: 'error.storageQuota',
      }
    }
    return { kind: 'error', message: 'This change could not be saved to this browser.', messageKey: 'error.storageSave' }
  }
}

export type LoadResult =
  | { kind: 'empty' }
  | { kind: 'loaded'; document: ResumeDocument }
  /** `raw` is the stored string exactly as read, so it can be downloaded untouched. */
  | ({ kind: 'recovery'; raw: string; error: string } & Partial<UiMessage>)
  | ({ kind: 'unavailable'; error: string } & Partial<UiMessage>)

/**
 * Only an absent key is `empty`. Anything else that cannot be opened is
 * `recovery`, so the caller never replaces data it merely failed to read.
 * Never throws.
 */
export const loadDocument = (storage?: Storage | null): LoadResult => {
  const unavailable = (error: string, messageKey: UiMessage['messageKey']): LoadResult =>
    ({ kind: 'unavailable', error, messageKey })

  const target = resolveStorage(storage)
  if (!target) return unavailable('This browser has no local storage available.', 'error.storageUnavailable')

  let raw: string | null
  try {
    raw = target.getItem(DOCUMENT_KEY)
  } catch {
    return unavailable('Browser storage could not be read.', 'error.storageRead')
  }
  if (raw === null) return { kind: 'empty' }

  const recovery = ({ error, messageKey, messageParams }: { error: string } & Partial<UiMessage>): LoadResult => ({
    kind: 'recovery',
    raw,
    error,
    ...(messageKey && { messageKey }),
    ...(messageParams && { messageParams }),
  })

  if (!raw.trim()) return recovery({ error: 'The saved resume is empty.', messageKey: 'error.storedEmpty' })

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return recovery({ error: 'The saved resume is not valid JSON.', messageKey: 'error.storedJson' })
  }

  const migrated = migrate(parsed)
  if (!migrated.ok) return recovery(migrated)

  const validated = validateDocument(migrated.value)
  return validated.ok ? { kind: 'loaded', document: validated.value } : recovery(validated)
}

export const clearDocument = (storage?: Storage | null): void => {
  try {
    resolveStorage(storage)?.removeItem(DOCUMENT_KEY)
  } catch {
    // Nothing useful to do.
  }
}

export const savePreferences = <T>(prefs: T, storage?: Storage | null): void => {
  try {
    resolveStorage(storage)?.setItem(PREFERENCES_KEY, JSON.stringify(prefs))
  } catch {
    // Cosmetic; not worth surfacing.
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
