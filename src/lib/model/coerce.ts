import { LOCALES, type DateRange, type Locale } from './types'

/**
 * Leaf coercion for imported data.
 *
 * Containers are validated strictly (a non-object item is rejected outright),
 * but leaves are coerced to a safe default. A slightly stale export should still
 * import; garbage should never reach application state.
 */

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export const str = (value: unknown): string => (typeof value === 'string' ? value : '')

export const strArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []

export const dateRange = (value: unknown): DateRange => {
  if (!isRecord(value)) return { start: '', end: null }
  const current = value.current === true
  const end = typeof value.end === 'string' && value.end ? value.end : null
  return current
    ? { start: str(value.start), end: null, current: true }
    : { start: str(value.start), end }
}

let idCounter = 0

/** Stable within a session; only needs to be unique inside one document. */
export const createId = (prefix: string): string => {
  idCounter += 1
  return `${prefix}_${Date.now().toString(36)}${idCounter.toString(36)}`
}

export const idOf = (value: Record<string, unknown>, prefix: string): string =>
  typeof value.id === 'string' && value.id ? value.id : createId(prefix)

/**
 * Builds a complete per-locale text node, so downstream code can index any
 * locale without a guard. Missing locales become blank and `resolve()` fills
 * them from the other locale.
 */
export const textNode = <T>(value: unknown, coerceText: (raw: unknown) => T): Record<Locale, T> => {
  const raw = isRecord(value) ? value : {}
  const out = {} as Record<Locale, T>
  for (const locale of LOCALES) out[locale] = coerceText(raw[locale])
  return out
}
