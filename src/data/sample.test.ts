import { describe, expect, it } from 'vitest'
import { sampleDocument } from './sample'
import { validateDocument } from '$lib/model/document'
import { resolve } from '$lib/model/resolve'
import { LOCALES } from '$lib/model/types'

describe('sampleDocument', () => {
  it('survives validation unchanged', () => {
    const doc = sampleDocument()
    const result = validateDocument(doc)
    expect(result.ok && result.value).toEqual(doc)
  })

  it('is fully translated in both locales', () => {
    const doc = sampleDocument()
    for (const locale of LOCALES) {
      const r = resolve(doc, locale)
      expect(r.profile.headline).not.toBe('')
      expect(r.profile.summary).not.toBe('')
      for (const item of r.experience) {
        expect(item.role).not.toBe('')
        expect(item.bullets.length).toBeGreaterThan(0)
      }
      for (const item of r.education) expect(item.school).not.toBe('')
      for (const group of r.skills) expect(group.title).not.toBe('')
    }
  })

  it('has content in every section so the preview exercises all of them', () => {
    const r = resolve(sampleDocument(), 'en')
    for (const key of ['experience', 'education', 'projects', 'skills', 'awards'] as const) {
      expect(r[key].length).toBeGreaterThan(0)
    }
  })

  it('differs between locales where the text is genuinely translated', () => {
    const doc = sampleDocument()
    expect(resolve(doc, 'id').profile.headline).not.toBe(resolve(doc, 'en').profile.headline)
  })
})
