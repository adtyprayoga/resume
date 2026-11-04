import { beforeEach, describe, expect, it } from 'vitest'
import { photoConsent } from './photoConsent.svelte'
import { resumeDoc } from './document.svelte'
import { sampleDocument } from '../../data/sample'
import { emptyDocument } from '$lib/model/document'

const url = 'https://example.com/photo.jpg'

beforeEach(() => {
  resumeDoc.load(sampleDocument())
  photoConsent.forgetUnless('')
})

describe('photo consent across history', () => {
  it('survives undo and redo of unrelated changes', () => {
    photoConsent.allow(url)
    resumeDoc.addItem('skills')
    resumeDoc.undo()
    expect(photoConsent.allows(url)).toBe(true)
    resumeDoc.redo()
    expect(photoConsent.allows(url)).toBe(true)
  })

  it('is asked again after a replaced or loaded document', () => {
    photoConsent.allow(url)
    resumeDoc.replace(emptyDocument())
    expect(photoConsent.allows(url)).toBe(false)
    photoConsent.allow(url)
    resumeDoc.load(sampleDocument())
    expect(photoConsent.allows(url)).toBe(false)
  })
})
