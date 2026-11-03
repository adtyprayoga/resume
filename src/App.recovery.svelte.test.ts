import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import App from './App.svelte'
import { sampleDocument } from './data/sample'
import { serializeResume } from '$lib/io/exportJson'
import { AUTOSAVE_DELAY_MS } from '$lib/state/autosave'
import { prefs } from '$lib/state/preferences.svelte'
import { editing } from '$lib/state/editing.svelte'
import { DOCUMENT_KEY } from '$lib/storage/persist'

const NEWER = JSON.stringify({ schemaVersion: 99, profile: { keep: 'me' } })

const imported = () => {
  const doc = sampleDocument()
  doc.profile.text.en.name = 'Imported Person'
  doc.profile.text.id.name = 'Orang Impor'
  return doc
}

beforeEach(() => {
  localStorage.clear()
  prefs.uiLocale = 'en'
  prefs.documentLocale = 'en'
  editing.reset()
  vi.useFakeTimers({ shouldAdvanceTime: true })
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

const recoveryHeading = () => screen.findByRole('heading', { name: /saved resume could not be opened/i })

describe('saved-data recovery', () => {
  it.each([
    ['unsupported schema', NEWER],
    ['corrupt JSON', '{not json'],
    ['empty string', ''],
  ])('blocks editing and never overwrites %s, even after autosave delays and page dismissal', async (_label, raw) => {
    localStorage.setItem(DOCUMENT_KEY, raw)
    render(App)
    await recoveryHeading()
    expect(document.querySelector('.resume-paper')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS * 5)
    window.dispatchEvent(new Event('pagehide'))
    expect(localStorage.getItem(DOCUMENT_KEY)).toBe(raw)
  })

  it('downloads the original string byte-for-byte without reserializing it', async () => {
    const raw = '{ "schemaVersion": 99,   "odd":  "spacing" }'
    localStorage.setItem(DOCUMENT_KEY, raw)
    let blob: Blob | undefined
    vi.spyOn(URL, 'createObjectURL').mockImplementation((value) => { blob = value as Blob; return 'blob:x' })
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    render(App)
    await recoveryHeading()
    await userEvent.click(screen.getByRole('button', { name: 'Download original data' }))
    expect(await blob?.text()).toBe(raw)
  })

  it('Retry loads the document once storage holds a readable one', async () => {
    localStorage.setItem(DOCUMENT_KEY, '{not json')
    render(App)
    await recoveryHeading()
    localStorage.setItem(DOCUMENT_KEY, serializeResume(imported()))
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByRole('heading', { level: 1, name: /Person|Budi/ })).toHaveTextContent('Imported Person')
  })

  it('Reset to sample needs explicit confirmation before writing', async () => {
    localStorage.setItem(DOCUMENT_KEY, NEWER)
    render(App)
    await recoveryHeading()
    await userEvent.click(screen.getByRole('button', { name: 'Reset to sample' }))
    expect(localStorage.getItem(DOCUMENT_KEY)).toBe(NEWER)
    await userEvent.click(screen.getByRole('button', { name: /Confirm reset/ }))
    expect(await screen.findByRole('heading', { level: 1, name: /Person|Budi/ })).toHaveTextContent('Aditya Prayoga')
    expect(JSON.parse(localStorage.getItem(DOCUMENT_KEY)!).profile.text.en.name).toBe('Aditya Prayoga')
  })

  it('a failed reset write keeps the original data and shows an error', async () => {
    localStorage.setItem(DOCUMENT_KEY, NEWER)
    render(App)
    await recoveryHeading()
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('full', 'QuotaExceededError') })
    await userEvent.click(screen.getByRole('button', { name: 'Reset to sample' }))
    await userEvent.click(screen.getByRole('button', { name: /Confirm reset/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/storage/i)
    expect(screen.getByRole('heading', { name: /saved resume could not be opened/i })).toBeInTheDocument()
    vi.mocked(Storage.prototype.setItem).mockRestore()
    expect(localStorage.getItem(DOCUMENT_KEY)).toBe(NEWER)
  })

  async function reviewImport() {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    await user.click(screen.getByRole('button', { name: 'Import replacement' }))
    await user.click(screen.getByLabelText('Paste JSON'))
    await user.paste(JSON.stringify(imported()))
    await user.click(screen.getByRole('button', { name: 'Review pasted JSON' }))
    await screen.findByRole('button', { name: 'Replace resume' })
    return user
  }

  it('a cancelled replacement import leaves recovery and storage untouched', async () => {
    localStorage.setItem(DOCUMENT_KEY, NEWER)
    render(App)
    await recoveryHeading()
    const user = await reviewImport()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /saved resume could not be opened/i })).toBeInTheDocument()
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS * 3)
    expect(localStorage.getItem(DOCUMENT_KEY)).toBe(NEWER)
  })

  it('a failed replacement write keeps the original data and reports the error', async () => {
    localStorage.setItem(DOCUMENT_KEY, NEWER)
    render(App)
    await recoveryHeading()
    const user = await reviewImport()
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('full', 'QuotaExceededError') })
    await user.click(screen.getByRole('button', { name: 'Replace resume' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/storage/i)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    vi.mocked(Storage.prototype.setItem).mockRestore()
    expect(localStorage.getItem(DOCUMENT_KEY)).toBe(NEWER)
  })

  it('a successful replacement is saved before leaving recovery', async () => {
    localStorage.setItem(DOCUMENT_KEY, NEWER)
    render(App)
    await recoveryHeading()
    const user = await reviewImport()
    await user.click(screen.getByRole('button', { name: 'Replace resume' }))
    expect(await screen.findByRole('heading', { level: 1, name: /Person|Budi/ })).toHaveTextContent('Imported Person')
    expect(JSON.parse(localStorage.getItem(DOCUMENT_KEY)!).profile.text.en.name).toBe('Imported Person')
  })

  it('blocked storage shows a retryable error without loading the sample or claiming nothing is saved', async () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('denied', 'SecurityError') })
    render(App)
    expect(await screen.findByRole('heading', { name: /storage is not accessible/i })).toBeInTheDocument()
    expect(document.querySelector('.resume-paper')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Reset to sample' })).not.toBeInTheDocument()
    getItem.mockRestore()
    localStorage.setItem(DOCUMENT_KEY, serializeResume(imported()))
    await fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(document.querySelector('.resume-paper h1')).toHaveTextContent('Imported Person'))
  })
})
