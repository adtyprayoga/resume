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
