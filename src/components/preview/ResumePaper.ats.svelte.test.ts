import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/svelte'
import ResumePaper from './ResumePaper.svelte'
import PhotoField from '../editing/PhotoField.svelte'
import { sampleDocument } from '../../data/sample'
import { resolve } from '$lib/model/resolve'
import type { Locale, ResumeDocument } from '$lib/model/types'
import { resumeDoc } from '$lib/state/document.svelte'
import { prefs } from '$lib/state/preferences.svelte'

const mount = (doc: ResumeDocument, locale: Locale = 'en', presentation: 'classic' | 'ats' = 'ats') =>
  render(ResumePaper, { resume: resolve(doc, locale), locale, presentation })

/** Text of the paper in DOM order, one entry per leaf block, whitespace-normalized. */
const blocks = (root: Element) =>
  [...root.querySelectorAll('h1, h2, h3, p, li')]
    .map((element) => element.textContent!.replace(/\s+/g, ' ').trim())
    .filter(Boolean)

const indexOf = (list: string[], text: string) => {
  const index = list.findIndex((entry) => entry.includes(text))
  expect(index, `missing "${text}" in ${JSON.stringify(list)}`).toBeGreaterThanOrEqual(0)
  return index
}

const expectInOrder = (list: string[], texts: string[]) => {
  const positions = texts.map((text) => indexOf(list, text))
  expect(positions).toEqual([...positions].sort((a, b) => a - b))
}

beforeEach(() => {
  prefs.uiLocale = 'en'
  prefs.documentLocale = 'en'
})

describe('ATS profile block', () => {
  it('reads name, headline, contact lines, then the summary, with no photo', () => {
    const doc = sampleDocument()
    const { container } = mount(doc)
    const paper = container.querySelector('.resume-paper')!
    const text = blocks(paper)
    const profile = doc.profile.text.en

    expectInOrder(text, [
      profile.name,
      profile.headline,
      profile.location,
      doc.contact.email,
      doc.contact.phone,
      doc.contact.linkedin,
      doc.contact.github,
      doc.contact.website,
      'Summary',
      profile.summary.slice(0, 40),
    ])
    expect(paper.querySelector('img')).toBeNull()
    expect(paper.querySelector('.resume-avatar')).toBeNull()
  })

  it('labels contacts in a pipe-separated wrapping line and keeps location separate', () => {
    const doc = sampleDocument()
    const { container } = mount(doc)
    expect(container.querySelector('.ats-location')!.textContent).toBe(doc.profile.text.en.location)
    expect(container.querySelector('.ats-contact')!.textContent!.replace(/\s+/g, ' ').trim()).toBe(
      `Email: ${doc.contact.email} | Phone: ${doc.contact.phone} | LinkedIn: ${doc.contact.linkedin} | GitHub: ${doc.contact.github} | Portfolio: ${doc.contact.website}`,
    )
    expect(container.querySelector('.ats-contact a')).toBeNull()
  })

  it('omits empty contacts, separators and summary without losing other fields', () => {
    const doc = sampleDocument()
    doc.contact.phone = ''
    doc.contact.github = ''
    for (const text of Object.values(doc.profile.text)) {
      text.headline = ''
      text.location = ''
      text.summary = ''
    }
    const { container } = mount(doc)
    expect(container.querySelector('.ats-contact')!.textContent!.trim()).toBe(
      `Email: ${doc.contact.email} | LinkedIn: ${doc.contact.linkedin} | Portfolio: ${doc.contact.website}`,
    )
    expect(container.querySelector('.ats-location')).toBeNull()
    expect(container.querySelector('.ats-summary')).toBeNull()
    expect(container.querySelector('.resume-headline')).toBeNull()
  })

  it('omits the contact line when every contact is empty', () => {
    const doc = sampleDocument()
    for (const key of ['email', 'phone', 'linkedin', 'github', 'website'] as const) doc.contact[key] = ''
    const { container } = mount(doc)
    expect(container.querySelector('.ats-contact')).toBeNull()
  })

  it('uses the Indonesian summary heading for an Indonesian document', () => {
    const doc = sampleDocument()
    mount(doc, 'id')
    expect(screen.getByRole('heading', { level: 2, name: 'Ringkasan Profesional' })).toBeInTheDocument()
  })

  it('leaves the stored photo intact and keeps it in Classic', () => {
    const doc = sampleDocument()
    const avatar = doc.contact.avatar
    expect(avatar).not.toBe('')
    const ats = mount(doc)
    expect(ats.container.querySelector('img')).toBeNull()
    expect(doc.contact.avatar).toBe(avatar)
    ats.unmount()

    const classic = mount(doc, 'en', 'classic')
    expect(classic.container.querySelector('img.resume-avatar')).not.toBeNull()
    expect(classic.container.querySelector('.ats-contact')).toBeNull()
  })

  it('tells the user in the photo editor that photos only appear in Classic', () => {
    resumeDoc.replace(sampleDocument())
    render(PhotoField, { value: resumeDoc.current.contact.avatar, label: 'Photo', scopeText: 'both languages', onchange: () => {} })
    expect(screen.getByText(/appears only in the Classic layout/)).toBeInTheDocument()
  })
})

/** Text of one section's entries, in DOM order. */
const sectionBlocks = (container: Element, heading: string) => {
  const section = [...container.querySelectorAll('section')].find(
    (candidate) => candidate.querySelector('h2')?.textContent === heading,
  )
  expect(section, `no section "${heading}"`).toBeTruthy()
  return blocks(section!).slice(1)
}

describe('ATS section reading order', () => {
  it('reads Work Experience as company, dates, role, team/location, bullets', () => {
    const { container } = mount(sampleDocument())
    expect(sectionBlocks(container, 'Work Experience').slice(0, 7)).toEqual([
      'PT Nusantara Digital',
      'Mar 2022 – Present',
      'Senior Software Engineer',
      'Payments Platform, Jakarta',
      'Led the migration of payment services to a queue-based architecture, cutting transaction failures by 38%.',
      'Redesigned the transaction database schema, reducing daily report query time from 40s to 3s.',
      'Mentored four junior engineers through weekly code reviews and design sessions.',
    ])
  })

  it('reads Pengalaman Kerja in Indonesian with the translated present label', () => {
    const { container } = mount(sampleDocument(), 'id')
    expect(sectionBlocks(container, 'Pengalaman Kerja').slice(0, 4)).toEqual([
      'PT Nusantara Digital',
      'Mar 2022 – Sekarang',
      'Perekayasa Perangkat Lunak Senior',
      'Platform Pembayaran, Jakarta',
    ])
  })

  it('reads Education as school/degree/field, dates, GPA, description', () => {
    const { container } = mount(sampleDocument())
    expect(sectionBlocks(container, 'Education')).toEqual([
      'Bandung Institute of Technology, Bachelor of Engineering, Informatics Engineering',
      'Aug 2015 – Jul 2019',
      'GPA 3.72 / 4.00',
      'Final project on distributed task scheduling across heterogeneous clusters.',
    ])
  })

  it('reads Projects as name/role/technologies, dates, description, bullets, URL', () => {
    const { container } = mount(sampleDocument())
    expect(sectionBlocks(container, 'Projects')).toEqual([
      'Antrean — Author (TypeScript, PostgreSQL, Redis)',
      'Feb 2023 – Nov 2023',
      'A lightweight job queue library for Node.js with exactly-once delivery guarantees.',
      'Reached 1,200 GitHub stars and production use at three companies.',
      'Wrote bilingual documentation and a test suite at 94% coverage.',
      'https://github.com/example/antrean',
    ])
  })

  it('reads Skills as a category, a colon, and comma-separated skills in plain flow', () => {
    const doc = sampleDocument()
    const { container } = mount(doc)
    const lines = sectionBlocks(container, 'Skills')
    const first = doc.content.skills[0]!.text.en
    expect(lines[0]).toBe(`${first.title}: ${first.items.join(', ')}`)
    expect(lines).toHaveLength(doc.content.skills.length)
    expect(container.querySelector('.skill-row')).toBeNull()
  })

  it('reads Awards as title, date, issuer, description', () => {
    const doc = sampleDocument()
    const award = doc.content.awards[0]!
    const { container } = mount(doc)
    expect(sectionBlocks(container, 'Awards').slice(0, 4)).toEqual([
      award.text.en.title,
      'May 2024',
      award.text.en.issuer,
      award.text.en.description,
    ].filter(Boolean))
  })

  it('omits blank optional fields instead of leaving empty lines', () => {
    const doc = sampleDocument()
    const job = doc.content.experience[0]!
    job.company = ''
    job.dates = { start: '', end: null }
    for (const text of Object.values(job.text)) {
      text.team = ''
      text.location = ''
      text.bullets = []
    }
    const { container } = mount(doc)
    const entry = container.querySelector('section article')!
    expect(blocks(entry)).toEqual(['Senior Software Engineer'])
    expect([...entry.querySelectorAll('p, ul')].every((node) => node.textContent!.trim() !== '')).toBe(true)
  })

  it('skips disabled and empty sections and keeps manual order', () => {
    const doc = sampleDocument()
    doc.sections = [
      { kind: 'projects', enabled: true },
      { kind: 'experience', enabled: false },
      { kind: 'education', enabled: true },
      { kind: 'skills', enabled: true },
      { kind: 'awards', enabled: true },
    ]
    doc.content.awards = []
    const { container } = mount(doc)
    expect([...container.querySelectorAll('h2')].map((h) => h.textContent)).toEqual([
      'Summary',
      'Projects',
      'Education',
      'Skills',
    ])
  })

  it('leaves Classic headings and right-aligned date rows unchanged', () => {
    const { container } = mount(sampleDocument(), 'en', 'classic')
    expect(container.querySelector('h2')!.textContent).toBe('Experience')
    expect(container.querySelector('.item-head .item-dates')).not.toBeNull()
    expect(container.querySelector('.skill-row')).not.toBeNull()
  })
})
