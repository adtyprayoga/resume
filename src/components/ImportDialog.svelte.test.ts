import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import ImportDialog from './ImportDialog.svelte'
import PersistenceHost from './PersistenceHost.svelte'
import { sampleDocument } from '../data/sample'
import { resumeDoc } from '$lib/state/document.svelte'
import { prefs } from '$lib/state/preferences.svelte'
import { DOCUMENT_KEY } from '$lib/storage/persist'

const incoming = () => {
  const doc = sampleDocument()
  doc.profile.text.en.name = 'Imported Person'
  doc.profile.text.id.name = 'Orang Impor'
  return doc
}

beforeEach(() => {
  vi.unstubAllGlobals()
  resumeDoc.replace(sampleDocument())
  prefs.uiLocale = 'en'
  prefs.documentLocale = 'en'
  localStorage.clear()
})

function mount() {
  const closed = vi.fn()
  const view = render(ImportDialog, { onClose: () => { closed(); view.unmount() } })
  return { ...view, closed }
}

async function enter(source: 'paste' | 'file' | 'url', text = JSON.stringify(incoming())) {
  const user = userEvent.setup()
  if (source === 'paste') {
    await user.click(screen.getByLabelText('Paste JSON'))
    await user.paste(text)
    await user.click(screen.getByRole('button', { name: 'Review pasted JSON' }))
  } else if (source === 'file') {
    const file = new File([text], 'resume.json', { type: 'application/json' })
    Object.defineProperty(file, 'text', { value: async () => text })
    await user.upload(screen.getByLabelText('Resume JSON file'), file)
  } else {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(text, { headers: { 'content-type': 'application/json' } })))
    await user.type(screen.getByLabelText('Resume JSON URL'), 'https://example.com/resume.json')
    await user.click(screen.getByRole('button', { name: 'Load' }))
  }
  await screen.findByRole('button', { name: 'Replace resume' })
}

describe('import review', () => {
  it.each(['paste', 'file', 'url'] as const)('%s import remains pending until explicitly confirmed', async source => {
    const before = resumeDoc.snapshot()
    const stored = JSON.stringify(before)
    localStorage.setItem(DOCUMENT_KEY, stored)
    const { closed } = mount()
    await enter(source)
    expect(screen.getByText('Imported Person')).toBeInTheDocument()
    expect(resumeDoc.snapshot()).toEqual(before)
    expect(localStorage.getItem(DOCUMENT_KEY)).toBe(stored)
    expect(closed).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus()
    await userEvent.click(screen.getByRole('button', { name: 'Replace resume' }))
    expect(resumeDoc.current.profile.text.en.name).toBe('Imported Person')
    expect(closed).toHaveBeenCalledOnce()
  })

  it('Back retains the chosen file and allows reviewing it again without reselection', async () => {
    mount()
    await enter('file')
    await userEvent.click(screen.getByRole('button', { name: 'Back' }))
    const input = screen.getByLabelText('Resume JSON file') as HTMLInputElement
    expect(input.files?.[0]?.name).toBe('resume.json')
    expect(input).toHaveFocus()
    await userEvent.click(screen.getByRole('button', { name: 'Review selected file' }))
    expect(await screen.findByText('Imported Person')).toBeInTheDocument()
    expect(resumeDoc.current.profile.text.en.name).toBe('Aditya Prayoga')
  })

  it('shows the imported name in the selected document language', async () => {
    prefs.documentLocale = 'id'
    mount()
    await enter('paste')
    expect(screen.getByText('Orang Impor')).toBeInTheDocument()
  })

  it('Back preserves the pasted draft and Cancel leaves the current document untouched', async () => {
    const before = resumeDoc.snapshot()
    mount()
    await enter('paste')
    await userEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getByLabelText('Paste JSON')).toHaveValue(JSON.stringify(incoming()))
    expect(screen.getByLabelText('Paste JSON')).toHaveFocus()
    await userEvent.click(screen.getByRole('button', { name: 'Review pasted JSON' }))
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(resumeDoc.snapshot()).toEqual(before)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('associates and announces validation errors without discarding the draft', async () => {
    const before = resumeDoc.snapshot()
    mount()
    const input = screen.getByLabelText('Paste JSON')
    await userEvent.type(input, 'invalid')
    await userEvent.click(screen.getByRole('button', { name: 'Review pasted JSON' }))
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent(/JSON/)
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input.getAttribute('aria-describedby')).toContain(alert.id)
    expect(input).toHaveValue('invalid')
    expect(resumeDoc.snapshot()).toEqual(before)
  })

  it('Escape dismisses the dialog and restores the opener focus', async () => {
    const opener = document.createElement('button')
    document.body.append(opener)
    opener.focus()
    mount()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(opener).toHaveFocus()
    opener.remove()
  })

  it('reports file read failures and permits another attempt', async () => {
    mount()
    const file = new File(['broken'], 'resume.json', { type: 'application/json' })
    Object.defineProperty(file, 'text', { value: async () => { throw new Error('read failure') } })
    await userEvent.upload(screen.getByLabelText('Resume JSON file'), file)
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not be read/i)
    expect(screen.getByLabelText('Resume JSON file')).not.toBeDisabled()
  })

  it('ignores a URL response after dismissal and disables concurrent sources while loading', async () => {
    let finish!: (response: Response) => void
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(resolve => { finish = resolve })))
    const before = resumeDoc.snapshot()
    mount()
    await userEvent.type(screen.getByLabelText('Resume JSON URL'), 'https://example.com/resume.json')
    await userEvent.click(screen.getByRole('button', { name: 'Load' }))
    expect(screen.getByLabelText('Resume JSON file')).toBeDisabled()
    expect(screen.getByLabelText('Paste JSON')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus()
    await userEvent.keyboard('{Tab}')
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus()
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    finish(new Response(JSON.stringify(incoming()), { headers: { 'content-type': 'application/json' } }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(resumeDoc.snapshot()).toEqual(before)
  })

  it('shows a skeleton, not a spinner, while loading a URL', async () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(() => {})))
    const { container } = mount()
    await userEvent.type(screen.getByLabelText('Resume JSON URL'), 'https://example.com/resume.json')
    await userEvent.click(screen.getByRole('button', { name: 'Load' }))
    expect(container.ownerDocument.querySelector('.skeleton')).toHaveAttribute('aria-hidden', 'true')
    expect(screen.getByRole('status')).toHaveTextContent('Loading…')
    expect(screen.getByRole('status')).toHaveClass('sr-only')
  })

  it.each(['Close', 'Escape', 'backdrop'])('%s discards a reviewed import without touching storage', async method => {
    const before = resumeDoc.snapshot()
    const stored = JSON.stringify(before)
    localStorage.setItem(DOCUMENT_KEY, stored)
    mount()
    await enter('paste')
    if (method === 'Escape') await userEvent.keyboard('{Escape}')
    else if (method === 'backdrop') await fireEvent.click(screen.getByRole('dialog').parentElement!)
    else await userEvent.click(screen.getByRole('button', { name: method }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(resumeDoc.snapshot()).toEqual(before)
    expect(localStorage.getItem(DOCUMENT_KEY)).toBe(stored)
  })

  it('ignores a file read completed after the dialog is unmounted', async () => {
    let finish!: (text: string) => void
    const read = new Promise<string>(resolve => { finish = resolve })
    const file = new File(['pending'], 'resume.json', { type: 'application/json' })
    Object.defineProperty(file, 'text', { value: () => read })
    const before = resumeDoc.snapshot()
    const { unmount, closed } = mount()
    await userEvent.upload(screen.getByLabelText('Resume JSON file'), file)
    expect(screen.getByLabelText('Resume JSON URL')).toBeDisabled()
    unmount()
    await act(async () => { finish(JSON.stringify(incoming())); await read })
    expect(resumeDoc.snapshot()).toEqual(before)
    expect(closed).not.toHaveBeenCalled()
  })

  it('translates an existing error without losing the pasted draft', async () => {
    mount()
    await userEvent.type(screen.getByLabelText('Paste JSON'), 'invalid')
    await userEvent.click(screen.getByRole('button', { name: 'Review pasted JSON' }))
    await act(() => { prefs.uiLocale = 'id' })
    expect(screen.getByLabelText('Tempel JSON')).toHaveValue('invalid')
    expect(screen.getByRole('alert')).toHaveTextContent(/JSON/)
    expect(screen.getByRole('alert')).not.toHaveTextContent('That file')
    expect(screen.getByRole('button', { name: 'Tutup' })).toBeInTheDocument()
  })

  it('autosaves a confirmed import', async () => {
    render(PersistenceHost)
    mount()
    await enter('paste')
    await userEvent.click(screen.getByRole('button', { name: 'Replace resume' }))
    await waitFor(() => expect(JSON.parse(localStorage.getItem(DOCUMENT_KEY) ?? '{}').profile?.text.en.name).toBe('Imported Person'))
  })

  it('rejects an oversized file before reading it', async () => {
    mount()
    const file = new File(['{}'], 'big.json', { type: 'application/json' })
    Object.defineProperty(file, 'size', { value: 1_000_001 })
    const text = vi.fn(async () => '{}')
    Object.defineProperty(file, 'text', { value: text })
    await userEvent.upload(screen.getByLabelText('Resume JSON file'), file)
    expect(await screen.findByRole('alert')).toHaveTextContent(/too large/i)
    expect(text).not.toHaveBeenCalled()
  })

  it.each(['Close', 'Escape', 'backdrop', 'unmount'])('%s aborts an in-flight URL import without announcing a late error', async method => {
    let signal: AbortSignal | undefined
    vi.stubGlobal('fetch', vi.fn((_url: string, init?: RequestInit) => {
      signal = init?.signal ?? undefined
      return new Promise<Response>((_resolve, reject) => {
        signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
      })
    }))
    const before = resumeDoc.snapshot()
    const stored = JSON.stringify(before)
    localStorage.setItem(DOCUMENT_KEY, stored)
    const { unmount } = mount()
    await userEvent.type(screen.getByLabelText('Resume JSON URL'), 'https://example.com/resume.json')
    await userEvent.click(screen.getByRole('button', { name: 'Load' }))
    expect(signal?.aborted).toBe(false)
    if (method === 'Escape') await userEvent.keyboard('{Escape}')
    else if (method === 'backdrop') await fireEvent.click(screen.getByRole('dialog').parentElement!)
    else if (method === 'unmount') unmount()
    else await userEvent.click(screen.getByRole('button', { name: method }))
    expect(signal?.aborted).toBe(true)
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)) })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(resumeDoc.snapshot()).toEqual(before)
    expect(localStorage.getItem(DOCUMENT_KEY)).toBe(stored)
  })

  it('cancels a response body that is still arriving when dismissed', async () => {
    let cancelled = false
    const body = new ReadableStream<Uint8Array>({
      pull: () => new Promise<void>(() => {}),
      cancel() { cancelled = true },
    }, { highWaterMark: 0 })
    vi.stubGlobal('fetch', vi.fn(async () => new Response(body, { headers: { 'content-type': 'application/json' } })))
    mount()
    await userEvent.type(screen.getByLabelText('Resume JSON URL'), 'https://example.com/resume.json')
    await userEvent.click(screen.getByRole('button', { name: 'Load' }))
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(cancelled).toBe(true))
  })
})
