import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { emptyDocument, validateDocument } from '$lib/model/document'
import type { Locale, ResumeDocument } from '$lib/model/types'
import { mapExtraction, type Proposal } from './mapper'
import type { Extraction, SourceBlock } from './types'
import { parseExtraction } from './validate'

// Real Docling output for the synthetic CVs in services/pdf-import/tests/fixtures/pdf.
const FIXTURES = resolve(__dirname, '../../../../services/pdf-import/tests/fixtures/contract/valid')
const fixture = (name: string): Extraction => {
  const parsed = parseExtraction(JSON.parse(readFileSync(resolve(FIXTURES, `extraction_${name}.json`), 'utf8')))
  if (!parsed.ok) throw new Error(parsed.error)
  return parsed.value
}

let nextId = 0
const block = (text: string, label = 'text', group: string | null = null, page = 1): SourceBlock => ({
  id: `b${++nextId}`,
  page,
  label,
  group,
  text,
  bbox: null,
})
const extraction = (...blocks: SourceBlock[]): Extraction => {
  const renumbered = blocks.map((b, i) => ({ ...b, id: `b${i + 1}` }))
  return { contract_version: 1, pages: Math.max(1, ...renumbered.map((b) => b.page)), blocks: renumbered }
}

const unmatchedText = (proposal: Proposal) => proposal.unmatched.map((u) => u.text)

/** Every string the mapper wrote for `locale`, plus shared strings, with their field path. */
const leafStrings = (doc: ResumeDocument, locale: Locale): [string, string][] => {
  const out: [string, string][] = []
  const visit = (value: unknown, path: string) => {
    if (typeof value === 'string') {
      if (value) out.push([path, value])
    } else if (Array.isArray(value)) value.forEach((v, i) => visit(v, `${path}.${i}`))
    else if (value && typeof value === 'object') {
      for (const [key, child] of Object.entries(value)) {
        if (key === 'id' || key === 'kind') continue
        if (key === 'text') visit((child as Record<Locale, unknown>)[locale], `${path}.text`)
        else visit(child, `${path}.${key}`)
      }
    }
  }
  visit({ contact: doc.contact, profile: doc.profile, content: doc.content }, '')
  return out
}

describe('mapExtraction: English CV', () => {
  const proposal = mapExtraction(fixture('en_single'), 'en')
  const doc = proposal.document
  const en = (item: { text: Record<Locale, unknown> }) => item.text.en

  it('fills the profile and contacts from the header', () => {
    expect(doc.profile.text.en).toEqual({
      name: 'Jane Doe',
      headline: 'Senior Backend Engineer',
      location: 'Jakarta, Indonesia',
      summary: 'Backend engineer with eight years of experience building payment systems.',
    })
    expect(doc.contact).toMatchObject({
      email: 'jane.doe@example.com',
      phone: '+62 812 3456 7890',
      github: 'https://github.com/janedoe',
      website: '',
      linkedin: '',
    })
  })

  it('maps experience entries with roles, companies, dates and their own bullets', () => {
    const [first, second] = doc.content.experience
    expect(doc.content.experience).toHaveLength(2)
    expect(first!.company).toBe('Example Payments')
    expect(first!.dates).toEqual({ start: '2021-01', end: null, current: true })
    expect(en(first!)).toMatchObject({
      role: 'Senior Backend Engineer',
      bullets: ['Led the migration of settlement jobs to an event-driven pipeline.', 'Reduced reconciliation time from six hours to forty minutes.'],
    })
    expect(second!.company).toBe('Sample Logistics')
    expect(second!.dates).toEqual({ start: '2017', end: '2020' })
    expect(en(second!)).toMatchObject({ role: 'Software Engineer', bullets: ['Built the courier routing service used in twelve cities.'] })
  })

  it('maps education with year-only dates preserved', () => {
    expect(doc.content.education).toHaveLength(1)
    const [school] = doc.content.education
    expect(school!.dates).toEqual({ start: '2013', end: '2017' })
    expect(en(school!)).toMatchObject({ school: 'Universitas Contoh', degree: 'Bachelor of Computer Science' })
  })

  it('maps labelled skill groups', () => {
    expect(doc.content.skills.map((s) => en(s))).toEqual([
      { title: 'Languages', items: ['Go', 'Python', 'TypeScript'] },
      { title: 'Infrastructure', items: ['PostgreSQL', 'Kafka', 'Kubernetes'] },
    ])
  })

  it('accounts for every block', () => {
    expect(proposal.unmatched).toEqual([])
    expect(proposal.warnings).toEqual([])
  })

  it('leaves the other language blank so the display fallback applies', () => {
    expect(doc.profile.text.id).toEqual(emptyDocument().profile.text.id)
    for (const kind of ['experience', 'education', 'skills'] as const) {
      for (const item of doc.content[kind]) {
        expect(Object.values(item.text.id).every((v) => (Array.isArray(v) ? v.length === 0 : v === ''))).toBe(true)
      }
    }
  })

  it('links fields to their source blocks', () => {
    expect(proposal.refs).toContainEqual({ path: 'profile.name', blocks: ['b1'] })
    expect(proposal.refs).toContainEqual({ path: 'contact.email', blocks: ['b4'] })
    const id = doc.content.experience[0]!.id
    expect(proposal.refs).toContainEqual({ path: `experience.${id}.company`, blocks: ['b8'] })
    expect(proposal.refs).toContainEqual({ path: `experience.${id}.bullets`, blocks: ['b10', 'b11'] })
  })

  it('produces a document that survives the import validator unchanged', () => {
    const validated = validateDocument(JSON.parse(JSON.stringify(doc)))
    expect(validated.ok && validated.value).toEqual(doc)
  })
})

describe('mapExtraction: Indonesian CV', () => {
  const proposal = mapExtraction(fixture('id_single'), 'id')
  const doc = proposal.document

  it('recognises Indonesian headings and fills the Indonesian locale', () => {
    expect(doc.profile.text.id).toMatchObject({ name: 'Budi Santoso', headline: 'Analis Data', location: 'Bandung, Jawa Barat' })
    expect(doc.profile.text.id.summary).toContain('Analis data dengan pengalaman lima tahun')
    expect(doc.profile.text.en.name).toBe('')
    expect(doc.contact.phone).toBe('0812-9876-5432')
  })

  it('reads "Sekarang" as explicit current employment', () => {
    const [job] = doc.content.experience
    expect(job!.company).toBe('Toko Contoh')
    expect(job!.text.id.role).toBe('Analis Data Senior')
    expect(job!.dates).toEqual({ start: '2022-03', end: null, current: true })
    expect(job!.text.id.bullets).toHaveLength(2)
  })

  it('maps awards with their year', () => {
    expect(doc.content.awards).toHaveLength(1)
    expect(doc.content.awards[0]!.date).toBe('2018')
    expect(doc.content.awards[0]!.text.id.title).toBe('Juara 1 Kompetisi Analitik Nasional')
  })

  it('splits an unlabelled skill line into items', () => {
    expect(doc.content.skills.map((s) => s.text.id)).toEqual([{ title: '', items: ['SQL', 'Python', 'Tableau', 'Statistik Inferensial'] }])
  })

  it('accounts for every block', () => {
    expect(proposal.unmatched).toEqual([])
  })
})

describe('mapExtraction: two-column CV', () => {
  const proposal = mapExtraction(fixture('two_column'), 'en')
  const doc = proposal.document

  it('reads sidebar contacts and skills without mixing them into experience', () => {
    expect(doc.profile.text.en.name).toBe('Rina Putri')
    expect(doc.contact).toMatchObject({ email: 'rina.putri@example.com', phone: '+62 811 2222 3333', linkedin: 'https://linkedin.com/in/rinaputri' })
    expect(doc.content.skills.map((s) => s.text.en)).toEqual([{ title: '', items: ['Figma', 'User Research', 'Design Systems'] }])
    const allBullets = doc.content.experience.flatMap((e) => e.text.en.bullets)
    expect(allBullets).not.toContain('Figma')
  })

  it('keeps each bullet with its own entry', () => {
    expect(doc.content.experience.map((e) => [e.company, e.text.en.role, e.text.en.bullets.length])).toEqual([
      ['Contoh Studio', 'Product Designer', 2],
      ['Sample Agency', 'Junior Designer', 1],
    ])
  })

  it('orders sections as they appear in the source', () => {
    expect(doc.sections.map((s) => s.kind).slice(0, 3)).toEqual(['skills', 'experience', 'education'])
  })
})

describe('mapExtraction: scanned CV', () => {
  const proposal = mapExtraction(fixture('scanned'), 'en')
  const doc = proposal.document

  it('strips OCR bullet glyphs', () => {
    expect(doc.content.experience[0]!.text.en.bullets[0]).toBe('Led the migration of settlement jobs to an event-driven pipeline.')
  })

  it('joins a skill label split from its items', () => {
    expect(doc.content.skills.map((s) => s.text.en)).toEqual([
      { title: 'Languages', items: ['Go', 'Python', 'TypeScript'] },
      { title: 'Infrastructure', items: ['PostgreSQL', 'Kafka', 'Kubernetes'] },
    ])
  })
})

describe('mapExtraction: five-page CV', () => {
  const proposal = mapExtraction(fixture('five_page'), 'en')

  it('continues a section across pages in source order', () => {
    const experience = proposal.document.content.experience
    expect(experience).toHaveLength(15)
    expect(experience.map((e) => e.company)).toEqual(Array.from({ length: 15 }, (_, i) => `Example Company ${i + 1}`))
    expect(experience.every((e) => e.text.en.bullets.length === 3)).toBe(true)
    expect(proposal.unmatched).toEqual([])
  })
})

describe('mapExtraction: conservative rules', () => {
  it('never invents text: every mapped string comes from the source', () => {
    for (const [name, locale] of [['en_single', 'en'], ['id_single', 'id'], ['two_column', 'en'], ['scanned', 'en'], ['five_page', 'en']] as const) {
      const source = fixture(name).blocks.map((b) => b.text).join('\n')
      const doc = mapExtraction(fixture(name), locale).document
      for (const [path, value] of leafStrings(doc, locale)) {
        if (path.includes('.dates.') || path.endsWith('.date')) continue
        const raw = /^(website|github|linkedin|link)$/.test(path.split('.').pop()!) ? value.replace(/^https:\/\//, '') : value
        expect(source, `${name} ${path}`).toContain(raw)
      }
    }
  })

  it('keeps the rest of a block when only a contact is taken from it', () => {
    const proposal = mapExtraction(
      extraction(block('Jane Doe', 'title'), block('jane@example.com | Open to relocation'), block('Experience', 'section_header')),
      'en',
    )
    expect(proposal.document.contact.email).toBe('jane@example.com')
    expect(unmatchedText(proposal)).toEqual(['Open to relocation'])
  })

  it('does not set current without an explicit word', () => {
    const proposal = mapExtraction(
      extraction(block('Experience', 'section_header'), block('Engineer at Foo', 'section_header'), block('2019')),
      'en',
    )
    expect(proposal.document.content.experience[0]!.dates).toEqual({ start: '2019', end: null })
  })

  it('leaves an ambiguous title blank and its text unmatched', () => {
    const proposal = mapExtraction(
      extraction(block('Experience', 'section_header'), block('Example Payments, Sample Logistics', 'section_header'), block('2019 - 2020'), block('Did a thing', 'list_item', 'g1')),
      'en',
    )
    const [entry] = proposal.document.content.experience
    expect(entry!.company).toBe('')
    expect(entry!.text.en.role).toBe('')
    expect(entry!.dates).toEqual({ start: '2019', end: '2020' })
    expect(entry!.text.en.bullets).toEqual(['Did a thing'])
    expect(unmatchedText(proposal)).toEqual(['Example Payments, Sample Logistics'])
    expect(proposal.warnings).toContainEqual({ code: 'ambiguous_title', blocks: ['b2'] })
  })

  it('leaves unsupported sections unmatched instead of folding them into the previous one', () => {
    const proposal = mapExtraction(
      extraction(
        block('Experience', 'section_header'),
        block('Engineer at Foo', 'section_header'),
        block('2019 - 2020'),
        block('Certifications', 'section_header'),
        block('AWS Solutions Architect, 2021'),
      ),
      'en',
    )
    expect(proposal.document.content.experience).toHaveLength(1)
    expect(proposal.document.content.experience[0]!.text.en.bullets).toEqual([])
    expect(proposal.document.content.awards).toEqual([])
    expect(unmatchedText(proposal)).toEqual(['Certifications', 'AWS Solutions Architect, 2021'])
    expect(proposal.warnings).toContainEqual({ code: 'unsupported_section', blocks: ['b4'] })
  })

  it('treats an unsupported heading word in body text as content, not a new section', () => {
    const proposal = mapExtraction(
      extraction(block('Skills', 'section_header'), block('Languages:'), block('English, Indonesian')),
      'en',
    )
    expect(proposal.document.content.skills.map((s) => s.text.en)).toEqual([{ title: 'Languages', items: ['English', 'Indonesian'] }])
    expect(proposal.warnings).toEqual([{ code: 'no_name', blocks: [] }])
  })

  it('leaves a section without clear entry boundaries unmatched', () => {
    const proposal = mapExtraction(
      extraction(block('Experience', 'section_header'), block('Worked on many things for various clients.'), block('Also did consulting.')),
      'en',
    )
    expect(proposal.document.content.experience).toEqual([])
    expect(unmatchedText(proposal)).toEqual(['Worked on many things for various clients.', 'Also did consulting.'])
    expect(proposal.warnings).toContainEqual({ code: 'ambiguous_entries', blocks: ['b2', 'b3'] })
  })

  it('splits entries at date lines when the layout gives no headings', () => {
    const proposal = mapExtraction(
      extraction(
        block('Experience', 'section_header'),
        block('Engineer at Foo'),
        block('2019 - 2020'),
        block('Built things', 'list_item', 'g1'),
        block('Analyst at Bar'),
        block('2017 - 2019'),
      ),
      'en',
    )
    expect(proposal.document.content.experience.map((e) => [e.company, e.text.en.role, e.dates.start])).toEqual([
      ['Foo', 'Engineer', '2019'],
      ['Bar', 'Analyst', '2017'],
    ])
    expect(proposal.unmatched).toEqual([])
  })

  it('warns when no name can be found', () => {
    const proposal = mapExtraction(extraction(block('jane@example.com'), block('Experience', 'section_header')), 'en')
    expect(proposal.document.profile.text.en.name).toBe('')
    expect(proposal.warnings).toContainEqual({ code: 'no_name', blocks: [] })
  })

  it('maps project links, stacks and descriptions', () => {
    const proposal = mapExtraction(
      extraction(
        block('Projects', 'section_header'),
        block('Resume Builder', 'section_header'),
        block('github.com/jane/resume'),
        block('Tech stack: Svelte, TypeScript'),
        block('A bilingual resume editor that runs in the browser.'),
        block('Shipped print-ready PDFs', 'list_item', 'g1'),
      ),
      'en',
    )
    const [project] = proposal.document.content.projects
    expect(project!.link).toBe('https://github.com/jane/resume')
    expect(project!.techStack).toEqual(['Svelte', 'TypeScript'])
    expect(project!.text.en).toMatchObject({
      name: 'Resume Builder',
      description: 'A bilingual resume editor that runs in the browser.',
      bullets: ['Shipped print-ready PDFs'],
    })
    expect(proposal.document.contact.github).toBe('')
  })

  it('reports everything unmatched when nothing is recognised', () => {
    const proposal = mapExtraction(extraction(block('Lorem ipsum dolor'), block('sit amet')), 'en')
    expect(proposal.warnings).toContainEqual({ code: 'nothing_recognised', blocks: [] })
    expect(unmatchedText(proposal)).toContain('sit amet')
  })
})
