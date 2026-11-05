import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { emptyDocument } from '$lib/model/document'
import { gapIds } from '$lib/guidance/story'
import { savePreferences, PREFERENCES_KEY } from '$lib/storage/persist'
import { resumeDoc } from './document.svelte'
import { prefs } from './preferences.svelte'
import { storyAttention } from './storyAttention.svelte'

const blankSets = () => ({ en: { present: [], seen: [] }, id: { present: [], seen: [] } })
const seeded = () => {
  const doc = emptyDocument()
  doc.profile.text.en.name = 'Ayu'
  doc.profile.text.en.headline = 'Engineer'
  doc.profile.text.id.name = 'Ayu'
  doc.profile.text.id.headline = 'Insinyur'
  return doc
}

beforeEach(() => {
  storyAttention.stop()
  prefs.storyAttention = blankSets()
  prefs.documentLocale = 'en'
  resumeDoc.load(seeded())
})
afterEach(() => storyAttention.stop())

describe('story attention', () => {
  it('starts with a finite pulse occurrence and acknowledges current gaps', () => {
    storyAttention.start()
    expect(storyAttention.ready).toBe(true)
    expect(storyAttention.pulse).toBe(true)
    expect(storyAttention.pulseOccurrence).toBeGreaterThan(0)
    expect(prefs.storyAttention.en.present).toEqual(gapIds(resumeDoc.current, 'en'))
    storyAttention.acknowledge()
    expect(storyAttention.pulse).toBe(false)
    expect(prefs.storyAttention.en.seen).toEqual(prefs.storyAttention.en.present)
  })

  it('adopts hydrated seen gaps on startup without repulsing', () => {
    const gaps = gapIds(resumeDoc.current, 'en')
    prefs.storyAttention.en = { present: gaps, seen: gaps }
    storyAttention.start()
    expect(storyAttention.pulse).toBe(false)
    expect(storyAttention.pulseOccurrence).toBe(0)
  })

  it('observes resolve and return on same-tick commits while the book is closed', () => {
    storyAttention.start()
    storyAttention.acknowledge()
    const before = storyAttention.pulseOccurrence
    resumeDoc.change(() => { resumeDoc.current.profile.text.en.headline = 'Engineer | Mentor | Builder' })
    expect(prefs.storyAttention.en.present).not.toContain('headline:secondary')
    expect(prefs.storyAttention.en.seen).not.toContain('headline:secondary')
    resumeDoc.change(() => { resumeDoc.current.profile.text.en.headline = 'Engineer' })
    expect(storyAttention.pulse).toBe(true)
    expect(storyAttention.pulseOccurrence).toBeGreaterThan(before)
  })

  it('increments on a new gap even while another unseen gap remains', () => {
    storyAttention.start()
    const before = storyAttention.pulseOccurrence
    resumeDoc.change(() => { resumeDoc.current.profile.text.en.headline = 'Engineer | Mentor | Builder' })
    resumeDoc.change(() => { resumeDoc.current.profile.text.en.headline = 'Engineer' })
    expect(storyAttention.pulseOccurrence).toBeGreaterThan(before)
    expect(storyAttention.pulse).toBe(true)
  })

  it('keeps locale histories independent and tracks inactive locale changes', () => {
    storyAttention.start()
    storyAttention.acknowledge()
    const enSeen = [...prefs.storyAttention.en.seen]
    resumeDoc.change(() => { resumeDoc.current.profile.text.id.headline = 'Insinyur | Mentor | Pembuat' })
    expect(prefs.storyAttention.id.present).not.toContain('headline:secondary')
    prefs.documentLocale = 'id'
    expect(storyAttention.ready).toBe(true)
    expect(storyAttention.pulse).toBe(true)
    storyAttention.acknowledge()
    expect(prefs.storyAttention.en.seen).toEqual(enSeen)
    expect(storyAttention.pulse).toBe(false)
  })

  it('reconciles successive commits in both languages in the same tick', () => {
    storyAttention.start()
    storyAttention.acknowledge()
    prefs.documentLocale = 'id'
    storyAttention.acknowledge()
    const enOccurrence = storyAttention.pulseOccurrence
    resumeDoc.change(() => { resumeDoc.current.profile.text.en.headline = 'Engineer | Mentor | Builder' })
    resumeDoc.change(() => { resumeDoc.current.profile.text.id.headline = 'Insinyur | Mentor | Pembuat' })
    resumeDoc.change(() => { resumeDoc.current.profile.text.en.headline = 'Engineer' })
    resumeDoc.change(() => { resumeDoc.current.profile.text.id.headline = 'Insinyur' })
    expect(storyAttention.pulse).toBe(true)
    expect(storyAttention.pulseOccurrence).toBeGreaterThan(enOccurrence)
    prefs.documentLocale = 'en'
    expect(storyAttention.pulse).toBe(true)
    storyAttention.acknowledge()
    expect(storyAttention.pulse).toBe(false)
    prefs.documentLocale = 'id'
    expect(storyAttention.pulse).toBe(true)
  })

  it('resets on replace/load, but treats undo/redo as transitions', () => {
    storyAttention.start()
    storyAttention.acknowledge()
    const seen = [...prefs.storyAttention.en.seen]
    resumeDoc.change(() => { resumeDoc.current.profile.text.en.headline = 'Engineer | Mentor | Builder' })
    resumeDoc.undo()
    expect(prefs.storyAttention.en.seen).not.toContain('headline:secondary')
    expect(storyAttention.pulse).toBe(true)
    resumeDoc.redo()
    expect(storyAttention.pulse).toBe(false)
    resumeDoc.replace(resumeDoc.snapshot())
    expect(prefs.storyAttention.en.seen).toEqual([])
    expect(storyAttention.pulse).toBe(true)
    resumeDoc.load(resumeDoc.snapshot())
    expect(prefs.storyAttention.en.seen).toEqual([])
    expect(seen.length).toBeGreaterThan(0)
  })

  it('stops observing and resumes without duplicate subscriptions', () => {
    storyAttention.start()
    storyAttention.acknowledge()
    storyAttention.stop()
    resumeDoc.change(() => { resumeDoc.current.profile.text.en.headline = 'Engineer | Mentor | Builder' })
    expect(prefs.storyAttention.en.present).toContain('headline:secondary')
    storyAttention.start()
    expect(prefs.storyAttention.en.present).not.toContain('headline:secondary')
    storyAttention.start()
    resumeDoc.change(() => { resumeDoc.current.profile.text.en.headline = 'Engineer' })
    expect(storyAttention.pulse).toBe(true)
  })

  it('does not notify document subscribers or loop through preference persistence', () => {
    const listener = vi.fn()
    const unsubscribe = resumeDoc.subscribeChanges(listener)
    storyAttention.start()
    storyAttention.acknowledge()
    savePreferences(prefs.persistable(), localStorage)
    const saved = JSON.parse(localStorage.getItem(PREFERENCES_KEY)!)
    expect(saved.storyAttention.en.seen).toEqual(prefs.storyAttention.en.present)
    expect(listener).not.toHaveBeenCalled()
    unsubscribe()
  })
})
