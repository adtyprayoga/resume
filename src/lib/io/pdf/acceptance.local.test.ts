/**
 * Opt-in acceptance against a real CV that is never committed. Both paths come
 * from the environment, so this file holds no CV text:
 *
 *   PDF_IMPORT_ACCEPTANCE=/tmp/…/extraction.json PDF_IMPORT_EXPECT=/tmp/…/expect.json \
 *     bun run test src/lib/io/pdf/acceptance.local.test.ts
 *
 * `project()` returns the exact imported values, so a wrong name, truncated
 * summary, wrong employer or altered bullet shows up as a field-level diff.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { DateRange, Locale, ProfileText } from '$lib/model/types'
import type { ListSectionKind } from '$lib/sections/kinds'
import { mapExtraction, type Proposal } from './mapper'
import { parseExtraction } from './validate'

interface Projection {
  profile: ProfileText
  contact: { email: string; phone: string; linkedin: string; website: string }
  skills: { title: string; items: string[] }[]
  experience: { company: string; location: string; role: string; dates: DateRange; bullets: string[] }[]
  education: { school: string; degree: string; field: string; gpa: string; dates: DateRange; description: string }[]
  certifications: { title: string; issuer: string; date: string; description: string }[]
  references: { name: string; position: string; phone: string; email: string; note: string }[]
  sections: ListSectionKind[]
  unmatched: string[]
}

const project = (proposal: Proposal, locale: Locale): Projection => {
  const { contact, profile, sections, content } = proposal.document
  return {
    profile: profile.text[locale],
    contact: { email: contact.email, phone: contact.phone, linkedin: contact.linkedin, website: contact.website },
    skills: content.skills.map(group => ({ title: group.text[locale].title, items: group.text[locale].items })),
    experience: content.experience.map(item => ({
      company: item.company,
      location: item.text[locale].location,
      role: item.text[locale].role,
      dates: item.dates,
      bullets: item.text[locale].bullets,
    })),
    education: content.education.map(item => ({
      school: item.text[locale].school,
      degree: item.text[locale].degree,
      field: item.text[locale].field,
      gpa: item.gpa,
      dates: item.dates,
      description: item.text[locale].description,
    })),
    certifications: content.certifications.map(item => ({
      title: item.text[locale].title,
      issuer: item.text[locale].issuer,
      date: item.date,
      description: item.text[locale].description,
    })),
    references: content.references.map(item => ({
      name: item.text[locale].name,
      position: item.text[locale].position,
      phone: item.phone,
      email: item.email,
      note: item.text[locale].note,
    })),
    sections: sections.map(section => section.kind),
    unmatched: proposal.unmatched.map(item => item.text),
  }
}

const extractionPath = process.env.PDF_IMPORT_ACCEPTANCE
const expectPath = process.env.PDF_IMPORT_EXPECT

describe.skipIf(!extractionPath)('real-CV acceptance (local only)', () => {
  it('imports exactly the expected values', () => {
    if (!extractionPath || !expectPath) throw new Error('Set both PDF_IMPORT_ACCEPTANCE and PDF_IMPORT_EXPECT')
    const parsed = parseExtraction(JSON.parse(readFileSync(extractionPath, 'utf8')))
    if (!parsed.ok) throw new Error(JSON.stringify(parsed))
    const expected: Projection = JSON.parse(readFileSync(expectPath, 'utf8'))
    expect(project(mapExtraction(parsed.value, 'en'), 'en')).toEqual(expected)
  })
})
