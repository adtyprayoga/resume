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

describe('sample disclaimer', () => {
  const disclaimer = 'Disclaimer: The resume information displayed on this page is fictitious and is used only for style and function demonstration.'

  it('shows a print-hidden note beside the save status even after the introduction is dismissed', async () => {
    render(App)
    prefs.introDismissed = true
    prefs.saveStatus = { kind: 'saved', at: Date.now() }
    await tick()

    const note = screen.getByText(disclaimer)
    const status = screen.getByRole('status', { name: 'Status' })
    expect(note.closest('.app-header')).toBe(status.closest('.app-header'))
    expect(note.closest('[data-print-hide]')).not.toBeNull()
    expect(status).toHaveTextContent('Saved in this browser')
    expect(status).not.toContainElement(note)
  })

  it('removes the disclaimer when the sample becomes a personal resume', async () => {
    render(App)
    expect(screen.getByText(disclaimer)).toBeInTheDocument()
    resumeDoc.current.profile.text.en.name = 'My own resume'
    await tick()
    expect(screen.queryByText(disclaimer)).not.toBeInTheDocument()
  })

  it('translates the disclaimer with the interface language', () => {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify({ uiLocale: 'id', documentLocale: 'en' }))
    render(App)
    expect(screen.getByText('Penafian: Informasi resume yang ditampilkan di halaman ini bersifat fiktif dan hanya digunakan untuk demonstrasi tampilan dan fungsi.')).toBeInTheDocument()
  })
})

describe('toolbar actions', () => {
  const NAMES = ['Undo', 'Redo', 'Tell my story', 'Sections', 'Edit', 'Upload', 'Export', 'Settings']

  it('offers eight labelled actions in order', () => {
    render(App)
    const buttons = within(toolbar()).getAllByRole('button')
    expect(buttons.map((button) => button.getAttribute('aria-label'))).toEqual(NAMES)
    for (const button of buttons) expect(button.querySelector('svg')).not.toBeNull()
  })

  it('translates the action names with the interface language', () => {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify({ uiLocale: 'id', documentLocale: 'en' }))
    render(App)
    const names = within(screen.getByRole('toolbar', { name: 'Tindakan resume' })).getAllByRole('button').map((button) => button.getAttribute('aria-label'))
    expect(names).toEqual(['Batalkan', 'Ulangi', 'Ceritakan kisahku', 'Bagian', 'Sunting', 'Unggah', 'Ekspor', 'Pengaturan'])
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
    for (const name of NAMES) {
      const button = within(toolbar()).getByRole('button', { name })
      expect(button.textContent?.trim()).toBe('')
      const tip = document.getElementById(button.getAttribute('aria-describedby')!)
      expect(tip).toHaveTextContent(name)
      expect(tip).toHaveAttribute('role', 'tooltip')
    }
  })

  it('explains how to edit in Edit mode', async () => {
    render(App)
    expect(screen.queryByText(/Select outlined text to edit/)).toBeNull()
    await userEvent.setup().click(within(toolbar()).getByRole('button', { name: 'Edit' }))
    expect(screen.getByText(/Select outlined text to edit/).closest('[data-print-hide]')).not.toBeNull()
  })

  it('opens the existing import review dialog from the upload action', async () => {
    render(App)
    const user = userEvent.setup()
    await user.click(within(toolbar()).getByRole('button', { name: 'Upload' }))
    await user.click(screen.getByRole('menuitem', { name: 'Upload JSON' }))
    expect(screen.getByRole('dialog', { name: 'Import resume JSON' })).toBeInTheDocument()
  })

  it('restores focus to the upload action and keeps the open draft after closing Import', async () => {
    render(App)
    const user = userEvent.setup()
    editing.enter()
    editing.begin({ kind: 'field', ref: { owner: 'profile', key: 'name' } })
    editing.setDraft('profile.name', 'Draft')
    await user.click(within(toolbar()).getByRole('button', { name: 'Upload' }))
    await user.click(screen.getByRole('menuitem', { name: 'Upload JSON' }))
    await user.click(within(screen.getByRole('dialog', { name: 'Import resume JSON' })).getByRole('button', { name: 'Close' }))
    expect(within(toolbar()).getByRole('button', { name: 'Upload' })).toHaveFocus()
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

describe('export menu', () => {
  const exportButton = () => within(toolbar()).getByRole('button', { name: 'Export' })

  it('opens exactly two options from a click', async () => {
    render(App)
    const user = userEvent.setup()
    expect(exportButton()).toHaveAttribute('aria-haspopup', 'menu')
    await user.click(exportButton())
    const menu = screen.getByRole('menu', { name: 'Export' })
    expect(within(menu).getAllByRole('menuitem').map((item) => item.textContent?.trim())).toEqual(['Export PDF', 'Export JSON'])
    expect(exportButton()).toHaveAttribute('aria-expanded', 'true')
  })

  it('moves with arrows, Home and End, and closes on Escape', async () => {
    render(App)
    const user = userEvent.setup()
    exportButton().focus()
    await user.keyboard('{ArrowDown}')
    const items = within(screen.getByRole('menu', { name: 'Export' })).getAllByRole('menuitem')
    expect(items[0]).toHaveFocus()
    await user.keyboard('{ArrowDown}')
    expect(items[1]).toHaveFocus()
    await user.keyboard('{ArrowDown}')
    expect(items[0]).toHaveFocus()
    await user.keyboard('{ArrowUp}')
    expect(items[1]).toHaveFocus()
    await user.keyboard('{Home}')
    expect(items[0]).toHaveFocus()
    await user.keyboard('{End}')
    expect(items[1]).toHaveFocus()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(exportButton()).toHaveFocus()
    expect(exportButton()).toHaveAttribute('aria-expanded', 'false')
  })

  it('closes on Tab', async () => {
    render(App)
    const user = userEvent.setup()
    exportButton().focus()
    await user.keyboard('{ArrowDown}')
    await user.keyboard('{Tab}')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('closes on a click outside it', async () => {
    render(App)
    const user = userEvent.setup()
    await user.click(exportButton())
    await user.click(document.querySelector<HTMLElement>('.preview-container')!)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
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
    await user.click(exportButton())
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
    await user.click(exportButton())
    await user.click(screen.getByRole('menuitem', { name: 'Export PDF' }))
    await vi.waitFor(() => expect(printedName).toBe('Printed Draft'))
  })
})

describe('settings panel', () => {
  const openSettings = async () => {
    const user = userEvent.setup()
    await user.click(within(toolbar()).getByRole('button', { name: 'Settings' }))
    return { user, dialog: screen.getByRole('complementary', { name: 'Settings' }) }
  }

  it('holds the document and application settings', async () => {
    render(App)
    const { dialog } = await openSettings()
    expect(within(dialog).getByRole('group', { name: 'Interface language' })).toBeInTheDocument()
    expect(within(dialog).getByRole('group', { name: 'Resume language' })).toBeInTheDocument()
    expect(within(dialog).getByRole('group', { name: 'Font size' })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Page breaks' })).toBeInTheDocument()
        expect(within(dialog).getByRole('button', { name: 'Reset to sample' })).toBeInTheDocument()
    expect(within(dialog).getByText(/choose A4/)).toBeInTheDocument()
  })

  it('closes on Escape and returns focus to the Settings action', async () => {
    render(App)
    const { user } = await openSettings()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('complementary', { name: 'Settings' })).not.toBeInTheDocument()
    expect(within(toolbar()).getByRole('button', { name: 'Settings' })).toHaveFocus()
  })

  it('closes from its Close button', async () => {
    render(App)
    const { user, dialog } = await openSettings()
    await user.click(within(dialog).getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('complementary', { name: 'Settings' })).not.toBeInTheDocument()
  })

  it('applies the active draft on opening and never suspends editing', async () => {
    render(App)
    editing.enter()
    editing.begin({ kind: 'field', ref: { owner: 'profile', key: 'name' } })
    editing.setDraft('profile.name', 'Applied')
    await openSettings()
    expect(editing.suspended).toBe(false)
    expect(editing.active).toBeNull()
    expect(resumeDoc.current.profile.text.en.name).toBe('Applied')
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

describe('section settings inside the Sections panel', () => {
  const openSections = async () => {
    const user = userEvent.setup()
    await user.click(within(toolbar()).getByRole('button', { name: 'Sections' }))
    return { user, panel: screen.getByRole('complementary', { name: 'Sections' }) }
  }

  it('reorders a section from the keyboard and announces each handle position', async () => {
    render(App)
    const { user, panel } = await openSections()
    const before = resumeDoc.current.sections.map((section) => section.kind)
    within(panel).getByRole('button', { name: 'Reorder Experience, position 1 of 7' }).focus()
    await user.keyboard('{ArrowDown}')
    expect(resumeDoc.current.sections.map((section) => section.kind)).toEqual([before[1], before[0], ...before.slice(2)])
  })

  it('hides a section from the paper when switched off', async () => {
    render(App)
    const { user, panel } = await openSections()
    await user.click(within(panel).getByRole('checkbox', { name: /Awards/ }))
    expect(resumeDoc.current.sections.find((section) => section.kind === 'awards')?.enabled).toBe(false)
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

describe('undo and redo', () => {
  const undoButton = () => within(toolbar()).getByRole('button', { name: 'Undo' })
  const redoButton = () => within(toolbar()).getByRole('button', { name: 'Redo' })

  it('shows Undo and Redo, unavailable until there is history', async () => {
    render(App)
    expect(undoButton()).toHaveAttribute('aria-disabled', 'true')
    expect(redoButton()).toHaveAttribute('aria-disabled', 'true')
    resumeDoc.addItem('skills')
    await tick()
    expect(undoButton()).not.toHaveAttribute('aria-disabled')
    const count = resumeDoc.current.content.skills.length
    await userEvent.setup().click(undoButton())
    expect(resumeDoc.current.content.skills).toHaveLength(count - 1)
    expect(redoButton()).not.toHaveAttribute('aria-disabled')
  })

  it.each([false, true])('undoes the first changed draft with exhausted history: %s', async (exhausted) => {
    render(App)
    if (exhausted) {
      resumeDoc.addItem('skills')
      resumeDoc.undo()
    }
    const original = resumeDoc.current.profile.text.en.name
    editing.enter()
    editing.begin({ kind: 'field', ref: { owner: 'profile', key: 'name' } })
    await tick()
    expect(undoButton()).toHaveAttribute('aria-disabled', 'true')
    editing.setDraft('profile.name', 'Changed name')
    await tick()
    expect(resumeDoc.canUndo).toBe(false)
    expect(undoButton()).not.toHaveAttribute('aria-disabled')
    await userEvent.setup().click(undoButton())
    expect(editing.active).toBeNull()
    expect(resumeDoc.current.profile.text.en.name).toBe(original)
    expect(resumeDoc.canRedo).toBe(true)
    await userEvent.setup().click(redoButton())
    expect(resumeDoc.current.profile.text.en.name).toBe('Changed name')
  })

  it('does nothing when an unavailable button is clicked', async () => {
    render(App)
    const before = resumeDoc.generation
    await userEvent.setup().click(undoButton())
    expect(resumeDoc.generation).toBe(before)
  })

  it('Ctrl+Z undoes a section toggle while focus stays on the checkbox', async () => {
    render(App)
    const user = userEvent.setup()
    await user.click(within(toolbar()).getByRole('button', { name: 'Sections' }))
    const panel = screen.getByRole('complementary', { name: 'Sections' })
    const checkbox = within(panel).getByRole('checkbox', { name: /Awards/ })
    await user.click(checkbox)
    expect(checkbox).toHaveFocus()
    expect(resumeDoc.current.sections.find((section) => section.kind === 'awards')?.enabled).toBe(false)
    await user.keyboard('{Control>}z{/Control}')
    expect(resumeDoc.current.sections.find((section) => section.kind === 'awards')?.enabled).toBe(true)
    await user.keyboard('{Control>}{Shift>}z{/Shift}{/Control}')
    expect(resumeDoc.current.sections.find((section) => section.kind === 'awards')?.enabled).toBe(false)
  })

  it('Ctrl+Z inside a text field is left to the browser', async () => {
    render(App)
    resumeDoc.addItem('skills')
    const field = document.createElement('input')
    document.body.append(field)
    field.focus()
    const event = new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true, cancelable: true })
    field.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(false)
    expect(resumeDoc.canUndo).toBe(true)
    field.remove()
  })

  it('the shortcut is off while the Import dialog is open', async () => {
    render(App)
    const user = userEvent.setup()
    resumeDoc.addItem('skills')
    await user.click(within(toolbar()).getByRole('button', { name: 'Upload' }))
    await user.click(screen.getByRole('menuitem', { name: 'Upload JSON' }))
    expect(screen.getByRole('dialog', { name: 'Import resume JSON' })).toBeInTheDocument()
    await user.keyboard('{Control>}z{/Control}')
    expect(resumeDoc.canUndo).toBe(true)
  })

  it('the shortcut is off while any modal dialog is open', async () => {
    render(App)
    resumeDoc.addItem('skills')
    const modal = document.createElement('div')
    modal.setAttribute('role', 'dialog')
    modal.setAttribute('aria-modal', 'true')
    modal.innerHTML = '<input type="checkbox" aria-label="Present">'
    document.body.append(modal)
    modal.querySelector('input')!.focus()
    await userEvent.setup().keyboard('{Control>}z{/Control}')
    expect(resumeDoc.canUndo).toBe(true)
    modal.remove()
  })
})

describe('story lamp integration', () => {
  it('acknowledges gaps, persists attention, isolates the modal, and restores focus to Undo', async () => {
    render(App)
    const user = userEvent.setup()
    const lamp = within(toolbar()).getByRole('button', { name: 'Tell my story' })
    expect(lamp).toHaveClass('pulse')
    expect(within(toolbar()).getByRole('button', { name: 'Sections' }).parentElement).toHaveClass('row-start')
    resumeDoc.change(() => { resumeDoc.current.contact.phone = '123456' })
    await user.click(lamp)
    expect(lamp).not.toHaveClass('pulse')
    // Svelte sets the inert property; jsdom does not reflect it to an attribute.
    expect((lamp.closest('.app-shell') as HTMLElement & { inert: boolean }).inert).toBe(true)
    expect(screen.queryByRole('toolbar')).not.toBeInTheDocument()
    const snapshot = JSON.stringify(resumeDoc.snapshot())
    await user.keyboard('{Control>}z{/Control}')
    expect(JSON.stringify(resumeDoc.snapshot())).toBe(snapshot)
    await tick()
    const saved = JSON.parse(localStorage.getItem(PREFERENCES_KEY)!)
    expect(saved.storyAttention.en.seen).toEqual(saved.storyAttention.en.present)
    expect(saved.storyAttention.id.seen).toEqual([])
    await user.keyboard('{Escape}')
    expect(within(toolbar()).getByRole('button', { name: 'Undo' })).toHaveFocus()
    expect((lamp.closest('.app-shell') as HTMLElement & { inert: boolean }).inert).toBe(false)
  })

  it('restarts only the icon for recurring and additional unseen gaps', async () => {
    render(App)
    const user = userEvent.setup()
    const lamp = within(toolbar()).getByRole('button', { name: 'Tell my story' })
    await user.click(lamp)
    await user.keyboard('{Escape}')
    resumeDoc.change(() => { resumeDoc.current.profile.text.en.headline += ' | Systems | Mentor' })
    await tick()
    resumeDoc.undo()
    await tick()
    expect(lamp).toHaveClass('pulse')
    lamp.focus()
    const icon = lamp.querySelector('svg')
    resumeDoc.change(() => { resumeDoc.current.contact.email = '' })
    await tick()
    expect(within(toolbar()).getByRole('button', { name: 'Tell my story' })).toBe(lamp)
    expect(lamp.querySelector('svg')).not.toBe(icon)
    expect(lamp).toHaveFocus()
  })

  it('restores seen gaps on reload, keeps locale attention separate, resets replacement, and unsubscribes', async () => {
    const app = render(App)
    const user = userEvent.setup()
    await user.click(within(toolbar()).getByRole('button', { name: 'Tell my story' }))
    await user.keyboard('{Escape}')
    app.unmount()
    const again = render(App)
    expect(within(toolbar()).getByRole('button', { name: 'Tell my story' })).not.toHaveClass('pulse')
    prefs.documentLocale = 'id'
    await tick()
    expect(within(toolbar()).getByRole('button', { name: 'Tell my story' })).toHaveClass('pulse')
    prefs.documentLocale = 'en'
    resumeDoc.replace(resumeDoc.snapshot())
    await tick()
    expect(within(toolbar()).getByRole('button', { name: 'Tell my story' })).toHaveClass('pulse')
    again.unmount()
    const attention = JSON.stringify(prefs.storyAttention)
    resumeDoc.change(() => { resumeDoc.current.contact.email = '' })
    expect(JSON.stringify(prefs.storyAttention)).toBe(attention)
  })

  it('hides the lamp without a name or gaps', async () => {
    render(App)
    resumeDoc.change(() => {
      resumeDoc.current.profile.text.en.name = ''
      resumeDoc.current.profile.text.id.name = ''
    })
    await tick()
    expect(screen.queryByRole('button', { name: 'Tell my story' })).not.toBeInTheDocument()
    resumeDoc.change(() => {
      for (const locale of ['en', 'id'] as const) {
        Object.assign(resumeDoc.current.profile.text[locale], {
          name: 'Ayu', headline: 'Engineer | Mentor | Builder', location: 'Bandung',
          summary: '8 years of experience ' + 'working with teams to deliver useful systems. '.repeat(8),
        })
      }
      Object.assign(resumeDoc.current.contact, { email: 'a@example.com', phone: '123', linkedin: 'https://linkedin.com/in/a' })
      resumeDoc.current.sections.forEach(s => { s.enabled = false })
    })
    await tick()
    expect(screen.queryByRole('button', { name: 'Tell my story' })).not.toBeInTheDocument()
  })

  it('clears the print-hidden highlight notice after writing', async () => {
    render(App)
    const user = userEvent.setup()
    await user.click(within(toolbar()).getByRole('button', { name: 'Tell my story' }))
    await user.click(screen.getByRole('button', { name: 'Turn the page' }))
    await user.type(screen.getByRole('textbox', { name: /years/i }), '8')
    await user.click(screen.getByRole('button', { name: 'Write it in and turn the page' }))
    await user.keyboard('{Escape}')
    const note = screen.getByText('Highlighted text was written by the storyteller.')
    expect(note.closest('[data-print-hide]')).not.toBeNull()
    await user.click(screen.getByRole('button', { name: 'Clear highlights' }))
    expect(note).not.toBeInTheDocument()
  })
})
