import { validateDocument } from '$lib/model/document'
import { migrate } from '$lib/model/migrate'
import { err, type Result } from '$lib/model/result'
import type { ResumeDocument } from '$lib/model/types'

export const MAX_IMPORT_BYTES = 1_000_000

/**
 * Parses a resume JSON string. The size cap is applied before `JSON.parse` so a
 * hostile payload cannot force a huge allocation first.
 */
export const parseResumeJson = (source: string): Result<ResumeDocument> => {
  if (!source.trim()) return err('Paste or choose a resume JSON file first.')

  if (new Blob([source]).size > MAX_IMPORT_BYTES) {
    return err(`That file is too large (limit ${Math.round(MAX_IMPORT_BYTES / 1000)} KB).`)
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(source)
  } catch {
    return err('That file could not be read as JSON.')
  }

  const migrated = migrate(parsed)
  if (!migrated.ok) return migrated

  return validateDocument(migrated.value)
}
