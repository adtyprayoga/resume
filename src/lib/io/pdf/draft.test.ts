import { describe, expect, it } from 'vitest'
import { emptyDocument } from '$lib/model/document'
import type { Proposal } from './mapper'
import { addEntry, changeLocale, createReview, finalizeReview, removeEntry, sourceLines } from './draft'
import type { Extraction } from './types'

const extraction: Extraction = {
  contract_version: 1,
  pages: 1,
  blocks: [
    { id: 'b1', page: 1, label: 'title', group: null, text: 'Jane Doe', bbox: null },
    { id: 'b2', page: 1, label: 'section_header', group: null, text: 'Engineer at Foo', bbox: null },
    { id: 'b3', page: 1, label: 'list_item', group: 'g1', text: 'Did a thing', bbox: null },
  ],
}

const proposal = (): Proposal => {
  const document = emptyDocument()
  document.profile.text.en.name = 'Jane Doe'
  document.contact.website = 'https://jane.dev'
  document.content.experience.push({ id: 'exp_1', company: 'Foo', dates: { start: '2019', end: null }, text: { en: { role: 'Engineer', team: '', location: '', bullets: ['Did a thing'] }, id: { role: '', team: '', location: '', bullets: [] } } })
  return {
    locale: 'en',
    document,
    refs: [
      { path: 'profile.name', blocks: ['b1'] },
      { path: 'experience.exp_1.company', blocks: ['b2'] },
      { path: 'experience.exp_1.bullets', blocks: ['b3'] },
    ],
    warnings: [],
    unmatched: [],
  }
}

describe('review draft', () => {
  it('copies the proposal so edits never reach it', () => {
    const source = proposal()
    const draft = createReview(source)
    draft.document.profile.text.en.name = 'Edited'
    expect(source.document.profile.text.en.name).toBe('Jane Doe')
    expect(draft.locale).toBe('en')
    expect(draft.acknowledged).toBe(false)
  })

  it('moves text to the chosen source language and blanks the other', () => {
    const draft = createReview(proposal())
    changeLocale(draft, 'id')
    expect(draft.locale).toBe('id')
    expect(draft.document.profile.text.id.name).toBe('Jane Doe')
    expect(draft.document.profile.text.en.name).toBe('')
    expect(draft.document.content.experience[0]!.text.id).toMatchObject({ role: 'Engineer', bullets: ['Did a thing'] })
    expect(draft.document.content.experience[0]!.text.en).toMatchObject({ role: '', bullets: [] })
    expect(draft.document.content.experience[0]!.company).toBe('Foo')
  })

  it('adds and removes entries', () => {
    const draft = createReview(proposal())
    const id = addEntry(draft, 'awards')
    expect(draft.document.content.awards.map((a) => a.id)).toEqual([id])
    removeEntry(draft, 'experience', 'exp_1')
    expect(draft.document.content.experience).toEqual([])
  })

  it('requires acknowledging unmatched text before it finalises', () => {
    const draft = createReview(proposal())
    expect(finalizeReview(draft, 2)).toMatchObject({ ok: false, messageKey: 'pdf.review.ackRequired' })
    draft.acknowledged = true
    expect(finalizeReview(draft, 2).ok).toBe(true)
    expect(finalizeReview(createReview(proposal()), 0).ok).toBe(true)
  })

  it('finalises through the document validator, which sanitises links', () => {
    const draft = createReview(proposal())
    draft.document.contact.website = 'javascript:alert(1)'
    const result = finalizeReview(draft, 0)
    expect(result.ok && result.value.contact.website).toBe('')
    expect(result.ok && result.value.profile.text.en.name).toBe('Jane Doe')
  })

  it('lists the source text behind an entry in reading order', () => {
    expect(sourceLines(proposal(), extraction, 'experience.exp_1.')).toEqual(['Engineer at Foo', 'Did a thing'])
    expect(sourceLines(proposal(), extraction, 'experience.missing.')).toEqual([])
  })
})
