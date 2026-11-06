import { describe, expect, it } from 'vitest'
import {
  applyDraft,
  bulletKeyAction,
  editKeyAction,
  entryRefs,
  profileRefs,
  readDraft,
  refKey,
  specFor,
  type FieldRef,
} from './fields'
import { sampleDocument } from '../../data/sample'
import { LIST_SECTION_KINDS } from '$lib/sections/kinds'
import { getSectionModule } from '$lib/sections/registry'

const exp = (key: string) => ({ owner: 'item' as const, section: 'experience' as const, id: 'exp_sample_1', key })

describe('field targets', () => {
  it('give every target a stable key built from identity, never displayed text', () => {
    expect(refKey({ owner: 'profile', key: 'name' })).toBe('profile.name')
    expect(refKey({ owner: 'contact', key: 'github' })).toBe('contact.github')
    expect(refKey(exp('role'))).toBe('item.experience.exp_sample_1.role')
  })

  it('describe each field with a scope, type and translated label', () => {
    expect(specFor(exp('company'))).toMatchObject({ scope: 'shared', type: 'text', labelKey: 'field.company' })
    expect(specFor(exp('bullets'))).toMatchObject({ scope: 'localized', type: 'lines' })
    expect(specFor({ owner: 'contact', key: 'website' })).toMatchObject({ scope: 'shared', type: 'url' })
    expect(specFor({ owner: 'contact', key: 'avatar' })).toMatchObject({ type: 'photo' })
    expect(specFor({ owner: 'profile', key: 'summary' })).toMatchObject({ scope: 'localized', type: 'multiline' })
  })

  it('cover every stored field of every section', () => {
    for (const kind of LIST_SECTION_KINDS) {
      const item = getSectionModule(kind).emptyItem() as Record<string, unknown> & { text: { en: Record<string, unknown> } }
      const stored = [
        ...Object.keys(item).filter((key) => key !== 'id' && key !== 'text'),
        ...Object.keys(item.text.en),
      ].sort()
      const covered = entryRefs(kind, item.id as string).map((ref) => ref.key).sort()
      expect(covered, kind).toEqual(stored)
    }
  })

  it('cover the whole profile and contact block', () => {
    expect(profileRefs().map(refKey)).toEqual([
      'profile.name', 'profile.headline', 'profile.location', 'profile.summary',
      'contact.email', 'contact.phone', 'contact.website', 'contact.github', 'contact.linkedin', 'contact.avatar',
    ])
  })
})

describe('reading drafts', () => {
  it('preserves duplicate bullets, whitespace and embedded newlines in array drafts', () => {
    const doc = sampleDocument()
    const values = [' padded ', 'A\nB', 'same', 'same']
    doc.content.experience[0]!.text.en.bullets = values
    const draft = readDraft(doc, exp('bullets'), 'en')
    expect(draft).toEqual(values)
    expect(draft).not.toBe(values)
    applyDraft(doc, exp('bullets'), 'en', draft!)
    expect(doc.content.experience[0]!.text.en.bullets).toEqual(values)
    expect(doc.content.experience[0]!.text.en.bullets).not.toBe(draft)
  })

  it('reads localized text from the requested locale', () => {
    const doc = sampleDocument()
    expect(readDraft(doc, { owner: 'profile', key: 'headline' }, 'id')).toBe(doc.profile.text.id.headline)
    expect(readDraft(doc, exp('role'), 'en')).toBe(doc.content.experience[0]!.text.en.role)
  })

  it('reads the stored URL, not a shortened display form', () => {
    const doc = sampleDocument()
    expect(readDraft(doc, { owner: 'contact', key: 'github' }, 'en')).toBe('https://github.com/example')
  })

  it('reads bullet arrays and tags as a comma list', () => {
    const doc = sampleDocument()
    const item = doc.content.experience[0]!
    expect(readDraft(doc, exp('bullets'), 'en')).toEqual(item.text.en.bullets)
    const project = doc.content.projects[0]!
    expect(readDraft(doc, { owner: 'item', section: 'projects', id: project.id, key: 'techStack' }, 'en'))
      .toBe(project.techStack.join(', '))
  })

  it('reads a date range as an editable triple', () => {
    const doc = sampleDocument()
    const dates = doc.content.experience[0]!.dates
    expect(readDraft(doc, exp('dates'), 'en')).toEqual({ start: dates.start, end: dates.end ?? '', current: dates.current === true })
  })

  it('reports a missing item as undefined rather than throwing', () => {
    expect(readDraft(sampleDocument(), { ...exp('role'), id: 'gone' }, 'en')).toBeUndefined()
  })
})

describe('applying drafts', () => {
  it('writes localized text into one locale only', () => {
    const doc = sampleDocument()
    const other = doc.profile.text.id.name
    expect(applyDraft(doc, { owner: 'profile', key: 'name' }, 'en', 'Ada')).toBe(true)
    expect(doc.profile.text.en.name).toBe('Ada')
    expect(doc.profile.text.id.name).toBe(other)
  })

  it('writes shared fields once for both locales', () => {
    const doc = sampleDocument()
    applyDraft(doc, exp('company'), 'id', 'PT Baru')
    expect(doc.content.experience[0]!.company).toBe('PT Baru')
  })

  it('preserves list rows and normalizes tags when applied', () => {
    const doc = sampleDocument()
    applyDraft(doc, exp('bullets'), 'en', [' first ', 'second'])
    expect(doc.content.experience[0]!.text.en.bullets).toEqual([' first ', 'second'])
    const project = doc.content.projects[0]!
    applyDraft(doc, { owner: 'item', section: 'projects', id: project.id, key: 'techStack' }, 'en', 'Go, , Rust ,')
    expect(project.techStack).toEqual(['Go', 'Rust'])
  })

  it('normalizes typed URLs with the shared normalizer', () => {
    const doc = sampleDocument()
    applyDraft(doc, { owner: 'contact', key: 'website' }, 'en', 'me.example.com')
    expect(doc.contact.website).toBe('https://me.example.com')
  })

  it('keeps a current date range consistent', () => {
    const doc = sampleDocument()
    applyDraft(doc, exp('dates'), 'en', { start: '2020-01', end: '2021-02', current: true })
    expect(doc.content.experience[0]!.dates).toEqual({ start: '2020-01', end: null, current: true })
    applyDraft(doc, exp('dates'), 'en', { start: '2020-01', end: '2021-02', current: false })
    expect(doc.content.experience[0]!.dates).toEqual({ start: '2020-01', end: '2021-02' })
    applyDraft(doc, exp('dates'), 'en', { start: '2020-01', end: '', current: false })
    expect(doc.content.experience[0]!.dates).toEqual({ start: '2020-01', end: null })
  })

  it('refuses to write to a missing item', () => {
    const doc = sampleDocument()
    const before = JSON.stringify(doc)
    expect(applyDraft(doc, { ...exp('role'), id: 'gone' }, 'en', 'x')).toBe(false)
    expect(JSON.stringify(doc)).toBe(before)
  })

  it('writes into a staged item that is not in the document', () => {
    const doc = sampleDocument()
    const staged = getSectionModule('awards').emptyItem()
    const ref: FieldRef = { owner: 'item', section: 'awards', id: staged.id, key: 'title' }
    expect(applyDraft(doc, ref, 'en', 'Prize', staged)).toBe(true)
    expect(staged.text.en.title).toBe('Prize')
    expect(doc.content.awards.some((item) => item.id === staged.id)).toBe(false)
  })
})

describe('editing keys', () => {
  const key = (init: Partial<KeyboardEvent> & { key: string }) => ({ isComposing: false, ctrlKey: false, metaKey: false, shiftKey: false, ...init })

  it('commits single-line text on Enter', () => {
    expect(editKeyAction(key({ key: 'Enter' }), false)).toBe('commit')
  })

  it('keeps Enter as a newline in multiline text, committing on Ctrl or Cmd+Enter', () => {
    expect(editKeyAction(key({ key: 'Enter' }), true)).toBeNull()
    expect(editKeyAction(key({ key: 'Enter', ctrlKey: true }), true)).toBe('commit')
    expect(editKeyAction(key({ key: 'Enter', metaKey: true }), true)).toBe('commit')
  })

  it('cancels on Escape', () => {
    expect(editKeyAction(key({ key: 'Escape' }), false)).toBe('cancel')
  })

  it('ignores keys while an IME is composing', () => {
    expect(editKeyAction(key({ key: 'Enter', isComposing: true }), false)).toBeNull()
    expect(editKeyAction(key({ key: 'Process' }), false)).toBeNull()
    expect(editKeyAction(key({ key: 'Escape', isComposing: true }), false)).toBeNull()
  })
})


describe('bullet keyboard actions', () => {
  const enter = { key: 'Enter', isComposing: false, ctrlKey: false, metaKey: false, altKey: false }
  it('distinguishes the next bullet from a line break and explicit apply', () => {
    expect(bulletKeyAction(enter)).toBe('next')
    expect(bulletKeyAction({ ...enter, altKey: true })).toBe('newline')
    expect(bulletKeyAction({ ...enter, ctrlKey: true })).toBe('commit')
    expect(bulletKeyAction({ ...enter, metaKey: true })).toBe('commit')
    expect(bulletKeyAction({ ...enter, isComposing: true })).toBeNull()
    expect(bulletKeyAction({ ...enter, keyCode: 229 })).toBeNull()
    expect(bulletKeyAction({ ...enter, key: 'Escape' })).toBe('cancel')
  })

  it('rejects invalid insertion positions', () => {
    const doc = sampleDocument()
    for (const after of [-1, 999, 0.5]) {
      const ref: FieldRef = { owner: 'bullet', section: 'experience', id: 'exp_sample_1', key: 'bullets', index: 'append', after }
      expect(readDraft(doc, ref, 'en')).toBeUndefined()
      expect(applyDraft(doc, ref, 'en', 'wrong')).toBe(false)
    }
  })
})
