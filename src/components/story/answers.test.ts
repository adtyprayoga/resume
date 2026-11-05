import { beforeEach, describe, expect, it } from 'vitest'
import { emptyDocument } from '$lib/model/document'
import { sampleDocument } from '../../data/sample'
import { resumeDoc } from '$lib/state/document.svelte'
import { applyPage, type Answers } from '$lib/guidance/apply'
import { buildStory } from '$lib/guidance/story'
import type { Locale, ResumeDocument } from '$lib/model/types'
import { visible, wasWritten } from './answers'

/** A thin resume: every enabled section is empty or half-filled, so most blanks appear. */
const thinDocument = (): ResumeDocument => {
  const doc = sampleDocument()
  for (const locale of ['en', 'id'] as Locale[]) {
    doc.profile.text[locale].summary = ''
    doc.profile.text[locale].location = ''
  }
  doc.contact.email = ''
  doc.contact.phone = ''
  doc.contact.linkedin = ''
  doc.content.skills = []
  doc.content.certifications = []
  doc.content.references = []
  for (const section of doc.sections) section.enabled = true
  for (const item of doc.content.experience) {
    for (const locale of ['en', 'id'] as Locale[]) {
      item.text[locale].location = ''
      item.text[locale].bullets = ['Ran the weekly planning meeting', 'Kept the team informed']
    }
  }
  return doc
}

const answerAll = (page: ReturnType<typeof buildStory>[number]): Answers => {
  const answers: Answers = {}
  if (page.confirm) answers[page.confirm.id] = 'yes'
  page.blanks.forEach((blank, index) => {
    answers[blank.id] = blank.input === 'month' ? '2024-05' : blank.input === 'tags' ? `Alpha${index}, Beta${index}` : `Answer ${index}`
  })
  return answers
}

describe('wasWritten counts every answered blank that a page writes', () => {
  beforeEach(() => resumeDoc.load(emptyDocument()))

  it.each(['en', 'id'] as Locale[])('on every page of a thin %s resume', (locale) => {
    resumeDoc.load(thinDocument())
    const pages = buildStory(resumeDoc.current, locale).filter((page) => page.chapter !== 'ending')
    const missed: string[] = []
    const checked = new Set<string>()
    for (const page of pages) {
      const answers = answerAll(page)
      const written = applyPage(page, answers, locale)
      for (const blank of page.blanks) {
        if (!visible(page, blank.id, answers)) continue
        checked.add(page.chapter)
        if (!wasWritten(page, blank, answers, written)) missed.push(blank.id)
      }
    }
    expect(missed).toEqual([])
    // Guards against a vacuous pass. Education is complete in the sample, so it asks nothing.
    for (const chapter of ['headline', 'summary', 'competencies', 'experience', 'course', 'references']) {
      expect(checked).toContain(chapter)
    }
  })

  it('does not count a blank left empty', () => {
    resumeDoc.load(thinDocument())
    const page = buildStory(resumeDoc.current, 'en').find((candidate) => candidate.chapter === 'headline')!
    const written = applyPage(page, {}, 'en')
    expect(page.blanks.filter((blank) => wasWritten(page, blank, {}, written))).toEqual([])
  })
})
