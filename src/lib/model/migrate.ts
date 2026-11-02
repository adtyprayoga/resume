import { isRecord } from './coerce'
import { err, ok, type Result } from './result'
import { SCHEMA_VERSION } from './types'

/**
 * Brings a stored or imported payload up to the current schema version.
 *
 * A document from a *newer* version is refused rather than coerced: opening an
 * older deployed build must not silently downgrade and overwrite the user's
 * resume.
 */
export const migrate = (raw: unknown): Result<Record<string, unknown>> => {
  if (!isRecord(raw)) return err('This file does not look like a resume.')

  const version = typeof raw.schemaVersion === 'number' ? raw.schemaVersion : 1

  if (version > SCHEMA_VERSION) {
    return err(
      `This resume was saved by a newer version of the app (schema ${version}, this build supports ${SCHEMA_VERSION}). Update the app before opening it.`,
    )
  }

  // No migrations yet: version 1 is the current schema. Future steps chain here,
  // each taking the shape produced by the previous one.
  return ok({ ...raw, schemaVersion: SCHEMA_VERSION })
}
