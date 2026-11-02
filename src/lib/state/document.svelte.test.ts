import { beforeEach, describe, expect, it } from 'vitest'
import { resumeDoc } from './document.svelte'
import { sampleDocument } from '../../data/sample'
import { emptyDocument } from '$lib/model/document'
import { validateDocument } from '$lib/model/document'

beforeEach(() => {
  resumeDoc.replace(sampleDocument())
})

describe('snapshot', () => {
  it('returns a plain object that survives structuredClone', () => {
    const snap = resumeDoc.snapshot()
    expect(() => structuredClone(snap)).not.toThrow()
  })

  it('is detached from the live document', () => {
    const snap = resumeDoc.snapshot()
    resumeDoc.current.profile.text.en.name = 'Changed'
    expect(snap.profile.text.en.name).not.toBe('Changed')
  })

  it('stays valid, so it can be exported directly', () => {
    expect(validateDocument(resumeDoc.snapshot()).ok).toBe(true)
  })
})

describe('items', () => {
  it('appends a valid empty item', () => {
    const before = resumeDoc.current.content.experience.length
    const id = resumeDoc.addItem('experience')
    expect(resumeDoc.current.content.experience).toHaveLength(before + 1)
    expect(resumeDoc.current.content.experience.at(-1)?.id).toBe(id)
    expect(validateDocument(resumeDoc.snapshot()).ok).toBe(true)
  })

  it('removes an item by id and ignores an unknown id', () => {
    const id = resumeDoc.current.content.experience[0]!.id
    resumeDoc.removeItem('experience', id)
    expect(resumeDoc.current.content.experience.some((i) => i.id === id)).toBe(false)
    expect(() => resumeDoc.removeItem('experience', 'nope')).not.toThrow()
  })

  it('moves an item down and back up', () => {
    const [first, second] = resumeDoc.current.content.experience
    resumeDoc.moveItem('experience', first!.id, 1)
    expect(resumeDoc.current.content.experience[0]?.id).toBe(second!.id)
    resumeDoc.moveItem('experience', first!.id, -1)
    expect(resumeDoc.current.content.experience[0]?.id).toBe(first!.id)
  })

  it('clamps a move at the ends instead of wrapping', () => {
    const ids = resumeDoc.current.content.experience.map((i) => i.id)
    resumeDoc.moveItem('experience', ids[0]!, -5)
    expect(resumeDoc.current.content.experience.map((i) => i.id)).toEqual(ids)
    resumeDoc.moveItem('experience', ids.at(-1)!, 5)
    expect(resumeDoc.current.content.experience.map((i) => i.id)).toEqual(ids)
  })
})

describe('sections', () => {
  it('toggles a section without reordering it', () => {
    const order = resumeDoc.current.sections.map((s) => s.kind)
    resumeDoc.setSectionEnabled('awards', false)
    expect(resumeDoc.current.sections.find((s) => s.kind === 'awards')?.enabled).toBe(false)
    expect(resumeDoc.current.sections.map((s) => s.kind)).toEqual(order)
  })

  it('moves a section and clamps at the ends', () => {
    const [first, second] = resumeDoc.current.sections.map((s) => s.kind)
    resumeDoc.moveSection(first!, 1)
    expect(resumeDoc.current.sections[0]?.kind).toBe(second)
    resumeDoc.moveSection(second!, -3)
    expect(resumeDoc.current.sections[0]?.kind).toBe(second)
  })
})

describe('copyLocale', () => {
  it('overwrites the target locale text and leaves the source alone', () => {
    resumeDoc.copyLocale('en', 'id')
    expect(resumeDoc.current.profile.text.id.headline).toBe(
      resumeDoc.current.profile.text.en.headline,
    )
    expect(resumeDoc.current.content.experience[0]!.text.id.role).toBe(
      resumeDoc.current.content.experience[0]!.text.en.role,
    )
  })

  it('deep-copies so later edits do not bleed across locales', () => {
    resumeDoc.copyLocale('en', 'id')
    resumeDoc.current.content.experience[0]!.text.id.bullets[0] = 'Diubah'
    expect(resumeDoc.current.content.experience[0]!.text.en.bullets[0]).not.toBe('Diubah')
  })

  it('leaves shared fields untouched', () => {
    const company = resumeDoc.current.content.experience[0]!.company
    resumeDoc.copyLocale('en', 'id')
    expect(resumeDoc.current.content.experience[0]!.company).toBe(company)
  })

  it('is a no-op when source and target match', () => {
    const before = resumeDoc.snapshot()
    resumeDoc.copyLocale('en', 'en')
    expect(resumeDoc.snapshot()).toEqual(before)
  })
})

describe('untranslatedCount', () => {
  it('is zero for the fully translated sample', () => {
    expect(resumeDoc.untranslatedCount('id')).toBe(0)
    expect(resumeDoc.untranslatedCount('en')).toBe(0)
  })

  it('counts a field blank in one locale but filled in the other', () => {
    resumeDoc.current.profile.text.id.summary = ''
    resumeDoc.current.content.experience[0]!.text.id.role = ''
    expect(resumeDoc.untranslatedCount('id')).toBe(2)
    expect(resumeDoc.untranslatedCount('en')).toBe(0)
  })

  it('does not count a field blank in both locales', () => {
    resumeDoc.replace(emptyDocument())
    expect(resumeDoc.untranslatedCount('id')).toBe(0)
  })
})
