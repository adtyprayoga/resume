import { describe, expect, it } from 'vitest'
import { emptyDocument } from '$lib/model/document'
import type { Locale, ResumeDocument } from '$lib/model/types'
import { sampleDocument } from '../../data/sample'
import { buildStory } from './story'
import { tipFor } from './tips'

/** Every enabled section empty: each chapter asks its opening question and reveals all its blanks. */
const emptyStory = (): ResumeDocument => {
  const doc = emptyDocument()
  doc.profile.text.en.name = 'Dewi'
  doc.profile.text.en.headline = 'Trainer'
  for (const section of doc.sections) section.enabled = true
  return doc
}

/** Filled but thin: the per-entry blanks appear. */
const thinStory = (): ResumeDocument => {
  const doc = sampleDocument()
  doc.profile.text.en.summary = ''
  doc.profile.text.en.location = ''
  doc.contact.email = ''
  doc.contact.phone = ''
  doc.contact.linkedin = ''
  doc.content.skills = [{ id: 'lang', text: { en: { title: 'Languages', items: ['English'] }, id: { title: 'Bahasa', items: ['Inggris'] } } }]
  for (const item of doc.content.experience) item.text.en.bullets = ['Ran planning']
  for (const item of doc.content.education) { item.gpa = ''; item.dates = { start: '', end: null } }
  for (const section of doc.sections) section.enabled = true
  return doc
}

describe('tipFor', () => {
  it.each(['en', 'id'] as Locale[])('has a %s tip with a lesson and an example for every blank the story can ask', (locale) => {
    const missing: string[] = []
    for (const doc of [emptyStory(), thinStory()]) {
      for (const page of buildStory(doc, 'en')) {
        for (const blank of page.blanks) {
          const tip = tipFor(page.chapter, blank.id)
          if (!tip?.text[locale]?.trim() || !tip.example[locale]?.trim()) missing.push(`${page.chapter}/${blank.id}`)
        }
      }
    }
    expect(missing).toEqual([])
  })

  it('tells a summary field apart from a field of study, and a contact phone from a referee phone', () => {
    expect(tipFor('summary', 'summary:field')!.text.en).not.toBe(tipFor('education', 'education:a:field')!.text.en)
    expect(tipFor('headline', 'headline:phone')!.text.en).not.toBe(tipFor('references', 'references:r:phone')!.text.en)
  })

  it('finds the language-level tip from its numbered id', () => {
    expect(tipFor('competencies', 'competencies:level:lang:2')!.example.en).toMatch(/IELTS/)
  })

  it('keeps the guide lessons: numbers sell, city only, credible providers', () => {
    expect(tipFor('summary', 'summary:years')!.text.en).toMatch(/number/i)
    expect(tipFor('headline', 'headline:city')!.text.en).toMatch(/city/i)
    expect(tipFor('course', 'course:c:issuer')!.text.en).toMatch(/credible/i)
  })
})
