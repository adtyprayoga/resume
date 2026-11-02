import { describe, expect, it } from 'vitest'
import { t } from './ui'
import { LOCALES } from '$lib/model/types'
import { sectionModules } from '$lib/sections/registry'

describe('ui strings', () => {
  it('resolves a key in every locale', () => {
    for (const locale of LOCALES) {
      expect(t(locale, 'action.print')).not.toBe('')
    }
  })

  it('has a translated title for every registered section', () => {
    for (const module of sectionModules) {
      for (const locale of LOCALES) {
        expect(t(locale, module.labelKey as 'section.experience')).toBeTruthy()
      }
    }
  })

  it('differs between locales', () => {
    expect(t('id', 'date.present')).not.toBe(t('en', 'date.present'))
  })
})
