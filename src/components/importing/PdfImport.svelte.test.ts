import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import ImportDialog from '../ImportDialog.svelte'
import ResumePaper from '../preview/ResumePaper.svelte'
import { sampleDocument } from '../../data/sample'
import { resolve as resolveDocument } from '$lib/model/resolve'
import { resumeDoc } from '$lib/state/document.svelte'
import { editing } from '$lib/state/editing.svelte'
import { prefs } from '$lib/state/preferences.svelte'
import { DOCUMENT_KEY } from '$lib/storage/persist'
import type { Extraction } from '$lib/io/pdf/types'

const CONTRACT = resolve(__dirname, '../../../services/pdf-import/tests/fixtures/contract/valid')
const load = (name: string) => JSON.parse(readFileSync(resolve(CONTRACT, name), 'utf8'))
const JOB = load('job_processing.json')
const ID = JOB.id as string
const english = (): Extraction => load('extraction_en_single.json')

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

/** A fake extraction service. `hold` keeps polls pending until released. */
function service(result: Extraction | { code: string } = english(), options: { hold?: boolean } = {}) {
  const calls: string[] = []
  let release: () => void = () => {}
  const held = new Promise<void>((resolve) => (release = resolve))
  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    calls.push(`${method} ${String(input)}`)
    if (method === 'POST') return json({ ...JOB, stage: 'queued' }, 202)
    if (method === 'DELETE') return new Response(null, { status: 204 })
    if (options.hold) {
      await new Promise<void>((resolve, reject) => {
        held.then(resolve)
        init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
      })
    }
    if ('code' in result) return json({ ...JOB, status: 'failed', stage: null, error: { code: result.code, retryable: true } })
    return json({ ...JOB, status: 'completed', stage: 'done', result })
  })
  vi.stubGlobal('fetch', fetch)
  return { calls, release: () => release() }
}

beforeEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  resumeDoc.replace(sampleDocument())
  editing.reset()
  prefs.uiLocale = 'en'
  prefs.documentLocale = 'en'
  prefs.themeKey = 'minimal'
  prefs.fontScale = 'standard'
  localStorage.clear()
})

function mount(props: Record<string, unknown> = {}) {
  const closed = vi.fn()
  const view = render(ImportDialog, { onClose: () => { closed(); view.unmount() }, pdfImport: true, pdfPollMs: 0, ...props })
  return { ...view, closed }
}

async function choosePdf() {
  const user = userEvent.setup()
  const file = new File(['%PDF-1.7'], 'cv.pdf', { type: 'application/pdf' })
  await user.upload(screen.getByLabelText('Resume PDF'), file)
  await user.click(screen.getByRole('button', { name: 'Convert PDF' }))
  return user
}

async function review() {
  const user = await choosePdf()
  await screen.findByRole('heading', { name: 'Review PDF import' })
  return user
}

describe('PDF import source', () => {
  it('is hidden unless the deployment enables it', () => {
    render(ImportDialog, { onClose: () => {} })
    expect(screen.queryByLabelText('Resume PDF')).toBeNull()
    expect(screen.getByLabelText('Paste JSON')).toBeInTheDocument()
  })

  it('sits beside the JSON sources and explains temporary server processing', () => {
    mount()
    expect(screen.getByRole('heading', { name: 'Import resume' })).toBeInTheDocument()
    expect(screen.getByLabelText('Paste JSON')).toBeInTheDocument()
    expect(screen.getByText(/temporary processing/)).toBeInTheDocument()
    expect(screen.getByText(/stays stored in this browser/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Convert PDF' })).toBeDisabled()
  })

  it('announces the real processing stages and keeps cancellation available', async () => {
    const server = service(english(), { hold: true })
    mount()
    await choosePdf()
    const status = await screen.findByRole('status')
    await waitFor(() => expect(status).toHaveTextContent('Waiting for the converter…'))
    expect(status.textContent).not.toMatch(/%/)
    expect(screen.getByRole('button', { name: 'Cancel conversion' })).toBeEnabled()
    server.release()
    await screen.findByRole('heading', { name: 'Review PDF import' })
  })

  it('cancels on the server and lets the user try again', async () => {
    const server = service(english(), { hold: true })
    mount()
    const user = await choosePdf()
    await user.click(await screen.findByRole('button', { name: 'Cancel conversion' }))
    await waitFor(() => expect(server.calls).toContain(`DELETE /api/pdf-import/jobs/${ID}`))
    expect(screen.getByRole('status')).toHaveTextContent('Conversion cancelled.')
    expect(screen.getByRole('button', { name: 'Convert PDF' })).toBeEnabled()
    expect(resumeDoc.current.profile.text.en.name).toBe('Aditya Prayoga')
  })

  it('cancels the server job when the dialog is dismissed mid-conversion and ignores late responses', async () => {
    const server = service(english(), { hold: true })
    const { closed } = mount()
    const user = await choosePdf()
    await screen.findByRole('button', { name: 'Cancel conversion' })
    await user.keyboard('{Escape}')
    expect(closed).toHaveBeenCalledOnce()
    await waitFor(() => expect(server.calls).toContain(`DELETE /api/pdf-import/jobs/${ID}`))
    server.release()
    await new Promise((r) => setTimeout(r, 20))
    expect(resumeDoc.current.profile.text.en.name).toBe('Aditya Prayoga')
  })

  it('keeps keyboard focus inside the dialog through conversion and cancellation', async () => {
    service(english(), { hold: true })
    mount()
    const user = await choosePdf()
    const cancel = await screen.findByRole('button', { name: 'Cancel conversion' })
    expect(cancel).toHaveFocus()
    await user.click(cancel)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Convert PDF' })).toHaveFocus())
  })

  it('announces a conversion failure and allows another attempt', async () => {
    service({ code: 'busy' })
    mount()
    await choosePdf()
    expect(await screen.findByRole('alert')).toHaveTextContent('Another PDF is being converted.')
    expect(screen.getByRole('button', { name: 'Convert PDF' })).toBeEnabled()
  })

  it('reports an unreachable service as retryable without affecting JSON import', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch') }))
    mount()
    await choosePdf()
    expect(await screen.findByRole('alert')).toHaveTextContent('PDF conversion is unavailable right now. Try again in a moment.')
    expect(screen.getByLabelText('Paste JSON')).toBeEnabled()
  })
})

describe('PDF review', () => {
  it.each(['minimal', 'ats'])('preserves the existing photo and %s presentation when replacing from PDF', async (themeKey) => {
    service()
    const avatar = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jG1sAAAAASUVORK5CYII='
    resumeDoc.current.contact.avatar = avatar
    prefs.themeKey = themeKey
    prefs.fontScale = 'small'
    const preferences = prefs.persistable()
    mount()
    const user = await review()
    expect(resumeDoc.current.contact.avatar).toBe(avatar)
    expect(prefs.persistable()).toEqual(preferences)

    await user.click(screen.getByRole('button', { name: 'Replace resume' }))
    expect(resumeDoc.current.profile.text.en.name).toBe('Jane Doe')
    expect(resumeDoc.current.contact.avatar).toBe(avatar)
    expect(JSON.parse(localStorage.getItem(DOCUMENT_KEY)!).contact.avatar).toBe(avatar)
    expect(prefs.persistable()).toEqual(preferences)

    const { container } = render(ResumePaper, {
      resume: resolveDocument(resumeDoc.current, 'en'), locale: 'en', presentation: prefs.theme.presentation,
    })
    if (themeKey === 'minimal') {
      expect(container.querySelector('.resume-header')).not.toBeNull()
      expect(container.querySelector('img.resume-avatar')).toHaveAttribute('src', avatar)
      expect(container.querySelector('.ats-header')).toBeNull()
    } else {
      expect(container.querySelector('.ats-header')).not.toBeNull()
      expect(container.querySelector('img.resume-avatar')).toBeNull()
    }
  })

  it('reviews and confirms the real progression fixture without changing stored work early', async () => {
    service(load('extraction_progression.json'))
    const before = JSON.stringify(resumeDoc.snapshot())
    localStorage.setItem(DOCUMENT_KEY, before)
    const { closed } = mount()
    const user = await review()
    expect(screen.getByLabelText('Headline')).toHaveValue('Technical Lead/Senior Engineer (Python & TypeScript) - IT Instructor')
    expect(screen.getAllByLabelText('Location')[0]).toHaveValue('Bandung, Indonesia')
    expect(screen.getAllByLabelText('Company').map((element) => (element as HTMLInputElement).value)).toEqual([
      'Contoh Learning / PT Contoh Teknologi', 'Contoh Learning / PT Contoh Teknologi', 'Contoh Learning / PT Contoh Teknologi', '',
    ])
    const lead = screen.getByRole('group', { name: 'Experience entry 1' })
    expect(within(lead).getByText('Coordinated delivery with public-sector stakeholders.')).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Projects entry 5' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Education entry 2' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Awards entry 1' })).toBeInTheDocument()

    const headline = screen.getByLabelText('Headline')
    await user.clear(headline)
    await user.type(headline, 'Engineering Lead and Instructor')
    expect(JSON.stringify(resumeDoc.snapshot())).toBe(before)
    expect(localStorage.getItem(DOCUMENT_KEY)).toBe(before)
    await user.click(screen.getByRole('button', { name: 'Replace resume' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Confirm that you have checked the unplaced text first.')
    expect(JSON.stringify(resumeDoc.snapshot())).toBe(before)
    expect(localStorage.getItem(DOCUMENT_KEY)).toBe(before)

    await user.click(screen.getByLabelText('I have checked the text that was not placed in any field'))
    await user.click(screen.getByRole('button', { name: 'Replace resume' }))
    expect(closed).toHaveBeenCalledOnce()
    const result = resumeDoc.snapshot()
    expect(result.profile.text.en.headline).toBe('Engineering Lead and Instructor')
    expect(result.content.experience).toHaveLength(4)
    expect(result.content.experience.map((item) => item.text.en.bullets.length)).toEqual([5, 4, 2, 2])
    expect(result.content.projects).toHaveLength(5)
    expect(result.content.education).toHaveLength(2)
    expect(result.content.awards).toHaveLength(1)
    expect(JSON.parse(localStorage.getItem(DOCUMENT_KEY)!)).toEqual(result)
  })

  it('shows conflicting-date guidance in both interface languages', async () => {
    service({ contract_version: 1, pages: 1, blocks: [
      { id: 'b1', page: 1, label: 'title', group: null, text: 'MAYA CONTOH', bbox: null },
      { id: 'b2', page: 1, label: 'section_header', group: null, text: 'Experience', bbox: null },
      { id: 'b3', page: 1, label: 'section_header', group: null, text: 'Software Engineer at Example Systems', bbox: { l: 40, t: 100, r: 300, b: 112 } },
      { id: 'b4', page: 1, label: 'text', group: null, text: '2020 – 2022', bbox: { l: 330, t: 100, r: 420, b: 112 } },
      { id: 'b5', page: 1, label: 'text', group: null, text: '2021 – 2023', bbox: { l: 430, t: 100, r: 530, b: 112 } },
      { id: 'b6', page: 1, label: 'list_item', group: null, text: 'Built a search service.', bbox: null },
    ] })
    mount()
    await review()
    expect(screen.getByText('Some entries have conflicting dates. Their periods are blank and the source dates are listed below for review.')).toBeInTheDocument()
    prefs.uiLocale = 'id'
    expect(await screen.findByText('Beberapa entri memiliki tanggal yang bertentangan. Periodenya dikosongkan dan tanggal sumber tercantum di bawah untuk diperiksa.')).toBeInTheDocument()
  })

  it('shows the proposal without touching the current document or storage', async () => {
    service()
    const stored = JSON.stringify(resumeDoc.snapshot())
    localStorage.setItem(DOCUMENT_KEY, stored)
    mount()
    await review()
    expect(screen.getByLabelText('Name')).toHaveValue('Jane Doe')
    expect(screen.getByLabelText('Email')).toHaveValue('jane.doe@example.com')
    expect(screen.getAllByLabelText('Company').map((el) => (el as HTMLInputElement).value)).toEqual(['Example Payments', 'Sample Logistics'])
    expect(resumeDoc.current.profile.text.en.name).toBe('Aditya Prayoga')
    expect(localStorage.getItem(DOCUMENT_KEY)).toBe(stored)
  })

  it('deletes the server result once it is in the browser', async () => {
    const server = service()
    mount()
    await review()
    expect(server.calls.at(-1)).toBe(`DELETE /api/pdf-import/jobs/${ID}`)
  })

  it('replaces the resume with the corrected draft only on confirmation', async () => {
    service()
    const { closed } = mount()
    const user = await review()
    const name = screen.getByLabelText('Name')
    await user.clear(name)
    await user.type(name, 'Jane Q. Doe')
    expect(resumeDoc.current.profile.text.en.name).toBe('Aditya Prayoga')
    await user.click(screen.getByRole('button', { name: 'Replace resume' }))
    expect(resumeDoc.current.profile.text.en.name).toBe('Jane Q. Doe')
    expect(resumeDoc.current.content.experience.map((e) => e.company)).toEqual(['Example Payments', 'Sample Logistics'])
    expect(JSON.parse(localStorage.getItem(DOCUMENT_KEY)!).profile.text.en.name).toBe('Jane Q. Doe')
    expect(closed).toHaveBeenCalledOnce()
  })

  it('moves the text to the chosen source language', async () => {
    service()
    mount()
    const user = await review()
    await user.selectOptions(screen.getByLabelText('Language of this text'), 'id')
    expect(screen.getByLabelText('Name')).toHaveValue('Jane Doe')
    await user.click(screen.getByRole('button', { name: 'Replace resume' }))
    expect(resumeDoc.current.profile.text.id.name).toBe('Jane Doe')
    expect(resumeDoc.current.profile.text.en.name).toBe('')
  })

  it('defaults the source language to the document language', async () => {
    service()
    prefs.documentLocale = 'id'
    mount()
    await review()
    expect(screen.getByLabelText('Language of this text')).toHaveValue('id')
  })

  it('adds and removes entries', async () => {
    service()
    mount()
    const user = await review()
    await user.click(screen.getByRole('button', { name: 'Remove Experience entry 2' }))
    expect(screen.getAllByLabelText('Company')).toHaveLength(1)
    await user.click(screen.getByRole('button', { name: 'Add Awards entry' }))
    expect(screen.getByRole('group', { name: 'Awards entry 1' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Replace resume' }))
    expect(resumeDoc.current.content.experience).toHaveLength(1)
    expect(resumeDoc.current.content.awards).toHaveLength(1)
  })

  it('shows source text for an entry and all extracted text', async () => {
    service()
    mount()
    await review()
    const entry = screen.getByRole('group', { name: 'Experience entry 1' })
    expect(within(entry).getByText('Senior Backend Engineer, Example Payments')).toBeInTheDocument()
    expect(screen.getByText('All extracted text (20 blocks)')).toBeInTheDocument()
    expect(screen.getByText('All extracted text was placed in a field.')).toBeInTheDocument()
  })

  it('requires acknowledging unplaced text before replacing', async () => {
    const extraction = english()
    extraction.blocks.splice(4, 0, { id: 'b99', page: 1, label: 'text', group: null, text: 'Open to relocation, Jakarta, Indonesia, Singapore', bbox: null })
    extraction.blocks.forEach((b, i) => (b.id = `b${i + 1}`))
    service(extraction)
    mount()
    const user = await review()
    expect(screen.getByText('Text not placed in any field (1)')).toBeInTheDocument()
    const unplaced = screen.getByRole('list', { name: 'Text not placed in any field (1)' })
    expect(within(unplaced).getByText('Open to relocation, Jakarta, Indonesia, Singapore')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Replace resume' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Confirm that you have checked the unplaced text first.')
    expect(resumeDoc.current.profile.text.en.name).toBe('Aditya Prayoga')
    await user.click(screen.getByLabelText('I have checked the text that was not placed in any field'))
    await user.click(screen.getByRole('button', { name: 'Replace resume' }))
    expect(resumeDoc.current.profile.text.en.name).toBe('Jane Doe')
  })

  it('sanitises the draft through the document validator', async () => {
    service()
    mount()
    const user = await review()
    const website = screen.getByLabelText('Website')
    await user.clear(website)
    await user.type(website, 'javascript:alert(1)')
    await user.click(screen.getByRole('button', { name: 'Replace resume' }))
    expect(resumeDoc.current.contact.website).toBe('')
  })

  it('keeps the current resume when it cannot be saved', async () => {
    service()
    mount()
    const user = await review()
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied')
    })
    await user.click(screen.getByRole('button', { name: 'Replace resume' }))
    expect(screen.getByRole('alert')).toHaveTextContent('could not be saved')
    expect(resumeDoc.current.profile.text.en.name).toBe('Aditya Prayoga')
    expect(screen.getByRole('heading', { name: 'Review PDF import' })).toBeInTheDocument()
  })

  it('leaves a suspended inline edit and its draft untouched when cancelled', async () => {
    service()
    editing.enter()
    editing.begin({ kind: 'field', ref: { owner: 'profile', key: 'name' } })
    editing.setDraft('profile.name', 'Unsaved draft')
    editing.suspend()
    const draftBefore = $state.snapshot(editing.active)
    const { closed } = mount()
    const user = await review()
    await user.clear(screen.getByLabelText('Name'))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(closed).toHaveBeenCalledOnce()
    expect($state.snapshot(editing.active)).toEqual(draftBefore)
    expect(editing.suspended).toBe(true)
  })

  it('does not discard the review on Escape or a backdrop click', async () => {
    service()
    const { closed, container } = mount()
    const user = await review()
    await user.type(screen.getByLabelText('Name'), ' edited')
    await user.keyboard('{Escape}')
    await user.click(container.querySelector('.drawer-overlay')!)
    expect(closed).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Name')).toHaveValue('Jane Doe edited')
  })

  it('shows recognition warnings', async () => {
    const extraction = english()
    extraction.blocks.push({ id: 'b21', page: 1, label: 'section_header', group: null, text: 'Certifications', bbox: null })
    extraction.blocks.push({ id: 'b22', page: 1, label: 'text', group: null, text: 'Cloud Practitioner, 2022', bbox: null })
    service(extraction)
    mount()
    await review()
    expect(screen.getByText(/certifications or languages, are not supported/)).toBeInTheDocument()
  })
})
