import { beforeEach, describe, expect, it } from 'vitest'
import { sampleDocument } from '../../data/sample'
import { type FieldRef } from '$lib/editing/fields'
import { editing } from './editing.svelte'
import { resumeDoc } from './document.svelte'
import { prefs } from './preferences.svelte'
import { storyHighlights } from './storyHighlights.svelte'

const summary: FieldRef = { owner: 'profile', key: 'summary' }
const written = (locale: 'en' | 'id') => [{ ref: summary, locale, value: resumeDoc.current.profile.text[locale].summary }]

beforeEach(() => {
  editing.reset()
  resumeDoc.load(sampleDocument())
  storyHighlights.reset()
  prefs.documentLocale = 'en'
})

describe('story highlights', () => {
  it('adds and clears marks for the selected language', () => {
    storyHighlights.add(written('en'))
    expect(storyHighlights.isHighlighted(summary)).toBe(true)
    expect(storyHighlights.count).toBe(1)
    storyHighlights.clear()
    expect(storyHighlights.count).toBe(0)
  })

  it('invalidates synchronously across A→B→A commits through editing.commit', () => {
    storyHighlights.add(written('en'))
    editing.enter()
    editing.begin({ kind: 'field', ref: summary })
    editing.setDraft('profile.summary', 'B')
    editing.commit()
    expect(storyHighlights.isHighlighted(summary)).toBe(false)
    editing.begin({ kind: 'field', ref: summary })
    editing.setDraft('profile.summary', sampleDocument().profile.text.en.summary)
    editing.commit()
    expect(storyHighlights.isHighlighted(summary)).toBe(false)
  })

  it('keeps unrelated marks and invalidates on undo and redo', () => {
    storyHighlights.add(written('en'))
    resumeDoc.change(() => { resumeDoc.current.profile.text.en.headline = 'Other' })
    expect(storyHighlights.isHighlighted(summary)).toBe(true)
    resumeDoc.change(() => { resumeDoc.current.profile.text.en.summary = 'Changed' })
    storyHighlights.add(written('en'))
    resumeDoc.undo()
    expect(storyHighlights.isHighlighted(summary)).toBe(false)
    storyHighlights.add(written('en'))
    resumeDoc.redo()
    expect(storyHighlights.isHighlighted(summary)).toBe(false)
  })

  it('hides other-language marks and tracks each locale separately', () => {
    storyHighlights.add(written('en'))
    prefs.documentLocale = 'id'
    expect(storyHighlights.isHighlighted(summary)).toBe(false)
    storyHighlights.add(written('id'))
    expect(storyHighlights.count).toBe(1)
    resumeDoc.change(() => { resumeDoc.current.profile.text.en.summary = 'Changed' })
    expect(storyHighlights.isHighlighted(summary)).toBe(true)
    prefs.documentLocale = 'en'
    expect(storyHighlights.isHighlighted(summary)).toBe(false)
  })

  it.each(['replace', 'load'] as const)('clears on equal-content %s', (method) => {
    storyHighlights.add(written('en'))
    resumeDoc[method](resumeDoc.snapshot())
    expect(storyHighlights.count).toBe(0)
    expect(storyHighlights.isHighlighted(summary)).toBe(false)
  })
})
