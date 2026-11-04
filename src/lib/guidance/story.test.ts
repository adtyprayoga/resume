import { describe, expect, it } from 'vitest'
import { emptyDocument } from '$lib/model/document'
import type { Locale, ResumeDocument } from '$lib/model/types'
import { buildStory, gapIds, type StoryPage } from './story'

const localized = <T>(value: T) => ({ en: structuredClone(value), id: structuredClone(value) })
const job = (id = 'job') => ({ id, company: '', dates: { start: '', end: null as string | null, current: false }, text: localized({ role: '', team: '', location: '', bullets: [] as string[] }) })
const school = () => ({ id: 'school', dates: { start: '', end: null as string | null, current: false }, gpa: '', text: localized({ school: '', degree: '', field: '', description: '' }) })
const course = () => ({ id: 'cert', date: '', text: localized({ title: '', issuer: '', description: '' }) })
const reference = () => ({ id: 'ref', phone: '', email: '', text: localized({ name: '', position: '', note: '' }) })
const page = (doc: ResumeDocument, id: string, locale: Locale = 'en') => buildStory(doc, locale).find(p => p.id === id)!
const blanks = (p: StoryPage) => p.blanks.map(b => b.id)
const prose = (p: StoryPage) => p.paragraphs.map(p => p.map(s => s.kind === 'blank' ? `[${s.id}]` : s.text).join('')).join('\n')

function strong() {
  const doc = emptyDocument()
  doc.profile.text = localized({ name: 'Ayu', headline: 'Engineer | Mentor | Builder', location: 'Bandung', summary: 'I have 8 years of experience designing reliable systems with teams across many industries and helping people develop practical skills through patient teaching and thoughtful collaboration.' })
  Object.assign(doc.contact, { email: 'a@example.com', phone: '123', linkedin: 'https://linkedin.com/in/a' })
  doc.content.skills = ['Engineering', 'Tools', 'Soft Skills', 'Languages'].map((title, i) => ({ id: `g${i}`, text: localized({ title, items: [i === 3 ? 'English (fluent)' : 'Design'] }) }))
  const j = job(); j.company = 'Acme'; j.dates = { start: '2024-01', end: null, current: true }; j.text = localized({ role: 'Engineer', team: 'Platform', location: 'Bandung', bullets: ['Saved 20 hours'] }); doc.content.experience = [j]
  const e = school(); e.gpa = '3.8'; e.dates = { start: '2018-01', end: '2022-01', current: false }; e.text = localized({ school: 'University', degree: 'BSc', field: 'Computing', description: 'Research' }); doc.content.education = [e]
  const c = course(); c.date = '2023-01'; c.text = localized({ title: 'Systems', issuer: 'Academy', description: 'Design' }); doc.content.certifications = [c]
  const r = reference(); r.text = localized({ name: '', position: '', note: 'Available upon request' }); doc.content.references = [r]
  return doc
}

describe('buildStory', () => {
  it('orders chapters independently of resume section order and represents ending explicitly', () => {
    const doc = emptyDocument(); doc.sections.reverse()
    expect(buildStory(doc, 'en').map(p => [p.id, p.chapterNumber])).toEqual([
      ['headline', 1], ['summary', 2], ['competencies', 3], ['experience', 4], ['education', 5], ['course', 6], ['references', 7], ['ending', null],
    ])
    expect(page(doc, 'ending').chapter).toBe('ending')
    doc.sections.forEach(s => { s.enabled = false })
    expect(buildStory(doc, 'en').map(p => p.id)).toEqual(['headline', 'summary', 'ending'])
  })
  it.each(['en', 'id'] as const)('opens in %s with resume segments and independent bilingual labels', locale => {
    const doc = emptyDocument(); doc.profile.text.en.name = 'Ayu'; doc.profile.text.en.headline = 'Engineer | Mentor'
    const p = page(doc, 'headline', locale)
    expect(prose(p).split('\n')[0]).toBe(locale === 'en' ? 'Once upon a time, there lived a Engineer called Ayu.' : 'Pada suatu masa, hiduplah seorang Engineer bernama Ayu.')
    expect(p.paragraphs[0]!.filter(s => s.kind === 'resume').map(s => s.text)).toEqual(['Engineer', 'Ayu'])
    expect(p.blanks.find(b => b.id === 'headline:city')?.label).toEqual({ en: 'City', id: 'Kota' })
    expect(page(doc, 'summary', locale).title.id).toBe('Ringkasan Profil')
  })
  it('covers headline gaps and optional photo narration', () => {
    const doc = emptyDocument()
    expect(blanks(page(doc, 'headline'))).toEqual(['headline:secondary', 'headline:differentiator', 'headline:city', 'headline:email', 'headline:phone', 'headline:linkedin'])
    expect(prose(page(doc, 'headline'))).toContain('optional')
    expect(blanks(page(strong(), 'headline'))).toEqual([])
    doc.profile.text.en.location = 'Jalan Merdeka 10'; expect(blanks(page(doc, 'headline'))).toContain('headline:city')
    doc.contact.avatar = 'photo.png'; expect(prose(page(doc, 'headline'))).not.toContain('optional')
  })
  it('asks full summary questions for short text and only years/field for long unnumbered text', () => {
    const doc = emptyDocument()
    expect(blanks(page(doc, 'summary'))).toEqual(['years', 'field', 'industries', 'expertise', 'audience', 'strengths'].map(s => `summary:${s}`))
    doc.profile.text.en.summary = '8 years'; expect(page(doc, 'summary').blanks).toHaveLength(6)
    doc.profile.text.en.summary = 'experienced '.repeat(30); expect(blanks(page(doc, 'summary'))).toEqual(['summary:years', 'summary:field'])
    expect(page(strong(), 'summary').blanks).toEqual([])
  })
  it('covers missing skill kinds and disambiguates language levels by group id', () => {
    const doc = emptyDocument()
    expect(blanks(page(doc, 'competencies'))).toEqual(['hardField', 'hardItems', 'tools', 'soft', 'languages', 'wanted'].map(s => `competencies:${s}`))
    doc.content.skills = ['a', 'b'].map(id => ({ id, text: localized({ title: 'Languages', items: ['English'] }) }))
    const p = page(doc, 'competencies')
    expect(blanks(p)).toEqual(expect.arrayContaining(['competencies:level:a:0', 'competencies:level:b:0']))
    expect(p.blanks.find(b => b.id.endsWith('a:0'))?.label).toEqual({ en: 'English', id: 'English' })
    expect(blanks(page(strong(), 'competencies'))).toEqual(['competencies:wanted'])
  })
  it('covers job fields, conditional dates, reflection and ordering', () => {
    const doc = emptyDocument(); doc.content.experience = [job('old'), job('new')]
    const p = page(doc, 'experience:old')
    expect(blanks(p)).toEqual(['company', 'role', 'location', 'start', 'end', 'achievement', 'with', 'goal'].map(s => `experience:old:${s}`))
    expect(p.choices.find(c => c.id.endsWith(':current'))?.options.map(o => o.value)).toEqual(['yes', 'no'])
    expect(p.blanks.find(b => b.id.endsWith(':end'))?.when).toEqual({ choiceId: 'experience:old:current', value: 'no' })
    doc.content.experience[0]!.dates.start = '2020-01'; doc.content.experience[1]!.dates.start = '2024-01'
    expect(page(doc, 'experience:old').choices.find(c => c.id.endsWith(':order'))?.gap).toBe(true)
    expect(page(doc, 'experience:new').choices.some(c => c.id.endsWith(':order'))).toBe(false)
    doc.content.experience[0]!.text.en.bullets = ['Built tools', 'Saved 20 hours']
    expect(page(doc, 'experience:old').choices.find(c => c.id.endsWith(':core'))?.options.map(o => o.value)).toEqual(['0', '1'])
    expect(blanks(page(doc, 'experience:old'))).not.toContain('experience:old:achievement')
    expect(blanks(page(strong(), 'experience:job'))).toEqual(['experience:job:with', 'experience:job:goal'])
  })
  it.each(['experience', 'education'] as const)('%s asks current/end only when neither is established', kind => {
    const doc = emptyDocument(); doc.content.experience = [job()]; doc.content.education = [school()]
    const id = kind === 'experience' ? 'experience:job' : 'education'
    const item = doc.content[kind][0]!
    for (const dates of [{ start: '', end: null, current: true }, { start: '', end: '2024-01', current: false }]) {
      item.dates = dates
      expect(page(doc, id).choices.some(c => c.id.endsWith(':current'))).toBe(false)
      expect(page(doc, id).blanks.some(b => b.id.endsWith(':end'))).toBe(false)
    }
  })
  it('covers education missing fields per item', () => {
    const doc = emptyDocument(); doc.content.education = [school()]
    const p = page(doc, 'education')
    expect(blanks(p)).toEqual(['school', 'degree', 'field', 'gpa', 'start', 'end'].map(s => `education:school:${s}`))
    expect(p.blanks.at(-1)?.when).toEqual({ choiceId: 'education:school:current', value: 'no' })
    expect(page(strong(), 'education').blanks).toEqual([])
  })
  it('covers course title/issuer/month and optional topics', () => {
    const doc = emptyDocument(); doc.content.certifications = [course()]
    expect(blanks(page(doc, 'course:cert'))).toEqual(['title', 'issuer', 'date', 'topics'].map(s => `course:cert:${s}`))
    doc.content.certifications[0]!.date = '2024'; expect(blanks(page(doc, 'course:cert'))).toContain('course:cert:date')
    expect(page(strong(), 'course:cert').blanks).toEqual([])
  })
  it('covers unnamed incomplete references but accepts note-only references', () => {
    const doc = emptyDocument(); doc.content.references = [reference()]
    expect(blanks(page(doc, 'references'))).toEqual(['name', 'position', 'phone', 'email'].map(s => `references:ref:${s}`))
    expect(page(doc, 'references').choices[0]?.gap).toBe(false)
    expect(page(strong(), 'references').blanks).toEqual([])
    expect(page(strong(), 'references').choices).toEqual([])
    const r = doc.content.references[0]!; r.text = localized({ name: 'Budi', position: 'Lead', note: '' }); r.phone = '123'; r.email = 'b@example.com'
    expect(page(doc, 'references').blanks).toEqual([])
  })
  it.each(['experience', 'education', 'course', 'references'])('gates empty %s controls behind a confirm', id => {
    const p = page(emptyDocument(), id)
    expect(p.confirm?.id).toBe(`${id}:start`)
    expect(p.confirm?.reveals).toEqual([...p.blanks.map(b => b.id), ...p.choices.map(c => c.id)])
    expect(gapIds(emptyDocument(), 'en')).toContain(`${id}:start`)
    expect(new Set([...p.blanks, ...p.choices, p.confirm!].map(c => c.id)).size).toBe(p.blanks.length + p.choices.length + 1)
  })
  it('uses inherited values verbatim, embeds blanks in prose, and never mutates', () => {
    const doc = strong(); doc.profile.text.id = { name: '', headline: '', location: '', summary: '' }
    doc.content.skills[0]!.text.id = { title: '', items: [] }; doc.content.experience[0]!.text.id.bullets = []
    const before = structuredClone(doc)
    const pages = buildStory(doc, 'id')
    expect(prose(pages[1]!)).toContain(doc.profile.text.en.summary)
    expect(prose(page(doc, 'competencies', 'id'))).toContain('Engineering')
    expect(prose(page(doc, 'experience:job', 'id'))).toContain('Saved 20 hours')
    for (const p of buildStory(emptyDocument(), 'en')) {
      for (const b of p.blanks) {
        const paragraph = p.paragraphs.find(parts => parts.some(s => s.kind === 'blank' && s.id === b.id))
        expect(paragraph?.some(s => s.kind === 'text' && s.text.trim().length > 0)).toBe(true)
      }
    }
    expect(doc).toEqual(before)
  })
  it.each(['en', 'id'] as const)('joins skill lists naturally in %s without absorbing values into narration', locale => {
    const doc = strong()
    doc.content.skills[0]!.text = localized({ title: 'Engineering', items: ['Design', 'Testing', 'Delivery'] })
    const p = page(doc, 'competencies', locale)
    expect(prose(p)).toContain(locale === 'en' ? 'Design, Testing, and Delivery' : 'Design, Testing, dan Delivery')
    expect(p.paragraphs[0]!.filter(s => s.kind === 'resume').map(s => s.text)).toEqual(['Engineering', 'Design', 'Testing', 'Delivery'])
  })
  it('keeps per-item pages and restores all newly emptied fields after a review revision', () => {
    const doc = strong()
    doc.content.experience.push(job('second')); doc.content.certifications.push({ ...course(), id: 'second' })
    expect(buildStory(doc, 'en').filter(p => p.chapter === 'experience').map(p => p.id)).toEqual(['experience:job', 'experience:second'])
    expect(buildStory(doc, 'en').filter(p => p.chapter === 'course').map(p => p.id)).toEqual(['course:cert', 'course:second'])
    expect(blanks(page(doc, 'experience:second'))).toContain('experience:second:company')
    expect(blanks(page(doc, 'course:second'))).toContain('course:second:title')
    const all = buildStory(doc, 'en').flatMap(p => [...p.blanks, ...p.choices, ...(p.confirm ? [p.confirm] : [])].map(c => c.id))
    expect(new Set(all).size).toBe(all.length)
  })
  it('leaves unanswered current/end untouched, including on deeply frozen input', () => {
    const doc = emptyDocument(); doc.content.experience = [job()]; doc.content.education = [school()]
    delete doc.content.experience[0]!.dates.current
    doc.content.education[0]!.dates.end = ''
    const before = structuredClone(doc)
    const freeze = (value: object) => {
      Object.values(value).forEach(child => { if (child && typeof child === 'object') freeze(child) })
      Object.freeze(value)
    }
    freeze(doc)
    for (const locale of ['en', 'id'] as const) {
      expect(() => buildStory(doc, locale)).not.toThrow()
      expect(() => gapIds(doc, locale)).not.toThrow()
    }
    expect(doc).toEqual(before)
  })
  it('does not interpret template-shaped resume text and preserves repair values', () => {
    const doc = strong(); doc.profile.text.en.name = '{city}'
    doc.content.experience[0]!.text.en.location = 'Jalan Mawar 10'
    doc.content.certifications[0]!.date = '2024'
    expect(prose(page(doc, 'headline'))).toContain('called {city}.')
    const jobPage = page(doc, 'experience:job')
    expect(prose(jobPage)).toContain('Jalan Mawar 10')
    expect(blanks(jobPage)).toContain('experience:job:location')
    expect(page(doc, 'course:cert').paragraphs.flat()).toContainEqual({ kind: 'resume', text: '2024' })
  })
  it('excludes reflective controls, keeps stable unique gap ids and yields no gaps for a strong resume', () => {
    expect(gapIds(strong(), 'en')).toEqual([])
    const ids = gapIds(emptyDocument(), 'en')
    expect(ids).toEqual(gapIds(emptyDocument(), 'en'))
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.some(id => /:(wanted|with|goal|core|topics|supervisor)$/.test(id))).toBe(false)
  })
})
