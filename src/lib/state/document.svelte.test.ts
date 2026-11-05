import { beforeEach, describe, expect, it } from 'vitest'
import { HISTORY_LIMIT, resumeDoc } from './document.svelte'
import { sampleDocument } from '../../data/sample'
import { emptyDocument } from '$lib/model/document'
import { validateDocument } from '$lib/model/document'

beforeEach(() => {
  resumeDoc.load(sampleDocument())
})

describe('snapshot', () => {
  it('returns a plain object that survives structuredClone', () => {
    const snap = resumeDoc.snapshot()
    expect(() => structuredClone(snap)).not.toThrow()
  })

  it('is detached from the live document', () => {
    const snap = resumeDoc.snapshot()
    resumeDoc.current.profile.text.en.name = 'Changed'
    expect(snap.profile.text.en.name).not.toBe('Changed')
  })

  it('stays valid, so it can be exported directly', () => {
    expect(validateDocument(resumeDoc.snapshot()).ok).toBe(true)
  })
})

describe('committed change subscriptions', () => {
  it('emits once for nested writes, skips a no-op, and detaches both snapshots', () => {
    const events: Array<{ before: ReturnType<typeof resumeDoc.snapshot>; after: ReturnType<typeof resumeDoc.snapshot>; kind: string }> = []
    const unsubscribe = resumeDoc.subscribeChanges((event) => events.push(event))
    resumeDoc.change(() => {
      resumeDoc.change(() => { resumeDoc.current.profile.text.en.summary = 'First' })
      resumeDoc.current.profile.text.id.summary = 'Pertama'
    })
    resumeDoc.change(() => { resumeDoc.current.profile.text.en.summary = 'First' })
    expect(events).toHaveLength(1)
    expect(events[0]?.kind).toBe('change')
    expect(events[0]?.before.profile.text.en.summary).not.toBe('First')
    expect(events[0]?.after.profile.text.en.summary).toBe('First')
    resumeDoc.current.profile.text.en.summary = 'Later'
    expect(events[0]?.after.profile.text.en.summary).toBe('First')
    unsubscribe()
    resumeDoc.change(() => { resumeDoc.current.profile.text.en.summary = 'Again' })
    expect(events).toHaveLength(1)
  })

  it('reports nested replace by identity, and equal-content replace/load', () => {
    const kinds: string[] = []
    const unsubscribe = resumeDoc.subscribeChanges(({ kind }) => kinds.push(kind))
    const identity = resumeDoc.identity
    resumeDoc.change(() => resumeDoc.replace(resumeDoc.snapshot()))
    expect(resumeDoc.identity).toBe(identity + 1)
    resumeDoc.replace(resumeDoc.snapshot())
    resumeDoc.load(resumeDoc.snapshot())
    expect(kinds).toEqual(['replace', 'replace', 'load'])
    unsubscribe()
  })

  it('coalesces nested load into one event and clears both history stacks', () => {
    resumeDoc.change(() => { resumeDoc.current.profile.text.en.summary = 'First edit' })
    resumeDoc.change(() => { resumeDoc.current.profile.text.en.summary = 'Second edit' })
    resumeDoc.undo()
    expect(resumeDoc.canUndo).toBe(true)
    expect(resumeDoc.canRedo).toBe(true)
    const before = resumeDoc.snapshot()
    const events: Array<{ kind: string; before: ReturnType<typeof resumeDoc.snapshot>; after: ReturnType<typeof resumeDoc.snapshot> }> = []
    const unsubscribe = resumeDoc.subscribeChanges((event) => events.push(event))
    const loaded = sampleDocument()
    loaded.profile.text.en.summary = 'Loaded'
    resumeDoc.change(() => {
      resumeDoc.current.profile.text.en.headline = 'Before load'
      resumeDoc.load(loaded)
      resumeDoc.current.profile.text.en.headline = 'After load'
    })
    expect(events).toHaveLength(1)
    expect(events[0]?.kind).toBe('load')
    expect(events[0]?.before).toEqual(before)
    expect(events[0]?.after).toEqual(resumeDoc.snapshot())
    expect(resumeDoc.current.profile.text.en.headline).toBe('After load')
    expect(resumeDoc.canUndo).toBe(false)
    expect(resumeDoc.canRedo).toBe(false)
    expect(resumeDoc.undo()).toBe(false)
    expect(resumeDoc.redo()).toBe(false)
    unsubscribe()
  })

  it('notifies once for an equal-content nested load without creating undo history', () => {
    const kinds: string[] = []
    const unsubscribe = resumeDoc.subscribeChanges(({ kind }) => kinds.push(kind))
    resumeDoc.change(() => resumeDoc.load(resumeDoc.snapshot()))
    expect(kinds).toEqual(['load'])
    expect(resumeDoc.canUndo).toBe(false)
    unsubscribe()
  })

  it('emits detached undo/redo snapshots without extra history steps', () => {
    const events: Array<{ kind: string; before: ReturnType<typeof resumeDoc.snapshot>; after: ReturnType<typeof resumeDoc.snapshot> }> = []
    const unsubscribe = resumeDoc.subscribeChanges((event) => events.push(event))
    resumeDoc.change(() => { resumeDoc.current.profile.text.en.summary = 'Changed' })
    resumeDoc.undo()
    resumeDoc.redo()
    expect(events.map((event) => event.kind)).toEqual(['change', 'undo', 'redo'])
    expect(events[1]?.before.profile.text.en.summary).toBe('Changed')
    expect(events[1]?.after.profile.text.en.summary).toBe(events[0]?.before.profile.text.en.summary)
    expect(resumeDoc.canRedo).toBe(false)
    expect(resumeDoc.undo()).toBe(true)
    expect(resumeDoc.canUndo).toBe(false)
    unsubscribe()
  })
})

describe('items', () => {
  it('appends a valid empty item', () => {
    const before = resumeDoc.current.content.experience.length
    const id = resumeDoc.addItem('experience')
    expect(resumeDoc.current.content.experience).toHaveLength(before + 1)
    expect(resumeDoc.current.content.experience.at(-1)?.id).toBe(id)
    expect(validateDocument(resumeDoc.snapshot()).ok).toBe(true)
  })

  it('appends a prepared item as given, so a staged entry keeps its id and text', () => {
    const before = resumeDoc.current.content.awards.length
    const id = resumeDoc.addItem('awards', {
      id: 'awd_staged', date: '2024', text: { en: { title: 'T', issuer: '', description: '' }, id: { title: '', issuer: '', description: '' } },
    })
    expect(id).toBe('awd_staged')
    expect(resumeDoc.current.content.awards).toHaveLength(before + 1)
    expect(resumeDoc.current.content.awards.at(-1)?.text.en.title).toBe('T')
  })

  it('removes an item by id and ignores an unknown id', () => {
    const id = resumeDoc.current.content.experience[0]!.id
    resumeDoc.removeItem('experience', id)
    expect(resumeDoc.current.content.experience.some((i) => i.id === id)).toBe(false)
    expect(() => resumeDoc.removeItem('experience', 'nope')).not.toThrow()
  })

  it('moves an item down and back up', () => {
    const [first, second] = resumeDoc.current.content.experience
    resumeDoc.moveItem('experience', first!.id, 1)
    expect(resumeDoc.current.content.experience[0]?.id).toBe(second!.id)
    resumeDoc.moveItem('experience', first!.id, -1)
    expect(resumeDoc.current.content.experience[0]?.id).toBe(first!.id)
  })

  it('clamps a move at the ends instead of wrapping', () => {
    const ids = resumeDoc.current.content.experience.map((i) => i.id)
    resumeDoc.moveItem('experience', ids[0]!, -5)
    expect(resumeDoc.current.content.experience.map((i) => i.id)).toEqual(ids)
    resumeDoc.moveItem('experience', ids.at(-1)!, 5)
    expect(resumeDoc.current.content.experience.map((i) => i.id)).toEqual(ids)
  })
})

describe('sections', () => {
  it('toggles a section without reordering it', () => {
    const order = resumeDoc.current.sections.map((s) => s.kind)
    resumeDoc.setSectionEnabled('awards', false)
    expect(resumeDoc.current.sections.find((s) => s.kind === 'awards')?.enabled).toBe(false)
    expect(resumeDoc.current.sections.map((s) => s.kind)).toEqual(order)
  })

  it('moves a section and clamps at the ends', () => {
    const [first, second] = resumeDoc.current.sections.map((s) => s.kind)
    resumeDoc.moveSection(first!, 1)
    expect(resumeDoc.current.sections[0]?.kind).toBe(second)
    resumeDoc.moveSection(second!, -3)
    expect(resumeDoc.current.sections[0]?.kind).toBe(second)
  })
})

describe('fillUntranslated', () => {
  it('fills a field blank in the target from the source', () => {
    const en = resumeDoc.current.content.experience[0]!.text.en.role
    resumeDoc.current.content.experience[0]!.text.id.role = ''
    resumeDoc.fillUntranslated('en', 'id')
    expect(resumeDoc.current.content.experience[0]!.text.id.role).toBe(en)
  })

  it('keeps fields already translated in the target', () => {
    const headline = resumeDoc.current.profile.text.id.headline
    const bullets = [...resumeDoc.current.content.experience[0]!.text.id.bullets]
    expect(headline).not.toBe(resumeDoc.current.profile.text.en.headline)
    resumeDoc.current.profile.text.id.summary = ''
    resumeDoc.fillUntranslated('en', 'id')
    expect(resumeDoc.current.profile.text.id.headline).toBe(headline)
    expect(resumeDoc.current.content.experience[0]!.text.id.bullets).toEqual(bullets)
    expect(resumeDoc.current.profile.text.id.summary).toBe(resumeDoc.current.profile.text.en.summary)
  })

  it('leaves a field blank in both locales blank', () => {
    resumeDoc.current.profile.text.en.summary = ''
    resumeDoc.current.profile.text.id.summary = ''
    resumeDoc.fillUntranslated('en', 'id')
    expect(resumeDoc.current.profile.text.id.summary).toBe('')
  })

  it('leaves nothing untranslated afterwards', () => {
    resumeDoc.current.profile.text.id.summary = ''
    resumeDoc.current.content.experience[0]!.text.id.bullets = []
    expect(resumeDoc.untranslatedCount('id')).toBe(2)
    resumeDoc.fillUntranslated('en', 'id')
    expect(resumeDoc.untranslatedCount('id')).toBe(0)
  })

  it('deep-copies so later edits do not bleed across locales', () => {
    resumeDoc.current.content.experience[0]!.text.id.bullets = []
    resumeDoc.fillUntranslated('en', 'id')
    resumeDoc.current.content.experience[0]!.text.id.bullets[0] = 'Diubah'
    expect(resumeDoc.current.content.experience[0]!.text.en.bullets[0]).not.toBe('Diubah')
  })

  it('leaves the source and shared fields untouched', () => {
    resumeDoc.current.content.experience[0]!.text.id.role = ''
    const en = structuredClone(resumeDoc.snapshot().content.experience[0]!.text.en)
    const company = resumeDoc.current.content.experience[0]!.company
    resumeDoc.fillUntranslated('en', 'id')
    expect(resumeDoc.snapshot().content.experience[0]!.text.en).toEqual(en)
    expect(resumeDoc.current.content.experience[0]!.company).toBe(company)
  })

  it('is a no-op when source and target match', () => {
    resumeDoc.current.profile.text.en.summary = ''
    const before = resumeDoc.snapshot()
    resumeDoc.fillUntranslated('en', 'en')
    expect(resumeDoc.snapshot()).toEqual(before)
  })
})

describe('untranslatedCount', () => {
  it('is zero for the fully translated sample', () => {
    expect(resumeDoc.untranslatedCount('id')).toBe(0)
    expect(resumeDoc.untranslatedCount('en')).toBe(0)
  })

  it('counts a field blank in one locale but filled in the other', () => {
    resumeDoc.current.profile.text.id.summary = ''
    resumeDoc.current.content.experience[0]!.text.id.role = ''
    expect(resumeDoc.untranslatedCount('id')).toBe(2)
    expect(resumeDoc.untranslatedCount('en')).toBe(0)
  })

  it('does not count a field blank in both locales', () => {
    resumeDoc.replace(emptyDocument())
    expect(resumeDoc.untranslatedCount('id')).toBe(0)
  })
})

describe('moveSectionTo', () => {
  it('moves a section to an absolute index', () => {
    const order = resumeDoc.current.sections.map((s) => s.kind)
    resumeDoc.moveSectionTo(order[0]!, 2)
    expect(resumeDoc.current.sections.map((s) => s.kind)).toEqual([
      order[1], order[2], order[0], ...order.slice(3),
    ])
  })

  it('clamps an out-of-range index', () => {
    const order = resumeDoc.current.sections.map((s) => s.kind)
    resumeDoc.moveSectionTo(order[0]!, 99)
    expect(resumeDoc.current.sections.at(-1)?.kind).toBe(order[0])
    resumeDoc.moveSectionTo(order[0]!, -99)
    expect(resumeDoc.current.sections[0]?.kind).toBe(order[0])
  })

  it('is a no-op for the same index or an unknown kind', () => {
    const before = resumeDoc.current.sections.map((s) => s.kind)
    resumeDoc.moveSectionTo(before[1]!, 1)
    expect(resumeDoc.current.sections.map((s) => s.kind)).toEqual(before)
    // @ts-expect-error probing the runtime guard
    resumeDoc.moveSectionTo('nope', 0)
    expect(resumeDoc.current.sections.map((s) => s.kind)).toEqual(before)
  })
})

describe('history', () => {
  const json = () => JSON.stringify(resumeDoc.snapshot())

  it('undoes and redoes an item removal', () => {
    const id = resumeDoc.current.content.experience[0]!.id
    resumeDoc.removeItem('experience', id)
    expect(resumeDoc.canUndo).toBe(true)
    expect(resumeDoc.undo()).toBe(true)
    expect(resumeDoc.current.content.experience[0]!.id).toBe(id)
    expect(resumeDoc.canRedo).toBe(true)
    expect(resumeDoc.redo()).toBe(true)
    expect(resumeDoc.current.content.experience.some((item) => item.id === id)).toBe(false)
  })

  it('records nothing for a change that changes nothing', () => {
    const last = resumeDoc.current.sections.at(-1)!
    resumeDoc.moveSection(last.kind, 1)
    resumeDoc.setSectionEnabled(last.kind, last.enabled)
    expect(resumeDoc.canUndo).toBe(false)
  })

  it('folds nested changes into one step', () => {
    const before = json()
    resumeDoc.change(() => {
      resumeDoc.addItem('skills')
      resumeDoc.moveSection('skills', -1)
    })
    resumeDoc.undo()
    expect(json()).toBe(before)
    expect(resumeDoc.canUndo).toBe(false)
  })

  it('clears redo when a new change is recorded', () => {
    resumeDoc.addItem('skills')
    resumeDoc.undo()
    resumeDoc.addItem('awards')
    expect(resumeDoc.canRedo).toBe(false)
  })

  it('keeps at most HISTORY_LIMIT steps, dropping the oldest', () => {
    const sampleSkillCount = resumeDoc.current.content.skills.length
    for (let i = 0; i < HISTORY_LIMIT + 5; i += 1) resumeDoc.addItem('skills')
    let undone = 0
    while (resumeDoc.undo()) undone += 1
    expect(undone).toBe(HISTORY_LIMIT)
    expect(resumeDoc.current.content.skills.length).toBe(sampleSkillCount + 5)
  })

  it('records replace() as one undoable step and bumps generation on undo', () => {
    const name = resumeDoc.current.profile.text.en.name
    resumeDoc.replace(emptyDocument())
    const generation = resumeDoc.generation
    resumeDoc.undo()
    expect(resumeDoc.current.profile.text.en.name).toBe(name)
    expect(resumeDoc.generation).toBe(generation + 1)
  })

  it('load() clears both stacks', () => {
    resumeDoc.addItem('skills')
    resumeDoc.addItem('skills')
    resumeDoc.undo()
    resumeDoc.load(emptyDocument())
    expect(resumeDoc.canUndo).toBe(false)
    expect(resumeDoc.canRedo).toBe(false)
  })

  it('undo and redo return false on an empty stack', () => {
    expect(resumeDoc.undo()).toBe(false)
    expect(resumeDoc.redo()).toBe(false)
  })

  it('kept snapshots are not aliased to the live document', () => {
    const name = resumeDoc.current.profile.text.en.name
    resumeDoc.addItem('skills')
    resumeDoc.undo()
    resumeDoc.current.profile.text.en.name = 'mutated'
    resumeDoc.redo()
    expect(resumeDoc.current.profile.text.en.name).toBe(name)
  })

  it.each([
    ['moveItem', () => resumeDoc.moveItem('experience', resumeDoc.current.content.experience[0]!.id, 1)],
    ['moveSectionTo', () => resumeDoc.moveSectionTo(resumeDoc.current.sections[0]!.kind, 2)],
    ['setSectionEnabled', () => resumeDoc.setSectionEnabled(resumeDoc.current.sections[0]!.kind, !resumeDoc.current.sections[0]!.enabled)],
  ])('%s is one undoable step', (_name, act) => {
    const before = json()
    act()
    expect(resumeDoc.canUndo).toBe(true)
    resumeDoc.undo()
    expect(json()).toBe(before)
  })

  it('fillUntranslated is one undoable step', () => {
    const doc = sampleDocument()
    doc.profile.text.id.summary = ''
    resumeDoc.load(doc)
    const before = json()
    resumeDoc.fillUntranslated('en', 'id')
    expect(resumeDoc.canUndo).toBe(true)
    resumeDoc.undo()
    expect(json()).toBe(before)
  })
})
