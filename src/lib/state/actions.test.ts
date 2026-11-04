import { beforeEach, describe, expect, it } from 'vitest'
import { redo, undo } from './actions'
import { editing } from './editing.svelte'
import { resumeDoc } from './document.svelte'
import { prefs } from './preferences.svelte'
import { sampleDocument } from '../../data/sample'
import type { FieldRef } from '$lib/editing/fields'

const name: FieldRef = { owner: 'profile', key: 'name' }

beforeEach(() => {
  editing.reset()
  resumeDoc.load(sampleDocument())
  prefs.uiLocale = 'en'
  prefs.documentLocale = 'en'
})

describe('undo and redo actions', () => {
  it('commits an open draft with changes, then undoes it', () => {
    editing.enter()
    editing.begin({ kind: 'field', ref: name })
    editing.setDraft('profile.name', 'Draft Name')
    expect(undo('en')).toBe(true)
    expect(editing.active).toBeNull()
    expect(resumeDoc.current.profile.text.en.name).toBe('Aditya Prayoga')
  })

  it('drops an untouched new-entry draft without recording a step', () => {
    const awardsBefore = resumeDoc.current.content.awards.length
    const skillsBefore = resumeDoc.current.content.skills.length
    resumeDoc.addItem('awards')
    editing.enter()
    editing.begin({ kind: 'new-entry', section: 'skills' })
    expect(undo('en')).toBe(true)
    expect(resumeDoc.current.content.awards).toHaveLength(awardsBefore)
    expect(resumeDoc.current.content.skills).toHaveLength(skillsBefore)
  })

  it('announces politely and never touches the document language', () => {
    prefs.documentLocale = 'id'
    resumeDoc.addItem('skills')
    undo('en')
    expect(editing.announcement).toBe('Undone')
    expect(prefs.documentLocale).toBe('id')
    redo('id')
    expect(editing.announcement).toBe('Diulang')
  })

  it('returns false and announces nothing with empty history', () => {
    expect(undo('en')).toBe(false)
    expect(redo('en')).toBe(false)
    expect(editing.announcement).toBe('')
  })
})
