import { beforeEach, describe, expect, it } from 'vitest'
import { prefs } from './preferences.svelte'
import { PREFERENCES_KEY } from '$lib/storage/persist'

beforeEach(() => {
  localStorage.clear()
  prefs.introDismissed = false
})

describe('introDismissed', () => {
  it('persists and restores introDismissed', () => {
    prefs.introDismissed = true
    expect(prefs.persistable().introDismissed).toBe(true)

    prefs.introDismissed = false
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify({ introDismissed: true }))
    prefs.hydrate(localStorage)
    expect(prefs.introDismissed).toBe(true)

    prefs.introDismissed = false
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify({ introDismissed: 'yes' }))
    prefs.hydrate(localStorage)
    expect(prefs.introDismissed).toBe(false)
  })
})

describe('storyAttention', () => {
  it('persists independent locale sets and filters malformed stored entries', () => {
    prefs.storyAttention = {
      en: { present: ['headline:city'], seen: ['headline:city'] },
      id: { present: ['summary:years'], seen: [] },
    }
    expect(prefs.persistable().storyAttention).toEqual(prefs.storyAttention)

    localStorage.setItem(PREFERENCES_KEY, JSON.stringify({
      storyAttention: {
        en: { present: ['a', 42, 'a', null], seen: ['a', false] },
        id: { present: 'bad', seen: [null, 'b'] },
      },
    }))
    prefs.hydrate(localStorage)
    expect(prefs.storyAttention).toEqual({
      en: { present: ['a'], seen: ['a'] },
      id: { present: [], seen: ['b'] },
    })
  })

  it('defaults each malformed locale independently', () => {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify({ storyAttention: { en: null, id: [] } }))
    prefs.hydrate(localStorage)
    expect(prefs.storyAttention).toEqual({
      en: { present: [], seen: [] }, id: { present: [], seen: [] },
    })
  })
})
