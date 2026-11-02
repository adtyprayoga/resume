import type { DateRange, Locale } from './types'

const INTL_LOCALE: Record<Locale, string> = { id: 'id-ID', en: 'en-US' }

/**
 * Formats a `YYYY-MM` (or `YYYY`) string for display. Anything unparseable is
 * passed through verbatim, so a user who types "Summer 2024" keeps it.
 */
export const formatMonth = (value: string, locale: Locale): string => {
  const trimmed = value.trim()
  if (!trimmed) return ''

  const match = /^(\d{4})(?:-(\d{1,2}))?$/.exec(trimmed)
  if (!match) return trimmed

  const year = Number(match[1])
  if (match[2] === undefined) return String(year)

  const month = Number(match[2])
  if (month < 1 || month > 12) return trimmed

  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, 1)))
}

/** Renders a span as `start – end`, or `start – <presentLabel>` while current. */
export const formatRange = (
  range: DateRange,
  locale: Locale,
  presentLabel: string,
): string => {
  const start = formatMonth(range.start, locale)
  const end = range.current ? presentLabel : formatMonth(range.end ?? '', locale)

  if (start && end) return `${start} – ${end}`
  return start || end
}
