import type { DateRange, ExperienceItem } from '$lib/model/types'

export function headlineParts(headline: string): string[] {
  return headline.split('|').map((part) => part.trim()).filter(Boolean)
}

export function looksLikeAddress(location: string): boolean {
  return (location.match(/,/g)?.length ?? 0) >= 2
    || /(?:[a-z][.\s]*\d{1,5}(?!\d)|(?<!\d)\d{1,5}[a-z])/i.test(location)
    || /\b(?:jl\.?|jalan|street|st\.|road|rd\.|rt|rw|no\.|blok|block|gang)(?!\w)/i.test(location)
}

export function hasNumber(text: string): boolean {
  return /\d/.test(text)
}

export function isShortSummary(summary: string): boolean {
  return summary.trim().split(/\s+/).filter(Boolean).length < 25
}

export function groupKind(title: string): 'languages' | 'soft' | 'tools' | 'hard' {
  const lower = title.toLowerCase()
  if (/\b(?:language|languages|bahasa)\b/.test(lower)) return 'languages'
  if (/\b(?:soft|interpersonal|personal)\b/.test(lower)) return 'soft'
  if (/\b(?:tool|tools|software|technical|teknis|aplikasi|support|pendukung)\b/.test(lower)) return 'tools'
  return 'hard'
}

export function languageWithoutLevel(item: string): boolean {
  return !item.includes('(')
}

function dated(item: ExperienceItem): boolean {
  return item.dates.start.trim() !== ''
}

function compareNewest(a: DateRange, b: DateRange): number {
  if (Boolean(a.current) !== Boolean(b.current)) return a.current ? -1 : 1
  const aStart = monthMissing(a.start) ? `${a.start}-00` : a.start
  const bStart = monthMissing(b.start) ? `${b.start}-00` : b.start
  return aStart === bStart ? 0 : aStart > bStart ? -1 : 1
}

export function isNewestFirst(items: ExperienceItem[]): boolean {
  let previous: ExperienceItem | undefined
  for (const item of items) {
    if (!dated(item)) continue
    if (previous && compareNewest(previous.dates, item.dates) > 0) return false
    previous = item
  }
  return true
}

export function orderExperienceNewestFirst(items: ExperienceItem[]): ExperienceItem[] {
  const sorted = items.filter(dated).sort((a, b) => compareNewest(a.dates, b.dates))
  let index = 0
  return items.map((item) => dated(item) ? sorted[index++]! : item)
}

export function monthMissing(date: string): boolean {
  return /^\d{4}$/.test(date)
}
