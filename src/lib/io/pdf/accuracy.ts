import type { ContactInfo, Locale, ProfileText } from '$lib/model/types'
import type { Proposal } from './mapper'
import type { Extraction } from './types'

export interface Golden {
  locale: Locale
  profile: Partial<ProfileText>
  contact: Partial<ContactInfo>
  sections: Partial<Record<'experience' | 'education' | 'projects' | 'skills' | 'awards' | 'certifications' | 'references', Record<string, unknown>[]>>
  unplaced: number
}
export type Outcome = 'correct' | 'wrong' | 'missing' | 'extra'
interface Counts { expected: number; filled: number; correct: number }
export interface Score extends Counts {
  bySection: Record<string, Counts>
  outcomes: Record<string, Outcome>
  unplaced: number
}
const normalise = (value: unknown): unknown => {
  if (typeof value === 'string') return value.replace(/\s+/g, ' ').trim()
  if (!value || typeof value !== 'object') return value ?? ''
  return Object.fromEntries(Object.entries(value)
    .filter(([key, part]) => key !== 'current' || part === true)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, part]) => [key, normalise(part)]))
}
const populated = (value: unknown): boolean => value !== undefined && value !== null && (typeof value === 'object' ? Object.values(value).some(part => part === true || populated(part)) : String(value).trim() !== '' && value !== false)

export const scoreProposal = (golden: Golden, proposal: Proposal): Score => {
  const score: Score = { expected: 0, filled: 0, correct: 0, bySection: {}, outcomes: {}, unplaced: proposal.unmatched.length }
  const fields = (section: string, path: string, expected: Record<string, unknown>, actual: Record<string, unknown>, extra = false) => {
    const counts = score.bySection[section] ??= { expected: 0, filled: 0, correct: 0 }
    const unit = (key: string, wanted: unknown, found: unknown, surplus: boolean, e = populated(wanted), f = populated(found)) => {
      if (!e && !f) return
      const correct = e && f && JSON.stringify(normalise(wanted)) === JSON.stringify(normalise(found))
      score.outcomes[key] = surplus ? 'extra' : correct ? 'correct' : f ? 'wrong' : 'missing'
      for (const target of [score, counts]) { target.expected += +e; target.filled += +f; target.correct += +correct }
    }
    for (const key of new Set([...Object.keys(expected), ...Object.keys(actual)])) {
      const wanted = expected[key], found = actual[key]
      if (Array.isArray(wanted) || Array.isArray(found)) {
        const e = Array.isArray(wanted) ? wanted : [], a = Array.isArray(found) ? found : []
        for (let i = 0; i < Math.max(e.length, a.length); i++) unit(`${path}.${key}.${i}`, e[i], a[i], extra || i >= e.length, i < e.length, i < a.length)
      } else unit(`${path}.${key}`, wanted, found, extra)
    }
  }
  fields('profile', 'profile', golden.profile, { ...proposal.document.profile.text[golden.locale] })
  fields('contact', 'contact', golden.contact, { ...proposal.document.contact })
  const content: Partial<Record<keyof Golden['sections'], unknown[]>> = proposal.document.content
  for (const section of new Set([...Object.keys(golden.sections), ...Object.keys(content)]) as Set<keyof Golden['sections']>) {
    const expected = golden.sections[section] ?? [], actual = content[section] ?? []
    for (let i = 0; i < Math.max(expected.length, actual.length); i++) {
      const entry = actual[i] as { id: string; text: Record<Locale, Record<string, unknown>> } | undefined
      const { id: _id, text, ...shared } = entry ?? {}
      fields(section, `${section}.${i}`, expected[i] ?? {}, { ...shared, ...text?.[golden.locale] }, i >= expected.length)
    }
  }
  return score
}
export const stripStyles = (extraction: Extraction): Extraction => ({
  ...extraction,
  blocks: extraction.blocks.map(block => {
    const { style: _style, ...rest } = block as typeof block & { style?: unknown }
    return rest
  }),
})
/** The extraction with Docling's heading labels taken away (title/section_header read as text); styles stay. */
export const flattenLabels = (extraction: Extraction): Extraction => ({
  ...extraction,
  blocks: extraction.blocks.map(block => block.label === 'title' || block.label === 'section_header' ? { ...block, label: 'text' } : block),
})
