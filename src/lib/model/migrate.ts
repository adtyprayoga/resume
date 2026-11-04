import { isRecord } from './coerce'
import { err, ok, type Result } from './result'
import { SCHEMA_VERSION } from './types'

/**
 * A newer-version document is refused, not coerced: opening an older deployed
 * build must not silently downgrade the user's resume.
 */
export const migrate = (raw: unknown): Result<Record<string, unknown>> => {
  if (!isRecord(raw)) return err('This file does not look like a resume.', { messageKey: 'error.notResume' })

  const version = typeof raw.schemaVersion === 'number' ? raw.schemaVersion : 1

  if (version > SCHEMA_VERSION) {
    return err(
      `This resume was saved by a newer version of the app (schema ${version}, this build supports ${SCHEMA_VERSION}). Update the app before opening it.`,
      { messageKey: 'error.newerSchema', messageParams: { version, supported: SCHEMA_VERSION } },
    )
  }

  // Version 1 needs no data rewrite; validation appends missing sections.
  return ok({ ...raw, schemaVersion: SCHEMA_VERSION })
}
