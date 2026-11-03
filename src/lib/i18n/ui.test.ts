import { describe, expect, it } from 'vitest'
import { strings, t } from './ui'
import { LOCALES } from '$lib/model/types'
import { sectionModules } from '$lib/sections/registry'

describe('ui strings', () => {
  it('resolves a key in every locale', () => {
    for (const locale of LOCALES) {
      expect(t(locale, 'action.exportPdf')).not.toBe('')
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

  it('has no cliché copy or emoji', () => {
    for (const locale of LOCALES) {
      for (const text of Object.values(strings[locale])) {
        expect(text).not.toMatch(/elevate|seamless|unleash|next-gen/i)
        expect(text).not.toMatch(/\p{Extended_Pictographic}/u)
      }
    }
  })
})
