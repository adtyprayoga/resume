import type { DateRange, Locale, ResolvedResume, ResumeDocument } from '$lib/model/types'
import { resolve } from '$lib/model/resolve'
import type { ListSectionKind } from '$lib/sections/kinds'
import { groupKind, hasNumber, headlineParts, isNewestFirst, isShortSummary, languageWithoutLevel, looksLikeAddress, monthMissing } from './checks'
import { joinList, NARRATION, STORY, STORY_LABELS as LABELS } from './templates'

export type Chapter = 'headline' | 'summary' | 'competencies' | 'experience' | 'education' | 'course' | 'references'
export type Bilingual = Record<Locale, string>
export type Segment = { kind: 'text'; text: string } | { kind: 'resume'; text: string } | { kind: 'blank'; id: string }
export interface Blank {
  id: string
  label: Bilingual
  input: 'text' | 'tags' | 'month'
  gap: boolean
  when?: { choiceId: string; value: string }
}
export interface Choice {
  id: string
  prompt: Bilingual
  options: { value: string; label: Bilingual }[]
  gap: boolean
}
export interface Confirm {
  id: string
  prompt: Bilingual
  /** Both blank and choice IDs; gated until yes, in addition to each blank's when. */
  reveals: string[]
}
interface PageContent {
  id: string
  title: Bilingual
  paragraphs: Segment[][]
  blanks: Blank[]
  choices: Choice[]
  confirm?: Confirm
}
export type StoryPage = PageContent & (
  | { chapter: Chapter; chapterNumber: number }
  | { chapter: 'ending'; chapterNumber: null }
)

const chapters: Chapter[] = ['headline', 'summary', 'competencies', 'experience', 'education', 'course', 'references']
const missing = (value: string | null) => !value?.trim()
const resume = (text: string): Segment => ({ kind: 'resume', text })

function page(chapter: Chapter, id: string = chapter): StoryPage {
  return { id, chapter, chapterNumber: chapters.indexOf(chapter) + 1, title: NARRATION[`${chapter}Title`], paragraphs: [], blanks: [], choices: [] }
}

/** Substitute whole segments so user text is never interpreted as a template. */
function paragraph(p: StoryPage, template: Bilingual, locale: Locale, values: Record<string, Segment | Segment[]> = {}) {
  const segments: Segment[] = []
  for (const part of template[locale].split(/(\{\w+\})/)) {
    if (!part) continue
    if (part.startsWith('{') && part.endsWith('}')) {
      const value = values[part.slice(1, -1)]
      if (value) segments.push(...(Array.isArray(value) ? value : [value]))
    } else segments.push({ kind: 'text', text: part })
  }
  p.paragraphs.push(segments)
}

function blank(p: StoryPage, prefix: string, slot: string, label: Bilingual, input: Blank['input'] = 'text', gap = true): Segment {
  const id = `${prefix}:${slot}`
  p.blanks.push({ id, label, input, gap })
  return { kind: 'blank', id }
}

function field(p: StoryPage, prefix: string, slot: keyof typeof LABELS, value: string, input: Blank['input'] = 'text'): Segment {
  return missing(value) ? blank(p, prefix, slot, LABELS[slot], input) : resume(value)
}

function yesNo(p: StoryPage, id: string, prompt: Bilingual, gap: boolean) {
  p.choices.push({ id, prompt, gap, options: ['yes', 'no'].map(value => ({ value, label: LABELS[value as 'yes' | 'no'] })) })
}

function dates(p: StoryPage, prefix: string, value: DateRange, locale: Locale) {
  if (value.current) paragraph(p, STORY.current, locale)
  else if (!missing(value.end)) paragraph(p, STORY.ended, locale, { end: resume(value.end!) })
  else {
    const choiceId = `${prefix}:current`
    yesNo(p, choiceId, LABELS.current, true)
    const end = blank(p, prefix, 'end', LABELS.end, 'month')
    p.blanks[p.blanks.length - 1]!.when = { choiceId, value: 'no' }
    paragraph(p, STORY.end, locale, { end })
  }
}

function confirm(p: StoryPage, chapter: 'experience' | 'education' | 'course' | 'references') {
  p.confirm = { id: `${p.id}:start`, prompt: LABELS[chapter], reveals: [...p.blanks.map(b => b.id), ...p.choices.map(c => c.id)] }
}

function headline(view: ResolvedResume, locale: Locale): StoryPage {
  const p = page('headline')
  const profile = view.profile
  paragraph(p, NARRATION.opening, locale, { headlineFirstPart: resume(profile.headline.split('|')[0]!.trim()), name: resume(profile.name) })
  paragraph(p, STORY.identity, locale, { headline: resume(profile.headline) })
  const parts = headlineParts(profile.headline)
  if (parts.length < 2) paragraph(p, STORY.secondary, locale, { secondary: blank(p, p.id, 'secondary', LABELS.secondary) })
  if (parts.length < 3) paragraph(p, STORY.differentiator, locale, { differentiator: blank(p, p.id, 'differentiator', LABELS.differentiator) })
  if (looksLikeAddress(profile.location)) paragraph(p, STORY.address, locale, { location: resume(profile.location), city: blank(p, p.id, 'city', LABELS.city) })
  else paragraph(p, STORY.city, locale, { city: field(p, p.id, 'city', profile.location) })
  paragraph(p, STORY.contact, locale, {
    email: field(p, p.id, 'email', view.contact.email), phone: field(p, p.id, 'phone', view.contact.phone), linkedin: field(p, p.id, 'linkedin', view.contact.linkedin),
  })
  if (missing(view.contact.avatar)) paragraph(p, STORY.photo, locale)
  return p
}

function summary(view: ResolvedResume, locale: Locale): StoryPage {
  const p = page('summary')
  const text = view.profile.summary
  if (!missing(text)) paragraph(p, STORY.summary, locale, { summary: resume(text) })
  const short = isShortSummary(text)
  if (short || !hasNumber(text)) paragraph(p, STORY.yearsField, locale, {
    years: blank(p, p.id, 'years', LABELS.years), field: blank(p, p.id, 'field', LABELS.field),
  })
  if (short) paragraph(p, STORY.summaryMore, locale, {
    industries: blank(p, p.id, 'industries', LABELS.industries, 'tags'), expertise: blank(p, p.id, 'expertise', LABELS.expertise, 'tags'),
    audience: blank(p, p.id, 'audience', LABELS.audience), strengths: blank(p, p.id, 'strengths', LABELS.strengths, 'tags'),
  })
  return p
}

function competencies(view: ResolvedResume, locale: Locale): StoryPage {
  const p = page('competencies')
  const populated = view.skills.filter(group => !missing(group.title) && group.items.some(item => !missing(item)))
  for (const group of populated) {
    const items = joinList(group.items.flatMap((item, index) => missing(item) ? [] : [`{${index}}`]), locale)
      .split(/\{(\d+)\}/).map((part, index): Segment =>
        index % 2 ? resume(group.items[Number(part)]!) : { kind: 'text', text: part },
      )
    paragraph(p, STORY.skillGroup, locale, { title: resume(group.title), items })
  }
  const kinds = new Set(populated.map(group => groupKind(group.title)))
  if (!kinds.has('hard')) paragraph(p, STORY.hard, locale, {
    hardField: blank(p, p.id, 'hardField', LABELS.hardField), hardItems: blank(p, p.id, 'hardItems', LABELS.hardItems, 'tags'),
  })
  for (const kind of ['tools', 'soft', 'languages'] as const) {
    if (!kinds.has(kind)) paragraph(p, STORY[kind], locale, { [kind]: blank(p, p.id, kind, LABELS[kind], 'tags') })
  }
  for (const group of populated.filter(group => groupKind(group.title) === 'languages')) {
    group.items.forEach((item, index) => {
      if (!missing(item) && languageWithoutLevel(item)) paragraph(p, STORY.level, locale, {
        language: resume(item), level: blank(p, p.id, `level:${group.id}:${index}`, { en: item, id: item }),
      })
    })
  }
  paragraph(p, STORY.wanted, locale, { wanted: blank(p, p.id, 'wanted', LABELS.wanted, 'tags', false) })
  return p
}

function experience(view: ResolvedResume, doc: ResumeDocument, locale: Locale): StoryPage[] {
  const empty = view.experience.length === 0
  const items = empty ? [{ id: 'new', company: '', role: '', location: '', team: '', bullets: [], dates: { start: '', end: null } }] : view.experience
  return items.map((item, index) => {
    const p = page('experience', empty ? 'experience' : `experience:${item.id}`)
    const prefix = empty ? 'experience:new' : p.id
    const company = field(p, prefix, 'company', item.company)
    const role = field(p, prefix, 'role', item.role)
    const address = looksLikeAddress(item.location)
    const location = address ? resume(item.location) : field(p, prefix, 'location', item.location)
    paragraph(p, STORY.job, locale, { company, role, location, start: field(p, prefix, 'start', item.dates.start, 'month') })
    if (address) paragraph(p, STORY.address, locale, { location: resume(item.location), city: blank(p, prefix, 'location', LABELS.location) })
    dates(p, prefix, item.dates, locale)
    if (!empty) {
      if (!missing(item.team)) paragraph(p, STORY.team, locale, { team: resume(item.team) })
      for (const bullet of item.bullets) paragraph(p, STORY.duty, locale, { bullet: resume(bullet) })
      if (!item.bullets.some(hasNumber)) paragraph(p, STORY.achievement, locale, { achievement: blank(p, prefix, 'achievement', LABELS.achievement) })
      paragraph(p, STORY.collaboration, locale, { with: blank(p, prefix, 'with', LABELS.with, 'text', false), goal: blank(p, prefix, 'goal', LABELS.goal, 'text', false) })
      if (item.bullets.length >= 2) p.choices.push({ id: `${prefix}:core`, prompt: LABELS.core, gap: false, options: item.bullets.map((bullet, i) => ({ value: String(i), label: { en: bullet, id: bullet } })) })
      if (index === 0 && !isNewestFirst(doc.content.experience)) yesNo(p, `${prefix}:order`, LABELS.order, true)
    } else confirm(p, 'experience')
    return p
  })
}

function education(view: ResolvedResume, locale: Locale): StoryPage {
  const p = page('education')
  const empty = view.education.length === 0
  const items = empty ? [{ id: 'new', school: '', degree: '', field: '', gpa: '', description: '', dates: { start: '', end: null } }] : view.education
  for (const item of items) {
    const prefix = `education:${item.id}`
    const school = field(p, prefix, 'school', item.school)
    const degree = field(p, prefix, 'degree', item.degree)
    const subject = field(p, prefix, 'field', item.field)
    const gpa = field(p, prefix, 'gpa', item.gpa)
    paragraph(p, STORY.education, locale, { school, degree, field: subject, gpa, start: field(p, prefix, 'start', item.dates.start, 'month') })
    dates(p, prefix, item.dates, locale)
    if (!missing(item.description)) paragraph(p, STORY.detail, locale, { description: resume(item.description) })
  }
  if (empty) confirm(p, 'education')
  return p
}

function courses(view: ResolvedResume, locale: Locale): StoryPage[] {
  const empty = view.certifications.length === 0
  const items = empty ? [{ id: 'new', title: '', issuer: '', date: '', description: '' }] : view.certifications
  return items.map(item => {
    const p = page('course', empty ? 'course' : `course:${item.id}`)
    const prefix = empty ? 'course:new' : p.id
    const title = field(p, prefix, 'title', item.title)
    const issuer = field(p, prefix, 'issuer', item.issuer)
    paragraph(p, STORY.course, locale, { title, issuer, date: field(p, prefix, 'date', item.date, 'month') })
    if (monthMissing(item.date)) paragraph(p, STORY.courseDate, locale, { date: resume(item.date), month: blank(p, prefix, 'date', LABELS.date, 'month') })
    if (missing(item.description)) paragraph(p, STORY.topics, locale, { topics: blank(p, prefix, 'topics', LABELS.topics, 'text', false) })
    else paragraph(p, STORY.detail, locale, { description: resume(item.description) })
    if (empty) confirm(p, 'course')
    return p
  })
}

function references(view: ResolvedResume, locale: Locale): StoryPage {
  const p = page('references')
  const empty = view.references.length === 0
  const items = empty ? [{ id: 'new', name: '', position: '', phone: '', email: '', note: '' }] : view.references
  for (const item of items) {
    const prefix = `references:${item.id}`
    if (!missing(item.note)) paragraph(p, STORY.note, locale, { note: resume(item.note) })
    if (missing(item.name) && !missing(item.note)) continue
    paragraph(p, STORY.reference, locale, {
      name: field(p, prefix, 'name', item.name), position: field(p, prefix, 'position', item.position),
      phone: field(p, prefix, 'phone', item.phone), email: field(p, prefix, 'email', item.email),
    })
    if (!empty) yesNo(p, `${prefix}:supervisor`, LABELS.supervisor, false)
  }
  if (empty) confirm(p, 'references')
  return p
}

export function buildStory(doc: ResumeDocument, locale: Locale): StoryPage[] {
  const view = resolve(doc, locale)
  const enabled = (kind: ListSectionKind) => doc.sections.some(section => section.kind === kind && section.enabled)
  const pages = [headline(view, locale), summary(view, locale)]
  if (enabled('skills')) pages.push(competencies(view, locale))
  if (enabled('experience')) pages.push(...experience(view, doc, locale))
  if (enabled('education')) pages.push(education(view, locale))
  if (enabled('certifications')) pages.push(...courses(view, locale))
  if (enabled('references')) pages.push(references(view, locale))
  const ending: StoryPage = { id: 'ending', chapter: 'ending', chapterNumber: null, title: LABELS.ending, paragraphs: [], blanks: [], choices: [] }
  paragraph(ending, NARRATION.ending, locale, { name: resume(view.profile.name) })
  pages.push(ending)
  return pages
}

export function gapIds(doc: ResumeDocument, locale: Locale): string[] {
  return buildStory(doc, locale).flatMap(p => [
    ...(p.confirm ? [p.confirm.id] : []),
    ...p.blanks.filter(b => b.gap).map(b => b.id),
    ...p.choices.filter(c => c.gap).map(c => c.id),
  ])
}
