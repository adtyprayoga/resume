import { LOCALES, type DateRange, type Locale } from './types'

/** Containers are checked strictly; leaves coerce to a default so stale exports still import. */

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

/** Only needs to be unique within one document. */
export const createId = (prefix: string): string => {
  idCounter += 1
  return `${prefix}_${Date.now().toString(36)}${idCounter.toString(36)}`
}

export const idOf = (value: Record<string, unknown>, prefix: string): string =>
  typeof value.id === 'string' && value.id ? value.id : createId(prefix)

/** Always complete, so callers can index any locale without a guard. */
export const textNode = <T>(value: unknown, coerceText: (raw: unknown) => T): Record<Locale, T> => {
  const raw = isRecord(value) ? value : {}
  const out = {} as Record<Locale, T>
  for (const locale of LOCALES) out[locale] = coerceText(raw[locale])
  return out
}
