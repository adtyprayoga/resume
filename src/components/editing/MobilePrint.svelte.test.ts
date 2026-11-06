import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import App from '../../App.svelte'
import { editing } from '$lib/state/editing.svelte'
import { resumeDoc } from '$lib/state/document.svelte'
import { prefs } from '$lib/state/preferences.svelte'
import { defaultTheme } from '$lib/themes/index'

const paper = () => document.querySelector<HTMLElement>('.resume-paper')!

const phone = (matches: boolean) =>
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: matches && query.includes('max-width'),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))

beforeEach(() => {
  localStorage.clear()
  editing.reset()
  prefs.themeKey = defaultTheme.key
  prefs.uiLocale = 'en'
  prefs.documentLocale = 'en'
  prefs.showPageBreaks = true
})

afterEach(() => {
  editing.reset()
  vi.unstubAllGlobals()
})

const startEditing = async () => {
  const user = userEvent.setup()
  render(App)
  await user.click(screen.getByRole('button', { name: 'Edit' }))
  return user
}

describe('phone editing', () => {
  beforeEach(() => phone(true))

  it('opens a tapped field in a bottom sheet instead of over the text', async () => {
    const user = await startEditing()
    await user.click(within(paper()).getByRole('button', { name: 'Edit Headline: Senior Software Engineer' }))
    const sheet = screen.getByRole('dialog', { name: 'Headline' })
    expect(sheet).toHaveAttribute('aria-modal', 'true')
    expect(paper().contains(sheet)).toBe(false)
    expect(sheet.closest('[data-print-hide]')).not.toBeNull()
    const form = within(sheet).getByRole('form', { name: 'Headline' })
    const input = within(form).getByLabelText(/^Headline/)
    expect(input).toHaveFocus()
    await user.clear(input)
    await user.type(input, 'Lead Engineer')
    await user.click(within(form).getByRole('button', { name: 'Apply' }))
    expect(resumeDoc.current.profile.text.en.headline).toBe('Lead Engineer')
    expect(screen.queryByRole('dialog', { name: 'Headline' })).not.toBeInTheDocument()
  })

  it('cancels from the sheet on Escape and restores focus', async () => {
    const user = await startEditing()
    const target = within(paper()).getByRole('button', { name: 'Edit Headline: Senior Software Engineer' })
    await user.click(target)
    await user.type(within(screen.getByRole('dialog')).getByRole('textbox'), ' extra')
    await user.keyboard('{Escape}')
    expect(resumeDoc.current.profile.text.en.headline).toBe('Senior Software Engineer')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(within(paper()).getByRole('button', { name: 'Edit Headline: Senior Software Engineer' })).toHaveFocus()
  })

  it.each(['minimal', 'ats'])('edits a single bullet in the %s phone sheet with Enter', async (theme) => {
    prefs.themeKey = theme
    const user = await startEditing()
    const item = resumeDoc.current.content.experience[1]!
    const before = [...item.text.en.bullets]
    await user.click(within(paper()).getByRole('button', { name: /^Edit Highlights: Cut catalogue/ }))
    const sheet = screen.getByRole('dialog', { name: 'Highlights' })
    const input = within(sheet).getByRole('textbox', { name: /^Highlights/ })
    expect(input).toHaveValue(before[1])
    await user.clear(input)
    await user.type(input, 'Phone edit{Enter}')
    expect(item.text.en.bullets).toEqual([before[0], 'Phone edit'])
    const next = within(screen.getByRole('dialog', { name: 'Highlights' })).getByRole('textbox')
    expect(next).toHaveValue('')
    expect(next).toHaveFocus()
    await user.type(next, 'Next{Alt>}{Enter}{/Alt}line')
    expect(next).toHaveValue('Next\nline')
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(item.text.en.bullets).toEqual([before[0], 'Phone edit'])
    expect(within(paper()).getByRole('button', { name: 'Edit Highlights: Phone edit' })).toHaveFocus()
  })

  it('opens the whole entry in a sheet when tapping between its fields', async () => {
    const user = await startEditing()
    const entry = paper().querySelector<HTMLElement>('[data-entry="experience:exp_sample_1"]')!
    await user.click(entry)
    const sheet = screen.getByRole('dialog', { name: 'Experience' })
    expect(within(sheet).getByLabelText(/^Role/)).toHaveValue('Senior Software Engineer')
  })
})

describe('phone entry actions', () => {
  beforeEach(() => phone(true))

  it('move an entry without also opening its sheet', async () => {
    const user = await startEditing()
    await user.click(paper().querySelector<HTMLElement>('[data-entry="experience:exp_sample_1"]')!)
    await user.click(within(screen.getByRole('dialog', { name: 'Experience' })).getByRole('button', { name: 'Cancel' }))
    const actions = screen.getByRole('group', { name: 'Experience entry 1 of 2' })
    await user.click(within(actions).getByRole('button', { name: 'Move down' }))
    expect(resumeDoc.current.content.experience[1]!.id).toBe('exp_sample_1')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('keyboard access', () => {
  it('opens an editor from focused text with Enter', async () => {
    const user = await startEditing()
    within(paper()).getByRole('button', { name: 'Edit Headline: Senior Software Engineer' }).focus()
    await user.keyboard('{Enter}')
    expect(screen.getByRole('textbox', { name: /^Headline/ })).toHaveFocus()
  })
})

describe('page guides', () => {
  it('show in Preview and hide while editing', async () => {
    const user = userEvent.setup()
    render(App)
    const overlayMounted = () => document.querySelector('.resume-paper-frame [data-page-guides]') !== null
    expect(overlayMounted()).toBe(true)
    await user.click(screen.getByRole('button', { name: 'Edit' }))
    expect(overlayMounted()).toBe(false)
    await user.click(screen.getByRole('button', { name: 'Done' }))
    expect(overlayMounted()).toBe(true)
  })

  it('respect the preference in Preview', () => {
    prefs.showPageBreaks = false
    render(App)
    expect(document.querySelector('[data-page-guides]')).toBeNull()
  })
})

describe('printing', () => {
  it('applies and renders the active draft before native printing', async () => {
    await startEditing()
    editing.begin({ kind: 'field', ref: { owner: 'profile', key: 'name' } })
    editing.setDraft('profile.name', 'Printed From Browser')
    window.dispatchEvent(new Event('beforeprint'))
    expect(resumeDoc.current.profile.text.en.name).toBe('Printed From Browser')
    expect(paper().querySelector('.resume-name')).toHaveTextContent('Printed From Browser')
  })

  it('keeps every editing control out of the printed page', async () => {
    const user = await startEditing()
    await user.click(within(paper()).getByRole('button', { name: 'Edit Role: Senior Software Engineer' }))
    const hidden = (element: Element) => element.closest('[data-print-hide]') !== null
    const controls = [
      ...document.querySelectorAll('[data-edit-surface], .edit-prompt, .entry-actions, .add-entry, .edit-bar, .app-header, [aria-live]'),
    ]
    expect(controls.length).toBeGreaterThan(4)
    expect(controls.filter((element) => !hidden(element))).toEqual([])
  })

  it('stops listening for print once unmounted', async () => {
    const removed = vi.spyOn(window, 'removeEventListener')
    const { unmount } = render(App)
    unmount()
    expect(removed.mock.calls.some((call) => call[0] === 'beforeprint')).toBe(true)
  })
})
