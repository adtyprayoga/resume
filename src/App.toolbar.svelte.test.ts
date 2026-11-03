import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { tick } from 'svelte'
import App from './App.svelte'
import { editing } from '$lib/state/editing.svelte'
import { resumeDoc } from '$lib/state/document.svelte'
import { prefs } from '$lib/state/preferences.svelte'
import { PREFERENCES_KEY } from '$lib/storage/persist'
import { defaultTheme } from '$lib/themes/index'

beforeEach(() => {
  localStorage.clear()
  editing.reset()
  prefs.themeKey = defaultTheme.key
  prefs.uiLocale = 'en'
  prefs.documentLocale = 'en'
  prefs.saveStatus = { kind: 'idle' }
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

const toolbar = () => screen.getByRole('toolbar', { name: 'Resume actions' })

describe('toolbar actions', () => {
  it('offers three labelled actions', () => {
    render(App)
    const buttons = within(toolbar()).getAllByRole('button')
    expect(buttons.map((button) => button.getAttribute('aria-label'))).toEqual(['Edit', 'Save as PDF', 'More'])
    for (const button of buttons) expect(button.querySelector('svg')).not.toBeNull()
  })

  it('translates the action names with the interface language', () => {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify({ uiLocale: 'id', documentLocale: 'en' }))
    render(App)
    const names = within(screen.getByRole('toolbar', { name: 'Tindakan resume' })).getAllByRole('button').map((button) => button.getAttribute('aria-label'))
    expect(names).toEqual(['Sunting', 'Simpan sebagai PDF', 'Lainnya'])
  })

  it('keeps Edit primary and updates its accessible name', async () => {
    render(App)
    const edit = within(toolbar()).getByRole('button', { name: 'Edit' })
    expect(edit).toHaveClass('primary')
    expect(edit).toHaveAccessibleName('Edit')
    await userEvent.setup().click(edit)
    expect(within(toolbar()).getByRole('button', { name: 'Done' })).toHaveAccessibleName('Done')
  })

  it('uses icons with translated tooltips for every action', () => {
    render(App)
    for (const name of ['Edit', 'Save as PDF', 'More']) {
      const button = within(toolbar()).getByRole('button', { name })
      expect(button.textContent?.trim()).toBe('')
      expect(document.getElementById(button.getAttribute('aria-describedby')!)).toHaveTextContent(name)
    }
  })

  it('explains how to edit in Edit mode', async () => {
    render(App)
    expect(screen.queryByText(/Select outlined text to edit/)).toBeNull()
    await userEvent.setup().click(within(toolbar()).getByRole('button', { name: 'Edit' }))
    expect(screen.getByText(/Select outlined text to edit/).closest('[data-print-hide]')).not.toBeNull()
  })

  it('shows a tooltip naming each action', () => {
    render(App)
    const settings = within(toolbar()).getByRole('button', { name: 'More' })
    const tip = document.getElementById(settings.getAttribute('aria-describedby') ?? '')
    expect(tip).toHaveTextContent('More')
    expect(tip).toHaveAttribute('role', 'tooltip')
  })

  it('opens the existing import review dialog', async () => {
    render(App)
    const user = userEvent.setup()
    await user.click(within(toolbar()).getByRole('button', { name: 'More' }))
    await user.click(screen.getByRole('menuitem', { name: 'Import JSON' }))
    expect(screen.getByRole('dialog', { name: 'Import resume JSON' })).toBeInTheDocument()
  })

  it('restores focus and the open draft after closing Import', async () => {
    render(App)
    const user = userEvent.setup()
    editing.enter()
    editing.begin({ kind: 'field', ref: { owner: 'profile', key: 'name' } })
    editing.setDraft('profile.name', 'Draft')
    await user.click(within(toolbar()).getByRole('button', { name: 'More' }))
    await user.click(screen.getByRole('menuitem', { name: 'Import JSON' }))
    await user.click(within(screen.getByRole('dialog', { name: 'Import resume JSON' })).getByRole('button', { name: 'Close' }))
    expect(within(toolbar()).getByRole('button', { name: 'More' })).toHaveFocus()
    expect(editing.active).not.toBeNull()
    expect(editing.suspended).toBe(false)
  })

  it('toggles between Edit and Done', async () => {
    render(App)
    const user = userEvent.setup()
    await user.click(within(toolbar()).getByRole('button', { name: 'Edit' }))
    expect(editing.mode).toBe('edit')
    await user.click(within(toolbar()).getByRole('button', { name: 'Done' }))
    expect(editing.mode).toBe('preview')
  })

  it('commits the active draft when Done is pressed', async () => {
    render(App)
    const user = userEvent.setup()
    await user.click(within(toolbar()).getByRole('button', { name: 'Edit' }))
    editing.begin({ kind: 'field', ref: { owner: 'profile', key: 'headline' } })
    editing.setDraft('profile.headline', 'Committed by Done')
    await user.click(within(toolbar()).getByRole('button', { name: 'Done' }))
    expect(resumeDoc.current.profile.text.en.headline).toBe('Committed by Done')
  })
})

describe('more menu', () => {
  it('opens from the keyboard, moves with arrows, and closes on Escape', async () => {
    render(App)
    const user = userEvent.setup()
    const button = within(toolbar()).getByRole('button', { name: 'More' })
    expect(button).toHaveAttribute('aria-haspopup', 'menu')
    button.focus()
    await user.keyboard('{ArrowDown}')
    const menu = screen.getByRole('menu', { name: 'More' })
    const items = within(menu).getAllByRole('menuitem')
    expect(items.map((item) => item.textContent?.trim())).toEqual(['Import JSON', 'Export JSON', 'Settings'])
    expect(button).toHaveAttribute('aria-expanded', 'true')
    expect(items[0]).toHaveFocus()
    await user.keyboard('{ArrowDown}')
    expect(items[1]).toHaveFocus()
    await user.keyboard('{ArrowDown}')
    expect(items[2]).toHaveFocus()
    await user.keyboard('{ArrowDown}')
    expect(items[0]).toHaveFocus()
    await user.keyboard('{ArrowUp}')
    expect(items[2]).toHaveFocus()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(button).toHaveFocus()
  })

  it('exports JSON after committing the active draft', async () => {
    const created: Blob[] = []
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => { created.push(blob as Blob); return 'blob:x' })
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    render(App)
    const user = userEvent.setup()
    editing.enter()
    editing.begin({ kind: 'field', ref: { owner: 'profile', key: 'name' } })
    editing.setDraft('profile.name', 'Exported Draft')
    await user.click(within(toolbar()).getByRole('button', { name: 'More' }))
    await user.click(screen.getByRole('menuitem', { name: 'Export JSON' }))
    expect(created).toHaveLength(1)
    expect(await created[0]!.text()).toContain('Exported Draft')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('prints after committing and rendering the active draft', async () => {
    let printedName = ''
    vi.stubGlobal('print', () => { printedName = document.querySelector('.resume-name')?.textContent ?? '' })
    render(App)
    const user = userEvent.setup()
    editing.enter()
    editing.begin({ kind: 'field', ref: { owner: 'profile', key: 'name' } })
    editing.setDraft('profile.name', 'Printed Draft')
    await user.click(within(toolbar()).getByRole('button', { name: 'Save as PDF' }))
    await vi.waitFor(() => expect(printedName).toBe('Printed Draft'))
  })
})

describe('settings panel', () => {
  const openSettings = async () => {
    const user = userEvent.setup()
    await user.click(within(toolbar()).getByRole('button', { name: 'More' }))
    await user.click(screen.getByRole('menuitem', { name: 'Settings' }))
    return { user, dialog: screen.getByRole('dialog', { name: 'Settings' }) }
  }

  it('holds the document and application settings', async () => {
    render(App)
    const { dialog } = await openSettings()
    expect(within(dialog).getByRole('group', { name: 'Interface language' })).toBeInTheDocument()
    expect(within(dialog).getByRole('group', { name: 'Resume language' })).toBeInTheDocument()
    expect(within(dialog).getByRole('group', { name: 'Font size' })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Page breaks' })).toBeInTheDocument()
    expect(within(dialog).getAllByRole('button', { name: /^Reorder / })).toHaveLength(5)
    expect(within(dialog).getByRole('button', { name: 'Reset to sample' })).toBeInTheDocument()
    expect(within(dialog).getByText(/choose A4/)).toBeInTheDocument()
  })

  it('closes on Escape and returns focus to the Settings action', async () => {
    render(App)
    const { user } = await openSettings()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: 'Settings' })).not.toBeInTheDocument()
    expect(within(toolbar()).getByRole('button', { name: 'More' })).toHaveFocus()
  })

  it('closes from its Close button', async () => {
    render(App)
    const { user, dialog } = await openSettings()
    await user.click(within(dialog).getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog', { name: 'Settings' })).not.toBeInTheDocument()
  })

  it('suspends the active draft while open and resumes it after', async () => {
    render(App)
    editing.enter()
    editing.begin({ kind: 'field', ref: { owner: 'profile', key: 'name' } })
    editing.setDraft('profile.name', 'Waiting')
    const { user } = await openSettings()
    expect(editing.suspended).toBe(true)
    await user.keyboard('{Escape}')
    expect(editing.suspended).toBe(false)
    expect(editing.active?.draft['profile.name']).toBe('Waiting')
  })

  it('commits the draft before switching the resume language', async () => {
    render(App)
    editing.enter()
    editing.begin({ kind: 'field', ref: { owner: 'profile', key: 'name' } })
    editing.setDraft('profile.name', 'English Draft')
    const { user, dialog } = await openSettings()
    await user.click(within(dialog).getByRole('button', { name: 'Resume language: Indonesian' }))
    expect(prefs.documentLocale).toBe('id')
    expect(resumeDoc.current.profile.text.en.name).toBe('English Draft')
    expect(editing.active).toBeNull()
  })

  it('asks for confirmation before resetting', async () => {
    render(App)
    resumeDoc.current.profile.text.en.name = 'Mine'
    const { user, dialog } = await openSettings()
    await user.click(within(dialog).getByRole('button', { name: 'Reset to sample' }))
    expect(resumeDoc.current.profile.text.en.name).toBe('Mine')
    await user.click(within(dialog).getByRole('button', { name: 'Confirm reset' }))
    expect(resumeDoc.current.profile.text.en.name).toBe('Aditya Prayoga')
  })

  it('asks for confirmation before starting blank', async () => {
    render(App)
    const { user, dialog } = await openSettings()
    await user.click(within(dialog).getByRole('button', { name: 'Start blank' }))
    expect(resumeDoc.current.profile.text.en.name).toBe('Aditya Prayoga')
    await user.click(within(dialog).getByRole('button', { name: 'Confirm: erase and start blank' }))
    expect(resumeDoc.current.profile.text.en.name).toBe('')
    expect(resumeDoc.current.content.experience).toHaveLength(0)
  })

  it('discards an open draft when starting blank', async () => {
    render(App)
    editing.enter()
    editing.begin({ kind: 'field', ref: { owner: 'profile', key: 'name' } })
    editing.setDraft('profile.name', 'Draft')
    const { user, dialog } = await openSettings()
    await user.click(within(dialog).getByRole('button', { name: 'Start blank' }))
    await user.click(within(dialog).getByRole('button', { name: 'Confirm: erase and start blank' }))
    await user.click(within(dialog).getByRole('button', { name: 'Close' }))
    expect(resumeDoc.current.profile.text.en.name).toBe('')
    expect(editing.active).toBeFalsy()
  })
})

describe('status', () => {
  const status = () => screen.getByRole('status', { name: 'Status' })

  it('never shows the mode', async () => {
    render(App)
    await userEvent.setup().click(within(toolbar()).getByRole('button', { name: 'Edit' }))
    expect(status()).not.toHaveTextContent('Preview')
    expect(status()).not.toHaveTextContent('Editing')
  })

  it('shows Indonesian status text', async () => {
    render(App)
    prefs.uiLocale = 'id'
    prefs.saveStatus = { kind: 'saved', at: Date.now() }
    await tick()
    expect(screen.getByRole('status', { name: 'Status' })).toHaveTextContent('Tersimpan di browser ini')
  })

  it('never calls an uncommitted draft saved', async () => {
    render(App)
    prefs.saveStatus = { kind: 'saved', at: Date.now() }
    prefs.changeSaved = true
    await tick()
    expect(status()).toHaveTextContent('Saved in this browser')
    editing.enter()
    editing.begin({ kind: 'field', ref: { owner: 'profile', key: 'name' } })
    await tick()
    expect(status()).toHaveTextContent('Change not applied yet')
    expect(status()).not.toHaveTextContent('Saved')
  })

  it('shows a save error in the workspace', async () => {
    render(App)
    prefs.saveStatus = { kind: 'error', message: 'x', messageKey: 'error.storageQuota' }
    await tick()
    expect(screen.getByText(/Out of browser storage/)).toBeInTheDocument()
  })
})

describe('section settings inside Settings', () => {
  const openSettings = async () => {
    const user = userEvent.setup()
    await user.click(within(toolbar()).getByRole('button', { name: 'More' }))
    await user.click(screen.getByRole('menuitem', { name: 'Settings' }))
    return { user, dialog: screen.getByRole('dialog', { name: 'Settings' }) }
  }

  it('reorders a section from the keyboard and announces each handle position', async () => {
    render(App)
    const { user, dialog } = await openSettings()
    const before = resumeDoc.current.sections.map((section) => section.kind)
    within(dialog).getByRole('button', { name: 'Reorder Experience, position 1 of 5' }).focus()
    await user.keyboard('{ArrowDown}')
    expect(resumeDoc.current.sections.map((section) => section.kind)).toEqual([before[1], before[0], ...before.slice(2)])
  })

  it('hides a section from the paper when switched off', async () => {
    render(App)
    const { user, dialog } = await openSettings()
    await user.click(within(dialog).getByRole('checkbox', { name: /Awards/ }))
    expect(resumeDoc.current.sections.find((section) => section.kind === 'awards')?.enabled).toBe(false)
    await user.keyboard('{Escape}')
    expect([...document.querySelectorAll('.resume-paper h2')].map((h) => h.textContent)).not.toContain('Awards')
  })
})

describe('Indonesian interface while editing an English resume', () => {
  it('translates targets, forms and actions without changing resume content', async () => {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify({ uiLocale: 'id', documentLocale: 'en' }))
    render(App)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Sunting' }))
    const paper = document.querySelector<HTMLElement>('.resume-paper')!
    expect(paper).toHaveAttribute('lang', 'en')
    expect(within(paper).getByRole('button', { name: 'Tambah entri ke Pengalaman Kerja' })).toHaveTextContent('+ Tambah entri')
    await user.click(within(paper).getByRole('button', { name: 'Sunting Telepon: +62 811 2345 678' }))
    const form = screen.getByRole('form', { name: 'Telepon' })
    expect(within(form).getByText('kedua bahasa')).toBeInTheDocument()
    expect(within(form).getByRole('button', { name: 'Terapkan' })).toBeInTheDocument()
    expect(within(form).getByRole('button', { name: 'Batal' })).toBeInTheDocument()
  })
})
