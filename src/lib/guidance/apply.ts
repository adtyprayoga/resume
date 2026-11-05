import { applyDraft, parseTags, readDraft, refKey, sameDraft, specFor, type DateDraft, type DraftValue, type FieldRef } from '$lib/editing/fields'
import { resolve } from '$lib/model/resolve'
import type { Locale, ResumeDocument } from '$lib/model/types'
import type { ListSectionKind } from '$lib/sections/kinds'
import { getSectionModule } from '$lib/sections/registry'
import { resumeDoc } from '$lib/state/document.svelte'
import { groupKind, monthMissing, orderExperienceNewestFirst } from './checks'
import type { StoryPage } from './story'
import { bulletSentence, GROUP_TITLES, hardGroupTitle, summarySentence } from './templates'

export type Answers = Record<string, string>
export interface Written { ref: FieldRef; locale: Locale; value: DraftValue }

function eligibleAnswers(page: StoryPage, answers: Answers): Answers {
  const result: Answers = {}
  const revealed = (id: string) => !page.confirm?.reveals.includes(id) || answers[page.confirm.id] === 'yes'
  for (const choice of page.choices) {
    if (revealed(choice.id) && choice.options.some(o => o.value === answers[choice.id])) result[choice.id] = answers[choice.id]!
  }
  for (const blank of page.blanks) {
    if (!revealed(blank.id) || (blank.when && result[blank.when.choiceId] !== blank.when.value)) continue
    const value = answers[blank.id]?.trim()
    if (value && (blank.input !== 'month' || /^\d{4}-(0[1-9]|1[0-2])$/.test(value))) result[blank.id] = value
  }
  return result
}

export function applyPage(page: StoryPage, answers: Answers, locale: Locale): Written[] {
  const a = eligibleAnswers(page, answers)
  const changed = new Map<string, FieldRef>()
  const doc = resumeDoc.current
  const view = resolve(doc, locale)
  let staged: ResumeDocument['content'][ListSectionKind][number] | undefined
  const itemRef = (section: ListSectionKind, id: string, key: string): FieldRef => ({ owner: 'item', section, id, key })
  const effective = (ref: FieldRef): DraftValue | undefined => {
    const value = readDraft(doc, ref, locale, staged)
    return value === '' && specFor(ref).scope === 'localized' ? readDraft(doc, ref, locale === 'en' ? 'id' : 'en', staged) : value
  }
  const write = (ref: FieldRef, value: DraftValue) => {
    const before = readDraft(doc, ref, locale, staged)
    if (before === undefined) return
    applyDraft(doc, ref, locale, value, staged)
    if (!sameDraft(before, readDraft(doc, ref, locale, staged))) changed.set(refKey(ref), ref)
  }
  // Existing list strings must survive verbatim; parse only newly supplied answers.
  const writeList = (section: 'skills' | 'experience', id: string, values: string[]) => {
    const key = section === 'skills' ? 'items' : 'bullets'
    const ref = itemRef(section, id, key)
    const before = readDraft(doc, ref, locale, staged)
    if (section === 'skills') {
      const item = doc.content.skills.find(i => i.id === id)
      if (!item) return
      item.text[locale].items = values
    } else {
      const item = doc.content.experience.find(i => i.id === id)
      if (!item) return
      item.text[locale].bullets = values
    }
    if (!sameDraft(before, readDraft(doc, ref, locale, staged))) changed.set(refKey(ref), ref)
  }
  resumeDoc.change(() => {
    if (page.chapter === 'headline') {
      const parts = [a['headline:secondary'], a['headline:differentiator']].filter(Boolean)
      if (parts.length) write({ owner: 'profile', key: 'headline' }, view.profile.headline + parts.map(p => ` | ${p}`).join(''))
      if (a['headline:city']) write({ owner: 'profile', key: 'location' }, a['headline:city'])
      for (const key of ['email', 'phone', 'linkedin'] as const) if (a[`headline:${key}`] && !doc.contact[key].trim()) write({ owner: 'contact', key }, a[`headline:${key}`]!)
    } else if (page.chapter === 'summary') {
      const sentence = summarySentence({
        years: a['summary:years'] ?? '',
        field: a['summary:field'] ?? '',
        industries: parseTags(a['summary:industries'] ?? ''),
        expertise: parseTags(a['summary:expertise'] ?? ''),
        audience: a['summary:audience'] ?? '',
        strengths: parseTags(a['summary:strengths'] ?? ''),
      }, locale)
      if (sentence) write({ owner: 'profile', key: 'summary' }, sentence + (view.profile.summary ? ` ${view.profile.summary}` : ''))
    } else if (page.chapter === 'competencies') {
      const createGroup = (title: string, items: string[]) => {
        const item = getSectionModule('skills').emptyItem()
        resumeDoc.addItem('skills', item)
        write(itemRef('skills', item.id, 'title'), title)
        writeList('skills', item.id, items)
        return item.id
      }
      const hard = parseTags(a['competencies:hardItems'] ?? '')
      let hardId: string | undefined
      if (hard.length) hardId = createGroup(a['competencies:hardField'] ? hardGroupTitle(a['competencies:hardField'], locale) : GROUP_TITLES.core[locale], hard)
      for (const kind of ['tools', 'soft', 'languages'] as const) {
        const items = parseTags(a[`competencies:${kind}`] ?? '')
        if (items.length) createGroup(GROUP_TITLES[kind][locale], items)
      }
      for (const group of view.skills) {
        const items = group.items.map((item, i) => {
          const id = `competencies:level:${group.id}:${i}`
          const original = page.blanks.find(blank => blank.id === id)?.label[locale]
          return a[id] && original === item ? `${item} (${a[id]})` : item
        })
        if (items.some((item, i) => item !== group.items[i])) writeList('skills', group.id, items)
      }
      const wanted = parseTags(a['competencies:wanted'] ?? '')
      if (wanted.length) {
        const target = hardId ?? view.skills.find(g => groupKind(g.title) === 'hard' && g.title.trim() && g.items.some(i => i.trim()))?.id
        const items = target ? [...resolve(doc, locale).skills.find(g => g.id === target)!.items] : []
        for (const item of wanted) if (!items.some(i => i.trim().toLowerCase() === item.toLowerCase())) items.push(item)
        if (target) {
          const existing = resolve(doc, locale).skills.find(g => g.id === target)!.items
          if (items.length !== existing.length) writeList('skills', target, items)
        } else createGroup(GROUP_TITLES.core[locale], items)
      }
    } else if (page.chapter !== 'ending') {
      const chapter = page.chapter
      const section = chapter === 'course' ? 'certifications' : chapter
      let newId: string | undefined
      if (page.confirm && doc.content[section].length === 0 && answers[page.confirm.id] === 'yes' && page.blanks.some(b => a[b.id])) {
        staged = getSectionModule(section).emptyItem() as NonNullable<typeof staged>
        newId = staged.id
      }
      const ids = new Set([...page.blanks, ...page.choices].map(control => control.id.slice(chapter.length + 1, control.id.lastIndexOf(':'))))
      for (const controlId of ids) {
        const id = controlId === 'new' && page.confirm ? newId : controlId
        if (!id || (staged?.id !== id && !doc.content[section].some(i => i.id === id))) continue
        const prefix = `${chapter}:${controlId}`
        const fields = chapter === 'experience' ? ['company', 'role', 'location'] : chapter === 'education' ? ['school', 'degree', 'field', 'gpa'] : chapter === 'course' ? ['title', 'issuer', 'date', 'topics'] : ['name', 'position', 'phone', 'email']
        for (const slot of fields) {
          const value = a[`${prefix}:${slot}`]
          if (!value) continue
          const ref = itemRef(section, id, slot === 'topics' ? 'description' : slot)
          const previous = effective(ref)
          if (typeof previous === 'string' && (!previous.trim() || slot === 'location' || (slot === 'date' && monthMissing(previous)))) write(ref, value)
        }
        if (chapter === 'experience' || chapter === 'education') {
          const item = staged?.id === id && 'dates' in staged ? staged : doc.content[chapter].find(i => i.id === id)!
          const ref = itemRef(section, id, 'dates')
          const draft = readDraft(doc, ref, locale, staged) as DateDraft
          const start = a[`${prefix}:start`]
          const current = a[`${prefix}:current`]
          const end = a[`${prefix}:end`]
          const canSetCurrent = !item.dates.current && !item.dates.end
          if ((start && !draft.start.trim()) || (current && canSetCurrent)) {
            const before = { ...item.dates }
            write(ref, {
              start: start && !draft.start.trim() ? start : draft.start,
              current: canSetCurrent && current ? current === 'yes' : draft.current,
              end: canSetCurrent && current === 'no' && end ? end : draft.end,
            })
            if (canSetCurrent && current === 'no') item.dates.current = false
            else if (!(canSetCurrent && current) && before.current !== undefined) item.dates.current = before.current
            if (JSON.stringify(before) !== JSON.stringify(item.dates)) changed.set(refKey(ref), ref)
          }
        }
        if (chapter === 'experience') {
          const job = resolve(doc, locale).experience.find(j => j.id === id)
          if (!job) continue
          const bullets = [...job.bullets]
          const core = a[`${prefix}:core`]
          const selected = page.choices.find(c => c.id === `${prefix}:core`)?.options.find(o => o.value === core)
          if (core && Number(core) > 0 && Number(core) < bullets.length && selected?.label[locale] === bullets[Number(core)]) bullets.unshift(...bullets.splice(Number(core), 1))
          const achievement = bulletSentence('achievement', { achievement: a[`${prefix}:achievement`] ?? '' }, locale)
          const stakeholder = bulletSentence('stakeholder', {
            with: a[`${prefix}:with`] ?? '', goal: a[`${prefix}:goal`] ?? '',
          }, locale)
          if (achievement) bullets.push(achievement)
          if (stakeholder) bullets.push(stakeholder)
          if (JSON.stringify(bullets) !== JSON.stringify(job.bullets)) writeList('experience', id, bullets)
          if (a[`${prefix}:order`] === 'yes') doc.content.experience = orderExperienceNewestFirst(doc.content.experience)
        }
      }
      if (staged) {
        resumeDoc.addItem(section, { ...staged })
        staged = undefined
      }
    }
  })
  return [...changed.values()].map(ref => ({ ref, locale, value: readDraft(doc, ref, locale, staged)! }))
}
