import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { stripStyles } from './accuracy'
import { parseExtraction } from './validate'
import { mapExtraction, type Proposal } from './mapper'
import type { BBox, BlockStyle, Extraction, SourceBlock } from './types'

const b = (id: string, text: string, label = 'text', options: Partial<Pick<SourceBlock, 'page' | 'group' | 'bbox'>> = {}): SourceBlock => ({
  id, text, label, page: 1, group: null, bbox: null, ...options,
})
const box = (l: number, t: number, r: number, height = 12): BBox => ({ l, t, r, b: t + height })
const source = (...blocks: SourceBlock[]): Extraction => ({ contract_version: 1, pages: Math.max(1, ...blocks.map((block) => block.page)), blocks })
const header = () => b('b1', 'MAYA UTAMI', 'title')
const leftovers = (proposal: ReturnType<typeof mapExtraction>) => proposal.unmatched.map((item) => item.text).join('\n')

// These synthetic layouts reproduce the shapes of real extraction failures,
// without retaining the uploaded CV or its personal information.
describe('PDF layout mapping regressions', () => {
  it('reassembles wrapped role and competency fragments without losing source references', () => {
    const proposal = mapExtraction(source(header(),
      b('b2', 'Experience', 'section_header'),
      b('b3', 'Senior Software', 'section_header', { group: 'g1' }),
      b('b4', 'Engineer', 'section_header', { group: 'g1' }),
      b('b5', '2020 – 2024'), b('b6', 'Built services.', 'list_item'),
      b('b7', 'Skills', 'section_header'),
      b('b8', 'Domain: Public services (identity,', 'text', { group: 'g2' }),
      b('b9', 'licensing), Education', 'text', { group: 'g2' }),
    ), 'en')
    const job = proposal.document.content.experience[0]!
    expect(job.company).toBe('')
    expect(job.text.en.role).toBe('Senior Software Engineer')
    expect(proposal.refs).toContainEqual({ path: `experience.${job.id}.role`, blocks: ['b3', 'b4'] })
    expect(proposal.document.content.skills[0]!.text.en.items).toEqual(['Public services (identity, licensing)', 'Education'])
    expect(proposal.unmatched).toEqual([])
  })

  it.each(['New York, United States', 'Jakarta Selatan, Indonesia'])('keeps the complete location %s', (city) => {
    expect(mapExtraction(source(header(), b('b2', city)), 'en').document.profile.text.en.location).toBe(city)
    const merged = mapExtraction(source(header(), b('b2', `Software Engineer\n${city}`)), 'en')
    expect(merged.document.profile.text.en.location).toBe(city)
    expect(merged.unmatched).toEqual([])
  })

  it('retains original sources when joined school fragments are split into records', () => {
    const proposal = mapExtraction(source(header(), b('b2', 'Education', 'section_header'),
      b('b3', 'Universitas Alpha – B.Sc. Computing 2019 – 2023', 'section_header', { group: 'g1' }),
      b('b4', 'SMK Beta – Computing 2015 – 2018', 'section_header', { group: 'g1' })), 'en')
    expect(proposal.document.content.education).toHaveLength(2)
    expect(proposal.unmatched).toEqual([])
    expect(proposal.refs).toContainEqual({ path: `education.${proposal.document.content.education[1]!.id}.school`, blocks: ['b4'] })
  })

  it('keeps conflicting inline date spans out of the company and visible for review', () => {
    const proposal = mapExtraction(source(header(), b('b2', 'Experience', 'section_header'),
      b('b3', 'Software Engineer at Acme 2019 – 2021 2022 – 2024', 'section_header'), b('b4', 'Built services.', 'list_item')), 'en')
    expect(proposal.document.content.experience[0]!.company).toBe('Acme')
    expect(leftovers(proposal)).toContain('2019 – 2021')
    expect(leftovers(proposal)).toContain('2022 – 2024')
  })

  it('does not borrow a date from an education column', () => {
    const proposal = mapExtraction(source(header(), b('b2', 'Experience', 'section_header'),
      b('b3', 'Software Engineer at Acme', 'section_header', { bbox: box(40, 100, 250) }),
      b('b4', 'Built services.', 'list_item'),
      b('b5', 'Education', 'section_header', { bbox: box(330, 60, 550) }),
      b('b6', 'Example University', 'text', { bbox: box(330, 90, 550) }),
      b('b7', '2020 – 2024', 'text', { bbox: box(400, 100, 550) }),
    ), 'en')
    expect(proposal.document.content.experience[0]!.dates.start).toBe('')
    expect(proposal.document.content.education[0]!.dates).toEqual({ start: '2020', end: '2024' })
  })

  it('uses the project metadata date before dates in its narrative', () => {
    const proposal = mapExtraction(source(header(), b('b2', 'Projects', 'section_header'),
      b('b3', 'Atlas (Lead — Go) 2023 Migrated records from 2019–2020.'),
      b('b4', 'Open Source Contributions', 'section_header'), b('b5', 'Maintained community documentation.')), 'en')
    expect(proposal.document.content.projects).toHaveLength(1)
    expect(proposal.document.content.projects[0]!.text.en).toMatchObject({ name: 'Atlas', role: 'Lead', description: 'Migrated records from 2019–2020.' })
    expect(proposal.document.content.projects[0]!.dates.start).toBe('2023')
    expect(leftovers(proposal)).toContain('Maintained community documentation.')
  })
  it('separates a merged headline, location and explicitly labelled contacts without losing the headline', () => {
    const proposal = mapExtraction(source(
      header(),
      b('b2', 'Technical Lead/Senior Engineer (PHP & TypeScript) — IT Instructor — Testing Professional\nBandung, Indonesia — Email maya@example.test Phone +62 811 2233 4455 Portfolio https://example.test/maya'),
      b('b3', 'Summary', 'section_header'),
      b('b4', 'Builds reliable public services.'),
    ), 'en')
    expect(proposal.document.profile.text.en).toMatchObject({
      name: 'MAYA UTAMI',
      headline: 'Technical Lead/Senior Engineer (PHP & TypeScript) — IT Instructor — Testing Professional',
      location: 'Bandung, Indonesia',
      summary: 'Builds reliable public services.',
    })
    expect(proposal.document.contact).toMatchObject({ email: 'maya@example.test', phone: '+62 811 2233 4455', website: 'https://example.test/maya' })
    expect(proposal.refs).toContainEqual({ path: 'profile.headline', blocks: ['b2'] })
    expect(proposal.refs).toContainEqual({ path: 'profile.location', blocks: ['b2'] })
    expect(leftovers(proposal)).not.toMatch(/Email|Phone|Portfolio/)
  })

  it('keeps highlights in summary and maps seven competency groups with balanced comma splitting', () => {
    const proposal = mapExtraction(source(
      header(), b('b2', 'Summary', 'section_header'), b('b3', 'Builds public services.'),
      b('b4', 'Impact Highlights', 'section_header'), b('b5', 'Reduced review time.', 'list_item'),
      b('b6', 'Core Competencies', 'section_header'),
      b('b7', 'Languages: PHP, TypeScript'),
      b('b8', 'Backend: Laravel, Node.js'),
      b('b9', 'Frontend: Vue, React'),
      b('b10', 'Databases: PostgreSQL, MySQL'),
      b('b11', 'Delivery: CI/CD, Docker'),
      b('b12', 'Leadership: Mentoring, Planning'),
      b('b13', 'Domain: Public services (identity, licensing), Education'),
      b('b14', 'Healthcare, Research'),
    ), 'en')
    const skills = proposal.document.content.skills.map((item) => item.text.en)
    expect(skills).toHaveLength(7)
    expect(skills[6]).toEqual({ title: 'Domain', items: ['Public services (identity, licensing)', 'Education', 'Healthcare', 'Research'] })
    expect(proposal.document.profile.text.en.summary).toContain('Impact Highlights')
    expect(proposal.document.profile.text.en.summary).toContain('Reduced review time.')
    expect(proposal.document.profile.text.en.summary).not.toContain('Core Competencies')
    expect(proposal.refs).toContainEqual({ path: `skills.${proposal.document.content.skills[6]!.id}.items`, blocks: ['b13', 'b14'] })
  })

  it('keeps one employer across successive roles, row-associated dates and a page continuation', () => {
    const proposal = mapExtraction(source(
      header(), b('b2', 'Professional Experience', 'section_header'),
      b('b3', 'Northstar Labs / PT Northstar Teknologi', 'section_header', { bbox: box(40, 100, 350) }),
      b('b4', 'Mar 2019 – Present', 'text', { bbox: box(400, 100, 550) }),
      b('b5', 'Role Progression: Training Staff, Software Staff, Tech. Lead / Software Manager'),
      b('b6', 'Tech. Lead / Software Manager', 'section_header', { bbox: box(40, 150, 350) }),
      b('b7', 'Jan 2022 – Present', 'text', { bbox: box(400, 150, 550) }),
      b('b8', 'Led the platform team.', 'list_item', { group: 'lead' }),
      b('b9', 'Mentored senior engineers.', 'list_item', { group: 'lead', page: 2 }),
      b('b10', 'Software Staff (Full Stack Developer)', 'section_header', { page: 2, bbox: box(40, 80, 350) }),
      b('b11', 'Mar 2019 – Jan 2022', 'text', { page: 2, bbox: box(400, 80, 550) }),
      b('b12', 'Built a scheduling service.', 'list_item', { page: 2 }),
      b('b13', 'Training Staff (Software Engineer Focus)', 'section_header', { page: 2, bbox: box(40, 140, 350) }),
      b('b14', 'Mar 2019 – Dec 2019', 'text', { page: 2, bbox: box(400, 140, 550) }),
      b('b15', 'Supported technical workshops.', 'list_item', { page: 2 }),
      b('b16', 'Additional Experience', 'section_header', { page: 2 }),
      b('b17', 'IT Course Instructor', 'text', { page: 2, bbox: box(40, 220, 350) }),
      b('b18', 'Feb 2022 – Present', 'text', { page: 2, bbox: box(400, 220, 550) }),
      b('b19', 'Taught backend development.', 'list_item', { page: 2 }),
    ), 'en')
    const jobs = proposal.document.content.experience
    expect(jobs).toHaveLength(4)
    expect(jobs.slice(0, 3).map((job) => job.company)).toEqual(Array(3).fill('Northstar Labs / PT Northstar Teknologi'))
    expect(jobs.map((job) => job.text.en.role)).toEqual(['Tech. Lead / Software Manager', 'Software Staff (Full Stack Developer)', 'Training Staff (Software Engineer Focus)', 'IT Course Instructor'])
    expect(jobs.map((job) => job.dates)).toEqual([
      { start: '2022-01', end: null, current: true },
      { start: '2019-03', end: '2022-01' },
      { start: '2019-03', end: '2019-12' },
      { start: '2022-02', end: null, current: true },
    ])
    expect(jobs[0]!.text.en.bullets).toEqual(['Led the platform team.', 'Mentored senior engineers.'])
    expect(jobs[3]!.company).toBe('')
    expect(leftovers(proposal)).toContain('Role Progression:')
    expect(leftovers(proposal)).toContain('Mar 2019 – Present')
    expect(proposal.refs).toContainEqual({ path: `experience.${jobs[0]!.id}.dates`, blocks: ['b7'] })
    expect(proposal.refs).toContainEqual({ path: `experience.${jobs[0]!.id}.bullets`, blocks: ['b8', 'b9'] })
  })

  it('leaves conflicting same-row dates blank and visible rather than picking one', () => {
    const proposal = mapExtraction(source(
      header(), b('b2', 'Experience', 'section_header'),
      b('b3', 'Software Engineer at Example Systems', 'section_header', { bbox: box(40, 100, 300) }),
      b('b4', '2020 – 2022', 'text', { bbox: box(330, 100, 420) }),
      b('b5', '2021 – 2023', 'text', { bbox: box(430, 100, 530) }),
      b('b6', 'Built a search service.', 'list_item'),
    ), 'en')
    expect(proposal.document.content.experience[0]!.dates.start).toBe('')
    expect(proposal.warnings.some((warning) => String(warning.code) === 'ambiguous_dates')).toBe(true)
    expect(leftovers(proposal)).toContain('2020 – 2022')
    expect(leftovers(proposal)).toContain('2021 – 2023')
  })

  it('parses five inline project entries while preserving client parentheses and descriptions', () => {
    const proposal = mapExtraction(source(
      header(), b('b2', 'Selected Projects', 'section_header'),
      b('b3', 'ATLAS (CIVIC) (Programmer — Laravel, Next.js, PostgreSQL) 2020–2021 Built a searchable public archive.'),
      b('b4', 'BEACON (WEATHER) (Programmer — Laravel, Python, PostgreSQL) 2021'),
      b('b5', 'Calculated nearby storm intersections.'),
      b('b6', 'CLOUD (PERMITS) (Senior Programmer — Laravel, REST APIs, PostgreSQL) 2021–2023 Cut permit processing time.'),
      b('b7', 'DELTA (RESEARCH) (Tech Lead — Laravel, Next.js, PostgreSQL) 2023'),
      b('b8', 'Centralized authoritative river data.'),
      b('b9', 'ECHO Information System (Tech Lead — Laravel, MySQL, REST APIs) 2024–Present Directed certificate workflow delivery.'),
    ), 'en')
    const projects = proposal.document.content.projects
    expect(projects).toHaveLength(5)
    expect(projects.map((item) => item.text.en.name)).toEqual(['ATLAS (CIVIC)', 'BEACON (WEATHER)', 'CLOUD (PERMITS)', 'DELTA (RESEARCH)', 'ECHO Information System'])
    expect(projects[0]!.text.en).toMatchObject({ role: 'Programmer', description: 'Built a searchable public archive.' })
    expect(projects[0]!.techStack).toEqual(['Laravel', 'Next.js', 'PostgreSQL'])
    expect(projects[1]!.dates.start).toBe('2021')
    expect(projects[1]!.dates.current).not.toBe(true)
    expect(projects[1]!.text.en.description).toBe('Calculated nearby storm intersections.')
    expect(projects[4]!.dates).toEqual({ start: '2024', end: null, current: true })
    expect(proposal.refs).toContainEqual({ path: `projects.${projects[1]!.id}.description`, blocks: ['b5'] })
  })

  it('parses inline schools without inventing a degree absent from the source', () => {
    const proposal = mapExtraction(source(
      header(), b('b2', 'Education', 'section_header'),
      b('b3', 'Universitas Nusantara – B.Sc. Information Technology 2019 – 2025'),
      b('b4', 'SMK Negeri Contoh – Computer & Information Sciences 2015 – 2018'),
    ), 'en')
    const education = proposal.document.content.education
    expect(education).toHaveLength(2)
    expect(education[0]!.text.en).toMatchObject({ school: 'Universitas Nusantara', degree: 'B.Sc.', field: 'Information Technology' })
    expect(education[0]!.dates).toEqual({ start: '2019', end: '2025' })
    expect(education[1]!.text.en).toMatchObject({ school: 'SMK Negeri Contoh', degree: '', field: 'Computer & Information Sciences' })
    expect(education[1]!.dates).toEqual({ start: '2015', end: '2018' })
  })

  it('separates mixed awards and certificates, preserves spoken languages and unknown sections', () => {
    const proposal = mapExtraction(source(
      header(), b('b2', 'Projects', 'section_header'), b('b3', 'Public Archive (Lead — TypeScript) 2023'),
      b('b4', 'Certifications & Awards', 'section_header'),
      b('b5', 'Professional Testing Certificate — Example Institute — 2023'),
      b('b6', 'National Gold Pin Award — Example Council — 2021'),
      b('b7', 'Languages', 'section_header'), b('b8', 'Bahasa Indonesia (Native); English (Conversational Level)'),
      b('b9', 'Community Activities', 'section_header'), b('b10', 'Organized neighborhood repair workshops.'),
    ), 'en')
    expect(proposal.document.content.projects).toHaveLength(1)
    expect(proposal.document.content.awards).toHaveLength(1)
    expect(proposal.document.content.awards[0]!.text.en.title).toContain('Gold Pin')
    expect(proposal.document.content.awards[0]!.date).toBe('2021')
    expect(proposal.document.content.skills).toHaveLength(0)
    expect(leftovers(proposal)).toContain('Professional Testing Certificate')
    expect(leftovers(proposal)).toContain('Bahasa Indonesia (Native)')
    expect(leftovers(proposal)).toContain('Organized neighborhood repair workshops.')
  })

  it('recognizes Indonesian competency and additional-experience headings contextually', () => {
    const proposal = mapExtraction(source(
      header(), b('b2', 'Kompetensi Inti', 'section_header'),
      b('b3', 'Bidang: Education, Layanan publik'),
      b('b4', 'Pengalaman Tambahan', 'section_header'),
      b('b5', 'Instruktur TI', 'text'), b('b6', 'Februari 2022 – Sekarang'), b('b7', 'Mengajar pengembangan aplikasi.', 'list_item'),
    ), 'id')
    expect(proposal.document.content.skills.map((item) => item.text.id)).toEqual([{ title: 'Bidang', items: ['Education', 'Layanan publik'] }])
    expect(proposal.document.content.experience).toHaveLength(1)
    expect(proposal.document.content.experience[0]!.text.id.role).toBe('Instruktur TI')
    expect(proposal.document.content.experience[0]!.company).toBe('')
    expect(proposal.document.content.experience[0]!.dates).toEqual({ start: '2022-02', end: null, current: true })
  })

  it('maps the real Docling progression fixture with late date blocks and flattened lines', () => {
    const parsed = parseExtraction(JSON.parse(readFileSync(resolve(__dirname, '../../../../services/pdf-import/tests/fixtures/contract/valid/extraction_progression.json'), 'utf8')))
    if (!parsed.ok) throw new Error(parsed.error)
    const proposal = mapExtraction(parsed.value, 'en')
    const doc = proposal.document
    expect(doc.profile.text.en).toMatchObject({
      name: 'MAYA NUSANTARA',
      headline: 'Technical Lead/Senior Engineer (Python & TypeScript) - IT Instructor',
      location: 'Bandung, Indonesia',
    })
    expect(doc.content.skills).toHaveLength(7)
    expect(doc.content.skills[6]!.text.en).toEqual({ title: 'Domain', items: ['Public services', 'Education (training, coaching)', 'Workflow modernization'] })
    expect(doc.content.experience).toHaveLength(4)
    expect(doc.content.experience.map((item) => item.company)).toEqual([
      'Contoh Learning / PT Contoh Teknologi', 'Contoh Learning / PT Contoh Teknologi', 'Contoh Learning / PT Contoh Teknologi', '',
    ])
    expect(doc.content.experience.map((item) => item.dates)).toEqual([
      { start: '2022-01', end: null, current: true },
      { start: '2018-03', end: '2022-01' },
      { start: '2018-03', end: '2018-12' },
      { start: '2022-02', end: null, current: true },
    ])
    expect(doc.content.experience.map((item) => item.text.en.bullets.length)).toEqual([5, 4, 2, 2])
    expect(doc.content.experience[0]!.text.en.bullets[4]).toBe('Coordinated delivery with public-sector stakeholders.')
    expect(doc.content.projects).toHaveLength(5)
    expect(doc.content.projects.map((item) => item.text.en.name)).toEqual([
      'Personnel Portal (CIVIC)', 'Storm Tracker (METEO)', 'Submission Hub (CIVIC)', 'Lake Atlas (RESEARCH)', 'Certificate System (SKILLS)',
    ])
    expect(doc.content.education).toHaveLength(2)
    expect(doc.content.education.map((item) => item.text.en.school)).toEqual(['Universitas Contoh', 'SMK Contoh'])
    expect(doc.content.education.map((item) => item.dates)).toEqual([{ start: '2019', end: '2025' }, { start: '2015', end: '2018' }])
    expect(doc.content.awards).toHaveLength(1)
    expect(doc.content.awards[0]!.text.en.title).toContain('Gold Pin')
    expect(leftovers(proposal)).toContain('Foundation Testing Certificate')
    expect(leftovers(proposal)).toContain('Bahasa Indonesia (Native); English (Conversational)')
    expect(proposal.refs).toContainEqual({ path: `experience.${doc.content.experience[0]!.id}.dates`, blocks: ['b26'] })
  })
})

// Header and regions from the typography outline: a name/heading style is
// learned from the known headings, so a plain-text name and an unknown
// heading in the same style are read the way the page shows them.
describe('PDF outline mapping', () => {
  const S = (font: string, size: number): BlockStyle => ({ font, size, bold: null, italic: null })
  const s = (id: string, text: string, label: string, style: BlockStyle | null, options: Partial<Pick<SourceBlock, 'page' | 'group' | 'bbox'>> = {}): SourceBlock => ({
    ...b(id, text, label, options), style,
  })
  const top = () => [
    s('b1', 'Rina Wulandari', 'text', S('f1', 14)),
    s('b2', 'People Development | Learning & Development | Bilingual Facilitator', 'text', S('f3', 10)),
    s('b3', 'Bandung, Indonesia | rina.w@example.com | +62 811 0000 5678', 'text', S('f3', 10)),
    s('b4', 'Profile Summary', 'text', S('f2', 16)),
    s('b5', 'I have four years of experience in learning and development across banking, retail and education.', 'text', S('f3', 10)),
  ]

  it('maps the header from the outline and keeps bullets out of it', () => {
    const proposal = mapExtraction(source(...top(),
      s('b6', 'Competencies & Abilities', 'text', S('f2', 16)),
      s('b7', '➔ Support Skills: Office 365, Fast Typing, AI Integration', 'list_item', S('f3', 10)),
    ), 'en')
    expect(proposal.document.profile.text.en).toMatchObject({
      name: 'Rina Wulandari',
      headline: 'People Development | Learning & Development | Bilingual Facilitator',
      location: 'Bandung, Indonesia',
      summary: 'I have four years of experience in learning and development across banking, retail and education.',
    })
    expect(proposal.document.contact).toMatchObject({ email: 'rina.w@example.com', phone: '+62 811 0000 5678' })
    expect(proposal.document.content.skills.map((group) => group.text.en)).toEqual([
      { title: 'Support Skills', items: ['Office 365', 'Fast Typing', 'AI Integration'] },
    ])
    expect(proposal.refs).toContainEqual({ path: 'profile.name', blocks: ['b1'] })
    expect(proposal.unmatched).toEqual([])
  })

  it('takes the location from the contact row before a comma-separated headline', () => {
    const blocks = top()
    blocks[1] = s('b2', 'Facilitator, Trainer', 'text', S('f3', 10))
    const profile = mapExtraction(source(...blocks), 'en').document.profile.text.en
    expect(profile.location).toBe('Bandung, Indonesia')
    expect(profile.headline).toBe('Facilitator, Trainer')
  })

  it('lists an unknown heading-style section as outside the structure without leaking into the previous section', () => {
    const proposal = mapExtraction(source(...top(),
      s('b6', 'Hobbies', 'text', S('f2', 16)),
      s('b7', 'Hiking', 'text', S('f3', 10)),
      s('b8', 'Working Experience', 'text', S('f2', 16)),
    ), 'en')
    expect(proposal.document.profile.text.en.summary).not.toContain('Hiking')
    expect(proposal.warnings).toContainEqual({ code: 'outside_structure', blocks: ['b6'] })
    expect(leftovers(proposal)).toContain('Hobbies')
    expect(leftovers(proposal)).toContain('Hiking')
  })

  it('keeps recommended sections that are not mapped yet unplaced without the outside warning', () => {
    const proposal = mapExtraction(source(...top(),
      s('b6', 'References', 'text', S('f2', 16)),
      s('b7', 'Anggi Pratiwi', 'text', S('f3', 10)),
    ), 'en')
    expect(proposal.warnings.map((warning) => warning.code)).not.toContain('outside_structure')
    expect(leftovers(proposal)).toContain('References')
    expect(leftovers(proposal)).toContain('Anggi Pratiwi')
  })

  it('keeps header fields empty from bullets when headings are unknown (fallback)', () => {
    const proposal = mapExtraction(source(
      b('b1', 'Rina Wulandari', 'section_header'),
      b('b2', 'Abilities Overview', 'section_header'),
      b('b3', '➔ Support Skills: Office 365, Fast Typing, AI Integration', 'list_item'),
      b('b4', '➔ Training Skills: Needs Analysis, Curriculum Design', 'list_item'),
    ), 'en')
    expect(proposal.document.profile.text.en).toMatchObject({ name: 'Rina Wulandari', headline: '', location: '' })
  })

  it('joins a bullet continued on the next page', () => {
    const proposal = mapExtraction(source(header(), b('b2', 'Experience', 'section_header'),
      b('b3', 'Curriculum Designer', 'section_header'), b('b4', '2022 – 2024'),
      b('b5', 'Reviewed drafts before submission to the programme office', 'list_item', { group: 'g1', bbox: box(91, 760, 500) }),
      b('b6', 'for further review.', 'list_item', { group: 'g1', page: 2, bbox: box(108, 50, 200) }),
    ), 'en')
    const job = proposal.document.content.experience[0]!
    expect(job.text.en.bullets).toEqual(['Reviewed drafts before submission to the programme office for further review.'])
    expect(proposal.refs).toContainEqual({ path: `experience.${job.id}.bullets`, blocks: ['b5', 'b6'] })
  })
})

// The guard for the outline: a document whose blocks all share one style has no
// establishable heading class, so the mapper must produce exactly the rules-path
// proposal. Ids are random, so they are normalised wherever they appear.
describe('outline fallback equivalence', () => {
  const root = resolve(__dirname, '../../../../services/pdf-import/tests/fixtures/contract/valid')
  const FIXTURES = readdirSync(root).filter((file) => /^extraction_.+\.json$/.test(file)).map((file) => file.slice('extraction_'.length, -'.json'.length))
  const loadFixture = (name: string): Extraction => {
    const parsed = parseExtraction(JSON.parse(readFileSync(resolve(root, `extraction_${name}.json`), 'utf8')))
    if (!parsed.ok) throw new Error(parsed.error)
    return parsed.value
  }
  const normalise = (p: Proposal) => JSON.parse(JSON.stringify(p).replace(/(?<=[".])(?:exp|edu|prj|skl|awd|crt|ref)_[a-z0-9]+(?=[".])/g, 'ID'))
  const singleStyle = (e: Extraction): Extraction => ({ ...e, blocks: e.blocks.map((block) => ({ ...block, style: { font: 'f1', size: 10, bold: null, italic: null } })) })

  it('covers every extraction fixture', () => {
    expect(FIXTURES).toEqual(expect.arrayContaining(['en_single', 'id_single', 'two_column', 'five_page', 'progression', 'scanned', 'mixed', 'guide_template']))
  })

  it.each(FIXTURES)('fallback mapping equals the rules path for %s', (name) => {
    const e = loadFixture(name)
    expect(normalise(mapExtraction(singleStyle(e), 'en'))).toEqual(normalise(mapExtraction(stripStyles(e), 'en')))
  })

  it('maps the mixed native/scanned fixture', () => {
    const e = loadFixture('mixed')
    const scanned = new Set(e.blocks.filter((block) => block.style == null).map((block) => block.id))
    expect([...scanned]).toEqual(expect.arrayContaining(['b21', 'b24', 'b26', 'b29']))
    // Every field filled from unstyled (scanned) blocks, with its value, plus the scanned leftovers and warnings.
    const scannedPart = (proposal: Proposal) => {
      const { document, locale } = proposal
      const valueAt = (path: string): unknown => {
        const [head, id, field] = path.split('.') as [string, string, string | undefined]
        if (head === 'profile') return document.profile.text[locale][id as keyof (typeof document.profile.text)['en']]
        if (head === 'contact') return document.contact[id as keyof typeof document.contact]
        const item = (document.content[head as keyof typeof document.content] as unknown as { id: string; text: Record<string, Record<string, unknown>> }[]).find((entry) => entry.id === id)!
        return field! in item ? (item as unknown as Record<string, unknown>)[field!] : item.text[locale]![field!]
      }
      return normalise({
        ...proposal,
        document: undefined as never,
        refs: proposal.refs.filter((ref) => ref.blocks.some((id) => scanned.has(id))).map((ref) => ({ ...ref, value: valueAt(ref.path) })),
        warnings: proposal.warnings.filter((warning) => warning.blocks.some((id) => scanned.has(id))),
        unmatched: proposal.unmatched.filter((item) => scanned.has(item.block)),
      })
    }
    const styled = scannedPart(mapExtraction(e, 'en'))
    expect(styled.refs.map((ref: { path: string }) => ref.path)).toEqual(expect.arrayContaining(['experience.ID.role', 'experience.ID.bullets', 'education.ID.school']))
    expect(styled).toEqual(scannedPart(mapExtraction(stripStyles(e), 'en')))
  })
})
