import { describe, expect, it } from 'vitest'
import { flushSync } from 'svelte'
import { resumeDoc } from './document.svelte'
import { sampleDocument } from '../../data/sample'

/**
 * The autosave effect depends on `$state.snapshot` walking the document deeply
 * enough to register a dependency on every field. That is the assumption the
 * whole persistence design rests on, so it is asserted directly rather than
 * trusted.
 */
const countEffectRuns = (mutate: () => void): number => {
  let runs = 0
  const cleanup = $effect.root(() => {
    $effect(() => {
      resumeDoc.snapshot()
      runs += 1
    })
  })

  flushSync()
  const initial = runs
  mutate()
  flushSync()
  const after = runs
  cleanup()

  return after - initial
}

describe('snapshot dependency tracking', () => {
  it('reruns when a top-level profile field changes', () => {
    resumeDoc.replace(sampleDocument())
    expect(countEffectRuns(() => {
      resumeDoc.current.profile.text.en.name = 'Changed'
    })).toBe(1)
  })

  it('reruns when a deeply nested array element changes', () => {
    resumeDoc.replace(sampleDocument())
    expect(countEffectRuns(() => {
      resumeDoc.current.content.experience[0]!.text.en.bullets[0] = 'Changed'
    })).toBe(1)
  })

  it('reruns when an item is added through the store', () => {
    resumeDoc.replace(sampleDocument())
    expect(countEffectRuns(() => resumeDoc.addItem('awards'))).toBe(1)
  })

  it('reruns when a section is toggled', () => {
    resumeDoc.replace(sampleDocument())
    expect(countEffectRuns(() => resumeDoc.setSectionEnabled('awards', false))).toBe(1)
  })

  it('does not rerun when nothing changes', () => {
    resumeDoc.replace(sampleDocument())
    expect(countEffectRuns(() => {})).toBe(0)
  })
})
