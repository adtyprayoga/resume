import { beforeEach, describe, expect, it } from 'vitest'
import { editing } from './editing.svelte'
import { resumeDoc } from './document.svelte'
import { prefs } from './preferences.svelte'
import { sampleDocument } from '../../data/sample'
import { defaultTheme } from '$lib/themes/index'
import type { FieldRef } from '$lib/editing/fields'

const name: FieldRef = { owner: 'profile', key: 'name' }
const role: FieldRef = { owner: 'item', section: 'experience', id: 'exp_sample_1', key: 'role' }

beforeEach(() => {
  editing.reset()
  resumeDoc.load(sampleDocument())
  prefs.uiLocale = 'en'
  prefs.documentLocale = 'en'
  prefs.themeKey = defaultTheme.key
})

describe('mode', () => {
  it('starts in Preview and enters Edit explicitly', () => {
    expect(editing.mode).toBe('preview')
    editing.enter()
    expect(editing.mode).toBe('edit')
  })

  it('opens nothing while previewing', () => {
    expect(editing.begin({ kind: 'field', ref: name })).toBe(false)
    expect(editing.active).toBeNull()
  })

  it('commits the active edit when Done returns to Preview', () => {
    editing.enter()
    editing.begin({ kind: 'field', ref: name })
    editing.setDraft('profile.name', 'Done Name')
    editing.finish()
    expect(editing.mode).toBe('preview')
    expect(editing.active).toBeNull()
    expect(resumeDoc.current.profile.text.en.name).toBe('Done Name')
  })
})

describe('apply and cancel', () => {
  beforeEach(() => editing.enter())

  it('keeps the draft out of the document until it is applied', () => {
    editing.begin({ kind: 'field', ref: name })
    expect(editing.active?.original['profile.name']).toBe('Aditya Prayoga')
    editing.setDraft('profile.name', 'Siti')
    expect(resumeDoc.current.profile.text.en.name).toBe('Aditya Prayoga')
    expect(editing.commit()).toBe('applied')
    expect(resumeDoc.current.profile.text.en.name).toBe('Siti')
    expect(editing.active).toBeNull()
  })

  it('restores nothing on cancel because nothing was written', () => {
    const before = JSON.stringify(resumeDoc.snapshot())
    editing.begin({ kind: 'field', ref: name })
    editing.setDraft('profile.name', 'Throwaway')
    editing.cancel()
    expect(editing.active).toBeNull()
    expect(JSON.stringify(resumeDoc.snapshot())).toBe(before)
  })

  it('reports an untouched edit as unchanged and does not rewrite the field', () => {
    resumeDoc.current.content.experience[0]!.text.en.bullets = [' padded ']
    editing.begin({ kind: 'entry', section: 'experience', id: 'exp_sample_1' })
    expect(editing.commit()).toBe('unchanged')
    expect(resumeDoc.current.content.experience[0]!.text.en.bullets).toEqual([' padded '])
  })

  it('commits the previous edit before opening another target', () => {
    editing.begin({ kind: 'field', ref: name })
    editing.setDraft('profile.name', 'First')
    editing.begin({ kind: 'field', ref: role })
    expect(resumeDoc.current.profile.text.en.name).toBe('First')
    expect(editing.active?.refs).toEqual([role])
  })

  it('edits a whole entry as one draft', () => {
    editing.begin({ kind: 'entry', section: 'experience', id: 'exp_sample_1' })
    editing.setDraft('item.experience.exp_sample_1.company', 'PT Lain')
    editing.setDraft('item.experience.exp_sample_1.bullets', 'one\ntwo')
    editing.commit()
    const item = resumeDoc.current.content.experience[0]!
    expect(item.company).toBe('PT Lain')
    expect(item.text.en.bullets).toEqual(['one', 'two'])
  })

  it('refuses a target that does not exist', () => {
    expect(editing.begin({ kind: 'field', ref: { ...role, id: 'missing' } })).toBe(false)
    expect(editing.active).toBeNull()
  })
})

describe('locale scope', () => {
  beforeEach(() => editing.enter())

  it('writes to the document locale captured when editing began', () => {
    editing.begin({ kind: 'field', ref: role })
    editing.setDraft(Object.keys(editing.active!.draft)[0]!, 'Captured')
    prefs.documentLocale = 'id'
    editing.commit()
    expect(resumeDoc.current.content.experience[0]!.text.en.role).toBe('Captured')
    expect(resumeDoc.current.content.experience[0]!.text.id.role).not.toBe('Captured')
  })

  it('commits and closes before switching the document language', () => {
    editing.begin({ kind: 'field', ref: name })
    editing.setDraft('profile.name', 'Before Switch')
    editing.setDocumentLocale('id')
    expect(editing.active).toBeNull()
    expect(prefs.documentLocale).toBe('id')
    expect(resumeDoc.current.profile.text.en.name).toBe('Before Switch')
  })

  it('commits and closes before switching layout', () => {
    editing.begin({ kind: 'field', ref: name })
    editing.setDraft('profile.name', 'Before Layout')
    editing.setLayout('ats')
    expect(editing.active).toBeNull()
    expect(prefs.themeKey).toBe('ats')
    expect(resumeDoc.current.profile.text.en.name).toBe('Before Layout')
  })

  it('keeps the raw draft when only the interface language changes', () => {
    editing.begin({ kind: 'field', ref: name })
    editing.setDraft('profile.name', 'half, typed ')
    prefs.uiLocale = 'id'
    expect(editing.active?.draft['profile.name']).toBe('half, typed ')
  })
})

describe('settings', () => {
  beforeEach(() => editing.enter())

  it('suspends the active draft without committing or discarding it', () => {
    editing.begin({ kind: 'field', ref: name })
    editing.setDraft('profile.name', 'Suspended')
    editing.suspend()
    expect(editing.suspended).toBe(true)
    expect(resumeDoc.current.profile.text.en.name).toBe('Aditya Prayoga')
    editing.resume()
    expect(editing.suspended).toBe(false)
    expect(editing.active?.draft['profile.name']).toBe('Suspended')
  })
})

describe('stale targets and document replacement', () => {
  beforeEach(() => editing.enter())

  it('discards an edit whose item was deleted', () => {
    editing.begin({ kind: 'field', ref: role })
    editing.setDraft('item.experience.exp_sample_1.role', 'Ghost')
    resumeDoc.removeItem('experience', 'exp_sample_1')
    expect(editing.commit()).toBe('stale')
    expect(JSON.stringify(resumeDoc.snapshot())).not.toContain('Ghost')
  })

  it('discards an edit begun on a document that has since been replaced', () => {
    editing.begin({ kind: 'field', ref: name })
    editing.setDraft('profile.name', 'Stale')
    resumeDoc.replace(sampleDocument())
    expect(editing.commit()).toBe('stale')
    expect(resumeDoc.current.profile.text.en.name).toBe('Aditya Prayoga')
  })

  it('drops stale sessions when told the document was replaced', () => {
    editing.begin({ kind: 'field', ref: name })
    resumeDoc.replace(sampleDocument())
    editing.discardStale()
    expect(editing.active).toBeNull()
  })

  it('keeps a live session when nothing was replaced', () => {
    editing.begin({ kind: 'field', ref: name })
    editing.discardStale()
    expect(editing.active).not.toBeNull()
  })
})

describe('staged entries', () => {
  beforeEach(() => editing.enter())

  it('adds nothing to the document until the new entry is confirmed', () => {
    const before = resumeDoc.current.content.awards.length
    editing.begin({ kind: 'new-entry', section: 'awards' })
    const titleKey = editing.active!.refs.map((ref) => ref).find((ref) => ref.key === 'title')!
    expect(resumeDoc.current.content.awards).toHaveLength(before)
    editing.setDraft(`item.awards.${(titleKey as { id: string }).id}.title`, 'Staged Prize')
    expect(editing.commit()).toBe('applied')
    expect(resumeDoc.current.content.awards).toHaveLength(before + 1)
    expect(resumeDoc.current.content.awards.at(-1)!.text.en.title).toBe('Staged Prize')
  })

  it('creates no blank entry when the staged entry is cancelled', () => {
    const before = resumeDoc.current.content.awards.length
    editing.begin({ kind: 'new-entry', section: 'awards' })
    editing.cancel()
    expect(resumeDoc.current.content.awards).toHaveLength(before)
  })

  it('reports the new item id after confirming, for focus', () => {
    editing.begin({ kind: 'new-entry', section: 'skills' })
    const id = editing.active!.staged!.item.id
    editing.commit()
    expect(editing.lastAdded).toEqual({ section: 'skills', id })
  })
})

describe('undo steps', () => {
  beforeEach(() => editing.enter())

  it('a committed field edit is one undo step', () => {
    editing.begin({ kind: 'field', ref: name })
    editing.setDraft('profile.name', 'New Name')
    expect(editing.commit()).toBe('applied')
    resumeDoc.undo()
    expect(resumeDoc.current.profile.text.en.name).toBe('Aditya Prayoga')
    expect(resumeDoc.canUndo).toBe(false)
  })

  it('a confirmed new entry is one undo step', () => {
    const before = resumeDoc.current.content.experience.length
    editing.begin({ kind: 'new-entry', section: 'experience' })
    const roleKey = Object.keys(editing.active!.draft).find((key) => key.endsWith('.role'))!
    editing.setDraft(roleKey, 'Analyst')
    expect(editing.commit()).toBe('applied')
    expect(resumeDoc.current.content.experience).toHaveLength(before + 1)
    resumeDoc.undo()
    expect(resumeDoc.current.content.experience).toHaveLength(before)
    expect(resumeDoc.canUndo).toBe(false)
  })

  it('an unchanged commit records nothing', () => {
    editing.begin({ kind: 'field', ref: name })
    expect(editing.commit()).toBe('unchanged')
    expect(resumeDoc.canUndo).toBe(false)
  })
})

describe('announcements', () => {
  it('changes the live text when the same message is announced twice', () => {
    editing.announce('Undone')
    const first = editing.announcement
    editing.announce('Undone')
    expect(editing.announcement).not.toBe(first)
    expect(editing.announcement.replace(/​/g, '')).toBe('Undone')
  })
})
