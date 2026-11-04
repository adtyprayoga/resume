import { beforeEach, describe, expect, it } from 'vitest'
import { recovery } from './recovery.svelte'
import { resumeDoc } from './document.svelte'
import { sampleDocument } from '../../data/sample'
import { emptyDocument } from '$lib/model/document'
import { saveDocument } from '$lib/storage/persist'

beforeEach(() => {
  localStorage.clear()
  resumeDoc.load(sampleDocument())
  resumeDoc.addItem('skills')
})

describe('history on load', () => {
  it('a startup load is not undoable', () => {
    saveDocument(sampleDocument(), localStorage)
    recovery.open(localStorage)
    expect(resumeDoc.canUndo).toBe(false)
  })

  it('a recovery commit is not undoable', () => {
    expect(recovery.commit(emptyDocument(), localStorage).kind).toBe('saved')
    expect(resumeDoc.canUndo).toBe(false)
  })
})
