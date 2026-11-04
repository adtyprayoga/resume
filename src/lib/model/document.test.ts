import { describe, expect, it } from 'vitest'
import { emptyDocument, normalizeSections, validateDocument } from './document'
import { migrate } from './migrate'
import { DEFAULT_SECTION_ORDER } from '$lib/sections/kinds'
import { SCHEMA_VERSION } from './types'

describe('emptyDocument', () => {
  it('is valid, versioned and has every section enabled', () => {
    const doc = emptyDocument()
    expect(doc.schemaVersion).toBe(SCHEMA_VERSION)
    expect(doc.sections.map((s) => s.kind)).toEqual([...DEFAULT_SECTION_ORDER])
    expect(doc.sections.every((s) => s.enabled)).toBe(true)
    const result = validateDocument(doc)
    expect(result.ok).toBe(true)
  })

  it('round-trips through JSON and validation unchanged', () => {
    const doc = emptyDocument()
    const result = validateDocument(JSON.parse(JSON.stringify(doc)))
    expect(result.ok && result.value).toEqual(doc)
  })
})

describe('normalizeSections', () => {
  it('appends missing kinds in default order', () => {
    const sections = normalizeSections([{ kind: 'awards', enabled: false }])
    expect(sections[0]).toEqual({ kind: 'awards', enabled: false })
    expect(sections.map((s) => s.kind).sort()).toEqual([...DEFAULT_SECTION_ORDER].sort())
  })

  it('drops unknown kinds and duplicates', () => {
    const sections = normalizeSections([
      { kind: 'nope', enabled: true },
      { kind: 'skills', enabled: false },
      { kind: 'skills', enabled: true },
    ])
    expect(sections.filter((s) => s.kind === 'skills')).toHaveLength(1)
    expect(sections.some((s) => (s.kind as string) === 'nope')).toBe(false)
  })

  it('preserves a disabled flag through normalization', () => {
    const sections = normalizeSections([{ kind: 'skills', enabled: false }])
    expect(sections.find((s) => s.kind === 'skills')?.enabled).toBe(false)
  })

  it('returns the full default order for junk input', () => {
    expect(normalizeSections('nope').map((s) => s.kind)).toEqual([...DEFAULT_SECTION_ORDER])
  })
})

describe('validateDocument', () => {
  it('rejects non-objects', () => {
    for (const input of [null, undefined, 'x', 42, []]) {
      expect(validateDocument(input).ok).toBe(false)
    }
  })

  it('accepts a minimal object by filling defaults', () => {
    const result = validateDocument({ schemaVersion: 1 })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.contact.email).toBe('')
      expect(result.value.content.experience).toEqual([])
    }
  })

  it('strips a javascript: avatar and website', () => {
    const result = validateDocument({
      schemaVersion: 1,
      contact: { avatar: 'javascript:alert(1)', website: 'data:text/html,x' },
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.contact.avatar).toBe('')
      expect(result.value.contact.website).toBe('')
    }
  })

  it('keeps a legitimate avatar data URL', () => {
    const result = validateDocument({
      schemaVersion: 1,
      contact: { avatar: 'data:image/png;base64,AAA' },
    })
    expect(result.ok && result.value.contact.avatar).toBe('data:image/png;base64,AAA')
  })
})

describe('migrate', () => {
  it('passes a current-version document through', () => {
    expect(migrate({ schemaVersion: SCHEMA_VERSION }).ok).toBe(true)
  })

  it('treats a missing schemaVersion as the earliest version', () => {
    expect(migrate({ contact: {} }).ok).toBe(true)
  })

  it('refuses a document from a newer version rather than coercing it', () => {
    const result = migrate({ schemaVersion: SCHEMA_VERSION + 1 })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/newer/i)
  })

  it('rejects non-objects', () => {
    expect(migrate('x').ok).toBe(false)
  })
})

describe('certifications schema migration', () => {
  it('migrates a schema-1 resume and appends the new section', () => {
    const migrated = migrate({ schemaVersion: 1, sections: [{ kind: 'awards', enabled: false }], content: { awards: [{ id: 'awd_1', date: '2022', text: { en: { title: 'A' } } }] } })
    if (!migrated.ok) throw new Error('migration failed')
    const doc = validateDocument(migrated.value)
    if (!doc.ok) throw new Error('invalid')
    expect(doc.value.schemaVersion).toBe(2)
    expect(doc.value.content.awards[0]!.text.en.title).toBe('A')
    expect(doc.value.content.certifications).toEqual([])
    expect(doc.value.sections[0]).toEqual({ kind: 'awards', enabled: false })
    expect(doc.value.sections.at(-1)).toEqual({ kind: 'references', enabled: true })
  })

  it('coerces certification items like awards', () => {
    const doc = validateDocument({ content: { certifications: [null, 4, { date: '2024-05', text: { en: { title: 'Cloud', issuer: 4, description: 'Practitioner' } } }] } })
    if (!doc.ok) throw new Error('invalid')
    expect(doc.value.content.certifications).toHaveLength(1)
    const item = doc.value.content.certifications[0]!
    expect(item.id).toMatch(/^crt_/)
    expect(item.date).toBe('2024-05')
    expect(item.text.en).toEqual({ title: 'Cloud', issuer: '', description: 'Practitioner' })
    expect(item.text.id).toEqual({ title: '', issuer: '', description: '' })
  })
})

it('coerces reference items', () => {
  const doc = validateDocument({ content: { references: [{ phone: 62, email: 'a@b.co', text: { en: { name: 'Anggi', note: 5 } } }] } })
  if (!doc.ok) throw new Error('invalid')
  expect(doc.value.content.references[0]).toMatchObject({ phone: '', email: 'a@b.co', text: { en: { name: 'Anggi', position: '', note: '' } } })
})
