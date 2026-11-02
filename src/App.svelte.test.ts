import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/svelte'
import App from './App.svelte'
import { sampleDocument } from './data/sample'
import { serializeResume } from '$lib/io/exportJson'
import { AUTOSAVE_DELAY_MS } from '$lib/state/autosave'
import { DOCUMENT_KEY, loadDocument, PREFERENCES_KEY } from '$lib/storage/persist'

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers({ shouldAdvanceTime: true })
})

afterEach(() => {
  vi.useRealTimers()
})

const storeEdited = (name: string) => {
  const doc = sampleDocument()
  doc.profile.text.en.name = name
  doc.profile.text.id.name = name
  localStorage.setItem(DOCUMENT_KEY, serializeResume(doc))
}

describe('App startup', () => {
  it('shows the sample when nothing is stored', () => {
    render(App)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Budi Santoso')
  })

  it('restores a stored document instead of the sample', () => {
    storeEdited('Restored Name')
    render(App)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Restored Name')
  })

  it('does not let the first autosave overwrite stored work', () => {
    // Hydration must happen before the autosave effect runs. If it did not,
    // the effect would write a fresh sample over the stored resume on load.
    storeEdited('Must Survive')
    render(App)
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS * 3)
    expect(loadDocument()?.profile.text.en.name).toBe('Must Survive')
  })

  it('falls back to the sample when the stored document is corrupt', () => {
    localStorage.setItem(DOCUMENT_KEY, '{not json')
    render(App)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Budi Santoso')
  })

  it('falls back to the sample for a document from a newer schema', () => {
    localStorage.setItem(DOCUMENT_KEY, JSON.stringify({ schemaVersion: 99 }))
    render(App)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Budi Santoso')
  })

  it('restores the stored interface locale', () => {
    localStorage.setItem(
      PREFERENCES_KEY,
      JSON.stringify({ uiLocale: 'id', documentLocale: 'id', themeKey: 'minimal', fontScale: 'standard' }),
    )
    render(App)
    expect(screen.getByRole('button', { name: /Simpan sebagai PDF/ })).toBeInTheDocument()
  })

  it('ignores an invalid stored locale rather than breaking', () => {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify({ uiLocale: 'xx', themeKey: 'nope' }))
    render(App)
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
  })

  it('persists an edit made through the store', () => {
    render(App)
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS * 3)
    expect(loadDocument()).not.toBeNull()
  })
})
