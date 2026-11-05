import { beforeEach, expect, it } from 'vitest'
import { emptyDocument } from '$lib/model/document'
import { resolve } from '$lib/model/resolve'
import { readDraft } from '$lib/editing/fields'
import { getSectionModule } from '$lib/sections/registry'
import { resumeDoc } from '$lib/state/document.svelte'
import type { ListSectionKind } from '$lib/sections/kinds'
import type { Locale } from '$lib/model/types'
import { buildStory } from './story'
import { applyPage, type Answers } from './apply'

beforeEach(() => resumeDoc.load(emptyDocument()))
function add(kind: ListSectionKind) {
  resumeDoc.addItem(kind)
  resumeDoc.load(resumeDoc.snapshot())
  return resumeDoc.current.content[kind][0]!.id
}
function write(id: string, answers: Answers, locale: Locale = 'en') {
  const before = JSON.stringify(resumeDoc.current)
  const page = buildStory(resumeDoc.current, locale).find(p => p.id === id)!
  const written = applyPage(page, answers, locale)
  for (const w of written) expect(w.value).toEqual(readDraft(resumeDoc.current, w.ref, w.locale))
  expect(new Set(written.map(w => JSON.stringify(w.ref))).size).toBe(written.length)
  const after = resumeDoc.snapshot()
  if (JSON.stringify(after) !== before) {
    expect(resumeDoc.undo()).toBe(true)
    expect(JSON.stringify(resumeDoc.current)).toBe(before)
    expect(resumeDoc.canUndo).toBe(false)
    resumeDoc.load(after)
  } else expect(resumeDoc.canUndo).toBe(false)
  return written
}
it('appends headline parts in order, replaces city and normalizes contact', () => {
  resumeDoc.current.profile.text.en.headline = ' Engineer '
  write('headline', { 'headline:secondary': ' Mentor ', 'headline:differentiator': 'Builder', 'headline:city': 'Bandung', 'headline:email': 'a@b.c', 'headline:phone': '123', 'headline:linkedin': 'linkedin.com/in/a', unknown: 'ignored' }, 'id')
  expect(resumeDoc.current.profile.text.id.headline).toBe(' Engineer  | Mentor | Builder')
  expect(resumeDoc.current.profile.text.en.headline).toBe(' Engineer ')
  expect(resumeDoc.current.profile.text.id.location).toBe('Bandung')
  expect(resumeDoc.current.contact).toMatchObject({ email: 'a@b.c', phone: '123', linkedin: 'https://linkedin.com/in/a' })
})
it.each(['en', 'id'] as const)('prepends partial summary and preserves original verbatim in %s', locale => {
  resumeDoc.current.profile.text.en.summary = ' Original sentence.  '
  write('summary', { 'summary:industries': 'Health, Finance' }, locale)
  expect(resumeDoc.current.profile.text[locale].summary).toMatch(/Health.*Finance.* Original sentence\.  $/)
  if (locale === 'id') expect(resumeDoc.current.profile.text.en.summary).toBe(' Original sentence.  ')
})
it('uses all summary inputs', () => {
  write('summary', Object.fromEntries(Object.entries({ years: '5', field: 'IT', industries: 'Health', expertise: 'Design, Testing', audience: 'teams', strengths: 'patient' }).map(([k,v]) => [`summary:${k}`, v])))
  expect(resumeDoc.current.profile.text.en.summary).toBe('I have 5 years of experience in the field of IT, across industries including Health. My expertise involves Design and Testing. I have worked with teams. I am known for being patient.')
})
it.each([false, true])('merges wanted and hard items in one group (hard=%s)', hard => {
  write('competencies', { 'competencies:wanted': 'SQL, sql, Rust', ...(hard ? { 'competencies:hardItems': 'SQL, Go', 'competencies:hardField': 'Data' } : {}) })
  expect(resumeDoc.current.content.skills).toHaveLength(1)
  expect(resumeDoc.current.content.skills[0]!.text.en).toEqual({ title: hard ? 'Data Skills' : 'Core Skills', items: hard ? ['SQL', 'Go', 'Rust'] : ['SQL', 'Rust'] })
})
it('creates each skill kind and accepts hard items without a field', () => {
  write('competencies', { 'competencies:hardItems': 'SQL', 'competencies:tools': 'Git, Docker', 'competencies:soft': 'Listening', 'competencies:languages': 'English' })
  expect(resolve(resumeDoc.current, 'en').skills.map(g => [g.title, g.items])).toEqual([['Core Skills', ['SQL']], ['Support Technical Skills', ['Git', 'Docker']], ['Soft Skills', ['Listening']], ['Languages', ['English']]])
})
it('preserves fallback skills verbatim and distinguishes language groups', () => {
  resumeDoc.current.content.skills = ['Engineering', 'Languages', 'Languages'].map((title, i) => ({ id: `g${i}`, text: { en: { title, items: [i ? ' English ' : ' SQL ', 'keep, literal'] }, id: { title: '', items: [] } } }))
  const source = JSON.stringify(resumeDoc.current.content.skills.map(g => g.text.en))
  write('competencies', { 'competencies:wanted': 'sql, Rust', 'competencies:level:g1:0': 'fluent', 'competencies:level:g2:0': 'basic' }, 'id')
  expect(resumeDoc.current.content.skills.map(g => g.text.id.items)).toEqual([[' SQL ', 'keep, literal', 'Rust'], [' English  (fluent)', 'keep, literal'], [' English  (basic)', 'keep, literal']])
  expect(resumeDoc.current.content.skills.every(g => g.text.id.title === '')).toBe(true)
  expect(JSON.stringify(resumeDoc.current.content.skills.map(g => g.text.en))).toBe(source)
})
it('preserves and reorders fallback bullets, appends achievement and goal alone', () => {
  const id = add('experience'); const j = resumeDoc.current.content.experience[0]!
  j.text.en.bullets = [' first  ', ' second ']; j.text.en.team = 'Untouched'
  write(`experience:${id}`, { [`experience:${id}:core`]: '1', [`experience:${id}:achievement`]: '20 sales', [`experience:${id}:goal`]: 'growth', [`experience:${id}:location`]: 'Solo' }, 'id')
  expect(j.text.en.bullets).toEqual([' first  ', ' second '])
  expect(resumeDoc.current.content.experience[0]!.text.id).toMatchObject({ team: '', bullets: [' second ', ' first  ', 'Berkontribusi dalam pencapaian 20 sales.', 'Bekerja untuk mencapai growth.'], location: 'Solo' })
})
it.each(['experience', 'education'] as const)('fills missing %s fields and gates dates', kind => {
  const id = add(kind); const prefix = `${kind}:${id}`
  write(kind === 'experience' ? prefix : kind, { [`${prefix}:start`]: '2020-01', [`${prefix}:end`]: '2022-02', [`${prefix}:current`]: 'no', ...Object.fromEntries((kind === 'experience' ? ['company', 'role'] : ['school', 'degree', 'field', 'gpa']).map(k => [`${prefix}:${k}`, k])) })
  expect(resumeDoc.current.content[kind][0]!.dates).toEqual({ start: '2020-01', end: '2022-02', current: false })
  for (const k of kind === 'experience' ? ['company', 'role'] : ['school', 'degree', 'field', 'gpa']) expect(readDraft(resumeDoc.current, { owner: 'item', section: kind, id, key: k }, 'en')).toBe(k)
})
it.each(['yes', '', 'bogus'])('ignores hidden end with current %s and preserves start', current => {
  const id = add('experience'); resumeDoc.current.content.experience[0]!.dates.start = '2021-03'
  write(`experience:${id}`, { [`experience:${id}:current`]: current, [`experience:${id}:end`]: '2023-02' })
  expect(resumeDoc.current.content.experience[0]!.dates).toEqual(current === 'yes' ? { start: '2021-03', end: null, current: true } : { start: '2021-03', end: null })
})
it('repairs year-only course date and fills course fields', () => {
  const id = add('certifications'); resumeDoc.current.content.certifications[0]!.date = '2024'
  write(`course:${id}`, { [`course:${id}:date`]: '2024-05', [`course:${id}:title`]: 'Course', [`course:${id}:issuer`]: 'School', [`course:${id}:topics`]: 'Topics' })
  expect(resumeDoc.current.content.certifications[0]).toMatchObject({ date: '2024-05', text: { en: { title: 'Course', issuer: 'School', description: 'Topics' } } })
})
it.each(['experience', 'education', 'course', 'references'] as const)('creates one %s entry with new namespace only after answered confirmation', chapter => {
  const kind = chapter === 'course' ? 'certifications' : chapter
  const slot = { experience: 'role', education: 'school', course: 'title', references: 'name' }[chapter]
  const a = { [`${chapter}:start`]: 'yes', [`${chapter}:new:${slot}`]: 'Answered', [`${chapter}:new:current`]: 'yes', [`${chapter}:new:end`]: '2022-01' }
  write(chapter, a, 'id')
  expect(resumeDoc.current.content[kind]).toHaveLength(1)
  const item = resumeDoc.current.content[kind][0]!
  expect(item.id).not.toBe('new')
  expect(readDraft(resumeDoc.current, { owner: 'item', section: kind, id: item.id, key: slot }, 'id')).toBe('Answered')
  expect(readDraft(resumeDoc.current, { owner: 'item', section: kind, id: item.id, key: slot }, 'en')).toBe('')
})
it.each(['no', '', 'yes'])('does not create from hidden/empty blanks, confirm %s', confirm => {
  expect(write('experience', { 'experience:start': confirm, 'experience:new:role': confirm === 'yes' ? ' ' : 'hidden', 'experience:new:current': 'yes', 'experience:new:end': '2020-01' })).toEqual([])
})
it('fills reference person fields; supervisor is a no-op', () => {
  const id = add('references')
  write('references', Object.fromEntries(['name', 'position', 'phone', 'email'].map(k => [`references:${id}:${k}`, k])))
  expect(resumeDoc.current.content.references[0]).toMatchObject({ phone: 'phone', email: 'email', text: { en: { name: 'name', position: 'position' } } })
  expect(write('references', { [`references:${id}:supervisor`]: 'yes' })).toEqual([])
})
it('sorts dated jobs stably while retaining undated positions', () => {
  resumeDoc.current.content.experience = ['2020-01', '', '2024-01', '2024-01'].map((start, i) => ({ ...getSectionModule('experience').emptyItem(), id: `j${i}`, dates: { start, end: null } })) as typeof resumeDoc.current.content.experience
  expect(write('experience:j0', { 'experience:j0:order': 'yes' })).toEqual([])
  expect(resumeDoc.current.content.experience.map(j => j.id)).toEqual(['j2', 'j1', 'j3', 'j0'])
})
it('ignores unknown, empty, invalid choices and missing targets', () => {
  expect(write('headline', { 'headline:secondary': ' ', unknown: 'x' })).toEqual([])
  const id = add('experience'); const p = buildStory(resumeDoc.current, 'en').find(p => p.id === `experience:${id}`)!
  resumeDoc.current.content.experience = []
  expect(applyPage(p, { [`experience:${id}:role`]: 'Lost', [`experience:${id}:current`]: 'yes' }, 'en')).toEqual([])
  expect(resumeDoc.canUndo).toBe(false)
})
it('does not overwrite fields filled since page creation', () => {
  const id = add('education'); const p = buildStory(resumeDoc.current, 'id').find(p => p.id === 'education')!
  resumeDoc.current.content.education[0]!.text.en.school = 'Existing'
  expect(applyPage(p, { [`education:${id}:school`]: 'Stale' }, 'id')).toEqual([])
  expect(resumeDoc.current.content.education[0]!.text.id.school).toBe('')
})
it.each(['experience', 'education'] as const)('preserves existing %s end/current when filling only start', kind => {
  const id = add(kind)
  resumeDoc.current.content[kind][0]!.dates = { start: '', end: '2024-02', current: false }
  write(kind === 'experience' ? `${kind}:${id}` : kind, { [`${kind}:${id}:start`]: '2020-01' })
  expect(resumeDoc.current.content[kind][0]!.dates).toEqual({ start: '2020-01', end: '2024-02', current: false })
})
it.each(['no', 'yes'])('creates education with gated dates and current %s', current => {
  write('education', { 'education:start': 'yes', 'education:new:start': '2020-01', 'education:new:current': current, 'education:new:end': '2024-02' })
  expect(resumeDoc.current.content.education[0]!.dates).toEqual({ start: '2020-01', end: current === 'yes' ? null : '2024-02', current: current === 'yes' })
})
it('ignores invalid months, unknown answers, and blank tags without history', () => {
  expect(write('course', { 'course:start': 'yes', 'course:new:date': '2024-13' })).toEqual([])
  expect(write('competencies', { 'competencies:hardItems': ', ,', 'competencies:hardField': 'Data', 'competencies:wanted': ',' })).toEqual([])
})
it.each(['0', '99', 'banana'])('core %s is a no-op without copying fallback', core => {
  const id = add('experience'); resumeDoc.current.content.experience[0]!.text.en.bullets = ['first', 'second']
  expect(write(`experience:${id}`, { [`experience:${id}:core`]: core }, 'id')).toEqual([])
  expect(resumeDoc.current.content.experience[0]!.text.id.bullets).toEqual([])
})
it.each([['teams', '', 'Collaborating with teams.'], ['teams', 'growth', 'Collaborating with teams to achieve growth.']])('writes stakeholder sentence for %s and %s', (withAnswer, goal, expected) => {
  const id = add('experience')
  write(`experience:${id}`, { [`experience:${id}:with`]: withAnswer!, [`experience:${id}:goal`]: goal! })
  expect(resumeDoc.current.content.experience[0]!.text.en.bullets).toEqual([expected])
})
it('does not overwrite dates filled since page creation', () => {
  const id = add('experience'); const p = buildStory(resumeDoc.current, 'en').find(p => p.id === `experience:${id}`)!
  resumeDoc.current.content.experience[0]!.dates = { start: '2019-01', end: '2021-01' }
  expect(applyPage(p, { [`experience:${id}:start`]: '2020-01', [`experience:${id}:current`]: 'yes' }, 'en')).toEqual([])
  expect(resumeDoc.current.content.experience[0]!.dates).toEqual({ start: '2019-01', end: '2021-01' })
})
it('does not copy fallback for duplicate wanted skills', () => {
  const id = add('skills'); resumeDoc.current.content.skills[0]!.text.en = { title: 'Core', items: ['SQL'] }
  expect(write('competencies', { 'competencies:wanted': 'sql' }, 'id')).toEqual([])
  expect(resumeDoc.current.content.skills[0]!.id).toBe(id)
  expect(resumeDoc.current.content.skills[0]!.text.id.items).toEqual([])
})
it('ignores stale headline contact answers after fields have been filled', () => {
  const p = buildStory(resumeDoc.current, 'en').find(p => p.id === 'headline')!
  resumeDoc.current.contact.email = 'new@example.com'
  expect(applyPage(p, { 'headline:email': 'old@example.com' }, 'en')).toEqual([])
  expect(resumeDoc.current.contact.email).toBe('new@example.com')
})
it('does not reorder a stale core selection whose bullet changed', () => {
  const id = add('experience'); resumeDoc.current.content.experience[0]!.text.en.bullets = ['First', 'Second']
  const p = buildStory(resumeDoc.current, 'en').find(p => p.id === `experience:${id}`)!
  resumeDoc.current.content.experience[0]!.text.en.bullets = ['First', 'Replacement']
  expect(applyPage(p, { [`experience:${id}:core`]: '1' }, 'en')).toEqual([])
  expect(resumeDoc.current.content.experience[0]!.text.en.bullets).toEqual(['First', 'Replacement'])
})
it.each(['French', 'English (basic)'])('ignores a stale level answer when its original item is now %s', current => {
  const id = add('skills')
  const group = resumeDoc.current.content.skills[0]!
  group.text.en = { title: 'Languages', items: ['English'] }
  const page = buildStory(resumeDoc.current, 'en').find(p => p.id === 'competencies')!
  group.text.en.items[0] = current
  expect(applyPage(page, { [`competencies:level:${id}:0`]: 'fluent' }, 'en')).toEqual([])
  expect(group.text.en.items).toEqual([current])
  expect(resumeDoc.canUndo).toBe(false)
})
it.each(['experience', 'education', 'course', 'references'] as const)('does not create from a stale empty %s page', chapter => {
  const section = chapter === 'course' ? 'certifications' : chapter
  const slot = { experience: 'role', education: 'school', course: 'title', references: 'name' }[chapter]
  const page = buildStory(resumeDoc.current, 'en').find(p => p.id === chapter)!
  const existingId = add(section)
  expect(applyPage(page, { [`${chapter}:start`]: 'yes', [`${chapter}:new:${slot}`]: 'Stale answer' }, 'en')).toEqual([])
  expect(resumeDoc.current.content[section].map(item => item.id)).toEqual([existingId])
  expect(resumeDoc.canUndo).toBe(false)
})
it('preserves explicit false when a stale current choice is ignored while filling start', () => {
  const id = add('education'); const p = buildStory(resumeDoc.current, 'en').find(p => p.id === 'education')!
  resumeDoc.current.content.education[0]!.dates = { start: '', end: '2024-01', current: false }
  applyPage(p, { [`education:${id}:start`]: '2020-01', [`education:${id}:current`]: 'yes' }, 'en')
  expect(resumeDoc.current.content.education[0]!.dates).toEqual({ start: '2020-01', end: '2024-01', current: false })
})
