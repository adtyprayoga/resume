import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { tick } from 'svelte'
import App from '../../App.svelte'
import { editing } from '$lib/state/editing.svelte'
import { resumeDoc } from '$lib/state/document.svelte'
import { prefs } from '$lib/state/preferences.svelte'
import { defaultTheme } from '$lib/themes/index'
import { DOCUMENT_KEY } from '$lib/storage/persist'
import { serializeResume } from '$lib/io/exportJson'
import { sampleDocument } from '../../data/sample'

const paper = () => document.querySelector<HTMLElement>('.resume-paper')!

beforeEach(() => {
  localStorage.clear()
  editing.reset()
  prefs.themeKey = defaultTheme.key
  prefs.uiLocale = 'en'
  prefs.documentLocale = 'en'
})

afterEach(() => editing.reset())

const startEditing = async () => {
  const user = userEvent.setup()
  render(App)
  await user.click(screen.getByRole('button', { name: 'Edit' }))
  return user
}

const seed = (change: (doc: ReturnType<typeof sampleDocument>) => void) => {
  const doc = sampleDocument()
  change(doc)
  localStorage.setItem(DOCUMENT_KEY, serializeResume(doc))
}

describe('preview mode', () => {
  it('exposes no edit targets or prompts', () => {
    seed((doc) => { doc.profile.text.en.headline = ''; doc.profile.text.id.headline = '' })
    render(App)
    expect(paper().querySelectorAll('[data-edit-key]')).toHaveLength(0)
    expect(within(paper()).queryAllByRole('button')).toHaveLength(0)
    expect(within(paper()).queryByText(/Headline/)).not.toBeInTheDocument()
  })
})

describe('inline text editing', () => {
  it('opens a native input over the name, outside the paper', async () => {
    const user = await startEditing()
    await user.click(within(paper()).getByRole('button', { name: 'Edit Name: Budi Santoso' }))
    const input = screen.getByRole('textbox', { name: /^Name/ })
    expect(input.tagName).toBe('INPUT')
    expect(input).toHaveValue('Budi Santoso')
    expect(input).toHaveFocus()
    expect(paper().contains(input)).toBe(false)
  })

  it('applies on Enter and returns focus to the edited text', async () => {
    const user = await startEditing()
    await user.click(within(paper()).getByRole('button', { name: 'Edit Name: Budi Santoso' }))
    const input = screen.getByRole('textbox', { name: /^Name/ })
    await user.clear(input)
    await user.type(input, 'Siti Rahma{Enter}')
    expect(resumeDoc.current.profile.text.en.name).toBe('Siti Rahma')
    expect(screen.queryByRole('textbox', { name: /^Name/ })).not.toBeInTheDocument()
    expect(within(paper()).getByRole('button', { name: 'Edit Name: Siti Rahma' })).toHaveFocus()
  })

  it('cancels on Escape without changing the document', async () => {
    const user = await startEditing()
    const target = within(paper()).getByRole('button', { name: /^Edit Headline/ })
    await user.click(target)
    const input = screen.getByRole('textbox', { name: /^Headline/ })
    await user.clear(input)
    await user.type(input, 'Discard me{Escape}')
    expect(resumeDoc.current.profile.text.en.headline).toBe('Senior Software Engineer')
    expect(screen.queryByRole('textbox', { name: /^Headline/ })).not.toBeInTheDocument()
    expect(within(paper()).getByRole('button', { name: /^Edit Headline/ })).toHaveFocus()
  })

  it('applies on blur', async () => {
    const user = await startEditing()
    await user.click(within(paper()).getByRole('button', { name: 'Edit Location: Jakarta, Indonesia' }))
    const input = screen.getByRole('textbox', { name: /^Location/ })
    await user.clear(input)
    await user.type(input, 'Bandung')
    await user.click(document.body)
    expect(resumeDoc.current.profile.text.en.location).toBe('Bandung')
  })

  it('keeps Enter as a newline in the summary and applies on Ctrl+Enter', async () => {
    const user = await startEditing()
    await user.click(within(paper()).getByRole('button', { name: /^Edit Summary/ }))
    const area = screen.getByRole('textbox', { name: /^Summary/ })
    expect(area.tagName).toBe('TEXTAREA')
    await user.clear(area)
    await user.type(area, 'Line one{Enter}Line two')
    expect(screen.getByRole('textbox', { name: /^Summary/ })).toBeInTheDocument()
    await user.keyboard('{Control>}{Enter}{/Control}')
    expect(resumeDoc.current.profile.text.en.summary).toBe('Line one\nLine two')
  })

  it('applies a multiline draft from its Done button', async () => {
    const user = await startEditing()
    await user.click(within(paper()).getByRole('button', { name: /^Edit Summary/ }))
    const area = screen.getByRole('textbox', { name: /^Summary/ })
    await user.clear(area)
    await user.type(area, 'Short summary')
    await user.click(screen.getByRole('button', { name: 'Apply' }))
    expect(resumeDoc.current.profile.text.en.summary).toBe('Short summary')
  })

  it('writes to the resume language, not the interface language', async () => {
    prefs.documentLocale = 'id'
    const user = await startEditing()
    await user.click(within(paper()).getByRole('button', { name: /^Edit Headline/ }))
    const input = screen.getByRole('textbox', { name: /^Headline/ })
    await user.clear(input)
    await user.type(input, 'Perekayasa Utama{Enter}')
    expect(resumeDoc.current.profile.text.id.headline).toBe('Perekayasa Utama')
    expect(resumeDoc.current.profile.text.en.headline).toBe('Senior Software Engineer')
  })

  it('keeps the raw draft when the interface language changes', async () => {
    const user = await startEditing()
    await user.click(within(paper()).getByRole('button', { name: 'Edit Name: Budi Santoso' }))
    const input = screen.getByRole('textbox', { name: /^Name/ })
    await user.clear(input)
    await user.type(input, 'half, typed ')
    prefs.uiLocale = 'id'
    await tick()
    expect(screen.getByRole('textbox', { name: /^Nama/ })).toHaveValue('half, typed ')
  })

  it('describes whether the field belongs to this language or both', async () => {
    const user = await startEditing()
    await user.click(within(paper()).getByRole('button', { name: 'Edit Name: Budi Santoso' }))
    expect(screen.getByRole('textbox', { name: 'Name · this language' })).toBeInTheDocument()
  })
})

describe('contact details', () => {
  it('opens a small labelled form holding the full stored URL', async () => {
    const user = await startEditing()
    // Classic shows the address without its scheme.
    const target = within(paper()).getByRole('button', { name: 'Edit Website: budisantoso.example.com' })
    await user.click(target)
    const form = screen.getByRole('form', { name: 'Website' })
    expect(paper().contains(form)).toBe(false)
    expect(within(form).getByLabelText(/^Website/)).toHaveValue('https://budisantoso.example.com')
    expect(within(form).getByText('both languages')).toBeInTheDocument()
  })

  it('normalizes a typed address when applied', async () => {
    const user = await startEditing()
    await user.click(within(paper()).getByRole('button', { name: /^Edit GitHub/ }))
    const form = screen.getByRole('form', { name: 'GitHub' })
    const input = within(form).getByLabelText(/^GitHub/)
    await user.clear(input)
    await user.type(input, 'github.com/siti')
    await user.click(within(form).getByRole('button', { name: 'Apply' }))
    expect(resumeDoc.current.contact.github).toBe('https://github.com/siti')
    expect(screen.queryByRole('form', { name: 'GitHub' })).not.toBeInTheDocument()
  })

  it('cancels from the form without writing', async () => {
    const user = await startEditing()
    await user.click(within(paper()).getByRole('button', { name: /^Edit Phone/ }))
    const form = screen.getByRole('form', { name: 'Phone' })
    const input = within(form).getByLabelText(/^Phone/)
    await user.clear(input)
    await user.type(input, '000')
    await user.click(within(form).getByRole('button', { name: 'Cancel' }))
    expect(resumeDoc.current.contact.phone).toBe('+62 811 2345 678')
  })

  it('edits full URLs shown in the ATS layout too', async () => {
    prefs.themeKey = 'ats'
    const user = await startEditing()
    await user.click(within(paper()).getByRole('button', { name: 'Edit LinkedIn: https://linkedin.com/in/example' }))
    expect(within(screen.getByRole('form', { name: 'LinkedIn' })).getByLabelText(/^LinkedIn/)).toHaveValue('https://linkedin.com/in/example')
  })
})

describe('empty fields', () => {
  it('shows a prompt only in Edit mode, hidden from print', async () => {
    seed((doc) => { doc.profile.text.en.headline = ''; doc.profile.text.id.headline = ''; doc.contact.phone = '' })
    const user = await startEditing()
    const headline = within(paper()).getByRole('button', { name: 'Add Headline' })
    expect(headline.closest('[data-print-hide]')).not.toBeNull()
    expect(within(paper()).getByRole('button', { name: 'Add Phone' }).closest('[data-print-hide]')).not.toBeNull()
    await user.click(headline)
    const input = screen.getByRole('textbox', { name: /^Headline/ })
    await user.type(input, 'New headline{Enter}')
    expect(resumeDoc.current.profile.text.en.headline).toBe('New headline')
  })
})

describe('profile details', () => {
  it('edits every profile and contact field from one form', async () => {
    const user = await startEditing()
    await user.click(screen.getByRole('button', { name: 'Profile details' }))
    const form = screen.getByRole('form', { name: 'Profile details' })
    for (const label of ['Name', 'Headline', 'Location', 'Summary', 'Email', 'Phone', 'Website', 'GitHub', 'LinkedIn']) {
      expect(within(form).getByLabelText(new RegExp(`^${label}`))).toBeInTheDocument()
    }
    expect(within(form).getByText('Photo')).toBeInTheDocument()
    await user.clear(within(form).getByLabelText(/^Email/))
    await user.type(within(form).getByLabelText(/^Email/), 'siti@example.com')
    await user.click(within(form).getByRole('button', { name: 'Apply' }))
    expect(resumeDoc.current.contact.email).toBe('siti@example.com')
  })

  it('keeps photo editing reachable in ATS while the paper omits the photo', async () => {
    prefs.themeKey = 'ats'
    const user = await startEditing()
    expect(paper().querySelector('img')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Profile details' }))
    const form = screen.getByRole('form', { name: 'Profile details' })
    await user.click(within(form).getByRole('button', { name: 'Remove' }))
    await user.click(within(form).getByRole('button', { name: 'Apply' }))
    expect(resumeDoc.current.contact.avatar).toBe('')
    expect(paper().querySelector('img')).toBeNull()
  })
})

describe('photo', () => {
  it('opens a draft photo form from the Classic photo', async () => {
    const user = await startEditing()
    await user.click(within(paper()).getByRole('button', { name: 'Edit Photo' }))
    const form = screen.getByRole('form', { name: 'Photo' })
    await user.click(within(form).getByRole('button', { name: 'Remove' }))
    // Only the draft changed.
    expect(resumeDoc.current.contact.avatar).not.toBe('')
    await user.click(within(form).getByRole('button', { name: 'Cancel' }))
    expect(resumeDoc.current.contact.avatar).not.toBe('')
  })

  it('shows a translated error for an unusable file and leaves the photo alone', async () => {
    const before = sampleDocument().contact.avatar
    const user = await startEditing()
    await user.click(within(paper()).getByRole('button', { name: 'Edit Photo' }))
    const form = screen.getByRole('form', { name: 'Photo' })
    await userEvent.setup({ applyAccept: false }).upload(within(form).getByLabelText('Replace'), new File(['x'], 'x.txt', { type: 'text/plain' }))
    expect(within(form).getByText('Choose a PNG, JPEG, WebP or GIF image.')).toBeInTheDocument()
    prefs.uiLocale = 'id'
    await tick()
    expect(within(form).getByText('Pilih gambar PNG, JPEG, WebP, atau GIF.')).toBeInTheDocument()
    await user.click(within(form).getByRole('button', { name: 'Terapkan' }))
    expect(resumeDoc.current.contact.avatar).toBe(before)
  })

  it('offers an add-photo prompt when there is no photo', async () => {
    seed((doc) => { doc.contact.avatar = '' })
    await startEditing()
    expect(within(paper()).getByRole('button', { name: 'Add Photo' }).closest('[data-print-hide]')).not.toBeNull()
  })
})

describe('photo picker', () => {
  it('explains that the photo is embedded because there is no server', async () => {
    const user = await startEditing()
    await user.click(within(paper()).getByRole('button', { name: 'Edit Photo' }))
    const form = screen.getByRole('form', { name: 'Photo' })
    expect(within(form).queryByRole('textbox')).not.toBeInTheDocument()
    expect(within(form).getByText(/no\s+server to upload to/)).toBeInTheDocument()
  })
})
