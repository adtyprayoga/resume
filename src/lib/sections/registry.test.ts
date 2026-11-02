import { describe, expect, it } from 'vitest'
import { DEFAULT_SECTION_ORDER } from './kinds'
import { expectedKinds, getSectionModule, registeredKinds, sectionModules } from './registry'

describe('section registry', () => {
  it('registers exactly the kinds declared in the union', () => {
    expect(registeredKinds()).toEqual(expectedKinds())
  })

  it('orders sections by the declared order, not glob key order', () => {
    expect(sectionModules.map((m) => m.kind)).toEqual([...DEFAULT_SECTION_ORDER])
  })

  it('gives every section a unique order', () => {
    const orders = sectionModules.map((m) => m.order)
    expect(new Set(orders).size).toBe(orders.length)
  })

  it('throws for an unregistered kind rather than returning undefined', () => {
    // @ts-expect-error probing the runtime guard with an invalid kind
    expect(() => getSectionModule('nope')).toThrow(/No section module/)
  })
})

describe('section validate', () => {
  it('returns an empty list for every non-array input', () => {
    for (const module of sectionModules) {
      for (const input of [null, undefined, 42, 'x', {}]) {
        expect(module.validate(input)).toEqual([])
      }
    }
  })

  it('drops non-object entries instead of failing the whole list', () => {
    for (const module of sectionModules) {
      expect(module.validate([null, 'x', 1, {}])).toHaveLength(1)
    }
  })

  it('round-trips emptyItem through validate unchanged', () => {
    for (const module of sectionModules) {
      const item = module.emptyItem()
      expect(module.validate([item])[0]).toEqual(item)
    }
  })

  it('gives every item an id and a text node for both locales', () => {
    for (const module of sectionModules) {
      const item = module.validate([{}])[0]
      expect(item.id).toMatch(/^[a-z]{3}_/)
      expect(Object.keys(item.text).sort()).toEqual(['en', 'id'])
    }
  })

  it('coerces wrong-typed leaves to safe defaults', () => {
    const experience = getSectionModule('experience')
    const item = experience.validate([
      { id: 'keep', company: 99, dates: 'nope', text: { en: { role: [], bullets: 'no' } } },
    ])[0]
    expect(item).toMatchObject({ id: 'keep', company: '', dates: { start: '', end: null } })
    expect(item.text.en).toEqual({ role: '', team: '', location: '', bullets: [] })
  })

  it('keeps a current role end-dateless', () => {
    const item = getSectionModule('experience').validate([
      { dates: { start: '2024-01', end: '2025-01', current: true } },
    ])[0]
    expect(item.dates).toEqual({ start: '2024-01', end: null, current: true })
  })

  it('strips a javascript: project link on import', () => {
    const item = getSectionModule('projects').validate([{ link: 'javascript:alert(1)' }])[0]
    expect(item.link).toBe('')
  })

  it('declares translatable fields that exist on the text node', () => {
    for (const module of sectionModules) {
      const item = module.emptyItem()
      for (const field of module.translatableFields) {
        expect(item.text.id).toHaveProperty(field)
      }
    }
  })
})
