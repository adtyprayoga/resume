import { validateDocument } from '$lib/model/document'
import { migrate } from '$lib/model/migrate'
import { err, type Result } from '$lib/model/result'
import type { ResumeDocument } from '$lib/model/types'

export const MAX_IMPORT_BYTES = 1_000_000

export const importLimitError = <T = never>(): Result<T> =>
  err(`That file is too large (limit ${Math.round(MAX_IMPORT_BYTES / 1000)} KB).`, {
    messageKey: 'error.importLimit',
    messageParams: { limit: Math.round(MAX_IMPORT_BYTES / 1000) },
  })

/**
 * Parses a resume JSON string. The size cap is applied before `JSON.parse` so a
 * hostile payload cannot force a huge allocation first.
 */
export const parseResumeJson = (source: string): Result<ResumeDocument> => {
  if (!source.trim()) return err('Paste or choose a resume JSON file first.', { messageKey: 'error.importEmpty' })

  if (new Blob([source]).size > MAX_IMPORT_BYTES) return importLimitError()

  let parsed: unknown
  try {
    parsed = JSON.parse(source)
  } catch {
    return err('That file could not be read as JSON.', { messageKey: 'error.importJson' })
  }

  const migrated = migrate(parsed)
  if (!migrated.ok) return migrated

  return validateDocument(migrated.value)
}

/** Checks the size before reading, so an oversized file is never loaded into memory. Read failures throw. */
export const readResumeFile = async (file: Blob): Promise<Result<ResumeDocument>> =>
  file.size > MAX_IMPORT_BYTES ? importLimitError() : parseResumeJson(await file.text())
