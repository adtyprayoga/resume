import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/svelte'
import App from './App.svelte'
import { tick } from 'svelte'
import { prefs } from '$lib/state/preferences.svelte'
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

const storedName = () => {
  const result = loadDocument()
  return result.kind === 'loaded' ? result.document.profile.text.en.name : undefined
}

describe('App startup', () => {
  it('shows the sample when nothing is stored', () => {
    render(App)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Aditya Prayoga')
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
    expect(storedName()).toBe('Must Survive')
  })

  it('restores the stored interface locale', () => {
    localStorage.setItem(
      PREFERENCES_KEY,
      JSON.stringify({ uiLocale: 'id', documentLocale: 'id', themeKey: 'minimal', fontScale: 'standard' }),
    )
    render(App)
    expect(screen.getByRole('button', { name: 'Pengaturan' })).toBeInTheDocument()
  })

  it('ignores an invalid stored locale rather than breaking', () => {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify({ uiLocale: 'xx', themeKey: 'nope' }))
    render(App)
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
  })

  it('persists an edit made through the store', () => {
    render(App)
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS * 3)
    expect(loadDocument().kind).toBe('loaded')
  })
})


describe('independent interface and document languages', () => {
  it('labels the page and resume separately and names each language and size control', async () => {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify({ uiLocale: 'id', documentLocale: 'en' }))
    render(App)
    expect(document.documentElement.lang).toBe('id')
    expect(document.querySelector('.resume-paper')).toHaveAttribute('lang', 'en')
    await fireEvent.click(screen.getByRole('button', { name: 'Pengaturan' }))
    const ui = screen.getByRole('group', { name: 'Bahasa antarmuka' })
    expect(within(ui).getByRole('button', { name: 'Bahasa antarmuka: Indonesia' })).toHaveAttribute('aria-pressed', 'true')
    const resume = screen.getByRole('group', { name: 'Bahasa resume' })
    expect(within(resume).getByRole('button', { name: 'Bahasa resume: Inggris' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Ukuran huruf: sedang' })).toBeInTheDocument()
    await fireEvent.click(within(ui).getByRole('button', { name: 'Bahasa antarmuka: Inggris' }))
    expect(document.documentElement.lang).toBe('en')
    expect(document.querySelector('.resume-paper')).toHaveAttribute('lang', 'en')
    expect(prefs.documentLocale).toBe('en')
  })

  it('renders storage failure metadata in the selected interface language', async () => {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify({ uiLocale: 'id', documentLocale: 'en' }))
    render(App)
    prefs.saveStatus = { kind: 'error', message: 'This browser has no local storage available.', messageKey: 'error.storageUnavailable' }
    await tick()
    expect(screen.getByText('Penyimpanan lokal tidak tersedia di peramban ini.')).toBeInTheDocument()
  })
})
