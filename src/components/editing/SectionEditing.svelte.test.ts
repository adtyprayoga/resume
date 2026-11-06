import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import App from '../../App.svelte'
import { editing } from '$lib/state/editing.svelte'
import { resumeDoc } from '$lib/state/document.svelte'
import { prefs } from '$lib/state/preferences.svelte'
import { defaultTheme } from '$lib/themes/index'
import { DOCUMENT_KEY } from '$lib/storage/persist'
import { serializeResume } from '$lib/io/exportJson'
import { sampleDocument } from '../../data/sample'

const paper = () => document.querySelector<HTMLElement>('.resume-paper')!
const sectionOf = (title: string) =>
  [...paper().querySelectorAll<HTMLElement>('section')].find((node) => node.querySelector('h2')?.textContent === title)!

beforeEach(() => {
  localStorage.clear()
  editing.reset()
  prefs.themeKey = defaultTheme.key
  prefs.uiLocale = 'en'
  prefs.documentLocale = 'en'
})

afterEach(() => editing.reset())

const seed = (change: (doc: ReturnType<typeof sampleDocument>) => void) => {
  const doc = sampleDocument()
  change(doc)
  localStorage.setItem(DOCUMENT_KEY, serializeResume(doc))
}

const startEditing = async () => {
  const user = userEvent.setup()
  render(App)
  await user.click(screen.getByRole('button', { name: 'Edit' }))
  return user
}

describe('combined lines', () => {
  it('render exactly as before in Preview', () => {
    render(App)
    const metas = [...sectionOf('Experience').querySelectorAll('.item-meta')].map((node) => node.textContent)
    expect(metas[0]).toBe('PT Arkasa Melanglang Buana · Payments Platform · Jakarta')
  })

  it('split into separately editable fields in Edit mode with the same text', async () => {
    const user = await startEditing()
    const meta = sectionOf('Experience').querySelector('.item-meta')!
    expect(meta.textContent).toBe('PT Arkasa Melanglang Buana · Payments Platform · Jakarta')
    await user.click(within(paper()).getByRole('button', { name: 'Edit Team: Payments Platform' }))
    const input = screen.getByRole('textbox', { name: 'Team · this language' })
    await user.clear(input)
    await user.type(input, 'Core Payments{Enter}')
    expect(resumeDoc.current.content.experience[0]!.text.en.team).toBe('Core Payments')
    expect(resumeDoc.current.content.experience[0]!.text.id.team).toBe('Fitur Pembayaran')
  })

  it('write a shared field once for both languages', async () => {
    const user = await startEditing()
    await user.click(within(paper()).getByRole('button', { name: 'Edit Company: Tokobangun Tidur Lagi' }))
    const input = screen.getByRole('textbox', { name: 'Company · both languages' })
    await user.clear(input)
    await user.type(input, 'Toko Baru{Enter}')
    expect(resumeDoc.current.content.experience[1]!.company).toBe('Toko Baru')
  })

  it('edit the stored GPA, not its "GPA" display label', async () => {
    const user = await startEditing()
    await user.click(within(paper()).getByRole('button', { name: 'Edit GPA: GPA 3.72 / 4.00' }))
    const input = screen.getByRole('textbox', { name: 'GPA · both languages' })
    expect(input).toHaveValue('3.72 / 4.00')
  })

  it('split the ATS title line too', async () => {
    prefs.themeKey = 'ats'
    const user = await startEditing()
    expect(within(paper()).getByRole('button', { name: 'Edit Name: Antrean' })).toBeInTheDocument()
    await user.click(within(paper()).getByRole('button', { name: 'Edit Role: Author' }))
    expect(screen.getByRole('textbox', { name: 'Role · this language' })).toHaveValue('Author')
  })
})

describe('dates', () => {
  it('edit a range in a small form and keep it consistent', async () => {
    const user = await startEditing()
    await user.click(within(paper()).getByRole('button', { name: /^Edit Dates: Aug 2019/ }))
    const form = screen.getByRole('form', { name: 'Dates' })
    expect(within(form).getByText('both languages')).toBeInTheDocument()
    expect(within(form).getByRole('textbox', { name: 'From' })).toHaveValue('2019-08')
    await user.click(within(form).getByRole('checkbox', { name: 'Present' }))
    expect(within(form).getByRole('textbox', { name: 'To' })).toBeDisabled()
    await user.click(within(form).getByRole('button', { name: 'Apply' }))
    expect(resumeDoc.current.content.experience[1]!.dates).toEqual({ start: '2019-08', end: null, current: true })
  })

  it('edit an award month', async () => {
    const user = await startEditing()
    const award = resumeDoc.current.content.awards[0]!
    await user.click(within(sectionOf('Awards')).getAllByRole('button', { name: /^Edit Date/ })[0]!)
    const form = screen.getByRole('form', { name: 'Date' })
    const input = within(form).getByLabelText(/^Date/)
    expect(input).toHaveValue(award.date)
    await user.clear(input)
    await user.type(input, '2020-01{Enter}')
    expect(resumeDoc.current.content.awards[0]!.date).toBe('2020-01')
  })
})

describe('lists', () => {
  it.each(['classic', 'ats'])('edits only the selected bullet in %s', async (theme) => {
    prefs.themeKey = theme === 'classic' ? defaultTheme.key : theme
    const user = await startEditing()
    const item = resumeDoc.current.content.experience[1]!
    const before = [...item.text.en.bullets]
    await user.click(within(paper()).getByRole('button', { name: /^Edit Highlights: Built the seller/ }))
    const area = screen.getByRole('textbox', { name: 'Highlights · this language' })
    expect(area).toHaveValue(before[0])
    await user.clear(area)
    await user.type(area, '  First  {Enter}')
    expect(item.text.en.bullets).toEqual(['First', before[1]])
    await user.click(within(paper()).getByRole('button', { name: /^Edit Highlights: Cut catalogue/ }))
    expect(screen.getByRole('textbox', { name: 'Highlights · this language' })).toHaveValue(before[1])
    await user.keyboard('{Escape}')
  })

  it.each(['classic', 'ats'])('Enter creates the next bullet and Alt+Enter stays within one bullet in %s', async (theme) => {
    prefs.themeKey = theme === 'classic' ? defaultTheme.key : theme
    const user = await startEditing()
    const item = resumeDoc.current.content.experience[1]!
    const before = [...item.text.en.bullets]
    await user.click(within(paper()).getByRole('button', { name: /^Edit Highlights: Built the seller/ }))
    await user.keyboard('{Enter}')
    const next = screen.getByRole('textbox', { name: 'Highlights · this language' })
    expect(next).toHaveValue('')
    expect(next).toHaveFocus()
    expect(item.text.en.bullets).toEqual(before)
    const placeholder = paper().querySelector('[data-edit-key="bullet.experience.exp_sample_2.append.0"]')!
    expect(placeholder.closest('li')).toHaveAttribute('data-print-hide')
    await user.type(next, 'New{Alt>}{Enter}{/Alt}detail')
    expect(next).toHaveValue('New\ndetail')
    expect(item.text.en.bullets).toEqual(before)
    await user.keyboard('{Enter}')
    expect(item.text.en.bullets).toEqual([before[0], 'New\ndetail', before[1]])
    expect(screen.getByRole('textbox', { name: 'Highlights · this language' })).toHaveValue('')
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('textbox', { name: 'Highlights · this language' })).not.toBeInTheDocument()
  })

  it('adds and removes an individual highlight and restores focus', async () => {
    const user = await startEditing()
    const item = resumeDoc.current.content.experience[0]!
    const entry = paper().querySelector('[data-entry="experience:exp_sample_1"]') as HTMLElement
    const before = [...item.text.en.bullets]
    const add = within(entry).getByRole('button', { name: 'Add highlight' })
    expect(add.closest('[data-print-hide]')).not.toBeNull()
    await user.click(add)
    expect(screen.queryByRole('button', { name: 'Remove highlight' })).not.toBeInTheDocument()
    await user.type(screen.getByRole('textbox', { name: 'Highlights · this language' }), 'Added{Enter}')
    expect(item.text.en.bullets).toEqual([...before, 'Added'])
    const added = within(entry).getByRole('button', { name: 'Edit Highlights: Added' })
    expect(screen.getByRole('textbox', { name: 'Highlights · this language' })).toHaveValue('')
    await user.keyboard('{Escape}')
    expect(added).toHaveFocus()
    await user.click(added)
    await user.click(screen.getByRole('button', { name: 'Remove highlight' }))
    expect(item.text.en.bullets).toEqual(before)
    expect(within(entry).getByRole('button', { name: `Edit Highlights: ${before.at(-1)}` })).toHaveFocus()
  })

  it('keeps row edits inside the entry draft until Apply and discards them on Cancel', async () => {
    const user = await startEditing()
    const before = resumeDoc.snapshot()
    await user.click(within(paper()).getByRole('button', { name: 'Edit Role: Senior Software Engineer' }))
    await user.keyboard('{Escape}')
    await user.click(screen.getByRole('button', { name: 'Edit entry' }))
    const form = screen.getByRole('form', { name: 'Experience' })
    const area = within(form).getByRole('textbox', { name: 'Highlights 2' })
    await user.clear(area)
    await user.type(area, 'Edited{Enter}')
    expect(editing.active?.target.kind).toBe('entry')
    expect(resumeDoc.snapshot()).toEqual(before)
    await user.click(within(form).getAllByRole('button', { name: 'Add highlight' }).at(-1)!)
    await user.type(within(form).getAllByRole('textbox').at(-1)!, 'New draft{Enter}')
    await user.click(within(form).getByRole('button', { name: 'Cancel' }))
    expect(resumeDoc.snapshot()).toEqual(before)
  })

  it('edit technologies as a comma-separated draft', async () => {
    const user = await startEditing()
    await user.click(within(paper()).getByRole('button', { name: 'Edit Tech stack: TypeScript · PostgreSQL · Redis' }))
    const form = screen.getByRole('form', { name: 'Tech stack' })
    const input = within(form).getByLabelText(/^Tech stack/)
    expect(input).toHaveValue('TypeScript, PostgreSQL, Redis')
    await user.clear(input)
    await user.type(input, 'Go,  , Rust ,')
    expect(resumeDoc.current.content.projects[0]!.techStack).toEqual(['TypeScript', 'PostgreSQL', 'Redis'])
    await user.click(within(form).getByRole('button', { name: 'Apply' }))
    expect(resumeDoc.current.content.projects[0]!.techStack).toEqual(['Go', 'Rust'])
  })

  it('edit localized skills in the resume language', async () => {
    prefs.documentLocale = 'id'
    const user = await startEditing()
    await user.click(within(paper()).getByRole('button', { name: /^Edit Skills: PostgreSQL/ }))
    const form = screen.getByRole('form', { name: 'Skills' })
    const input = within(form).getByLabelText(/^Skills/)
    await user.clear(input)
    await user.type(input, 'Basis data, Antrean{Enter}')
    expect(resumeDoc.current.content.skills[1]!.text.id.items).toEqual(['Basis data', 'Antrean'])
    expect(resumeDoc.current.content.skills[1]!.text.en.items).toContain('Kubernetes')
  })

  it('edit a project link through the URL normalizer', async () => {
    const user = await startEditing()
    await user.click(within(paper()).getByRole('button', { name: /^Edit Link: / }))
    const form = screen.getByRole('form', { name: 'Link' })
    const input = within(form).getByLabelText(/^Link/)
    await user.clear(input)
    await user.type(input, 'github.com/me/antrean{Enter}')
    expect(resumeDoc.current.content.projects[0]!.link).toBe('https://github.com/me/antrean')
  })
})

describe('adding entries', () => {
  it('stages a new entry and adds it only when applied', async () => {
    const user = await startEditing()
    const before = resumeDoc.current.content.awards.length
    const add = within(sectionOf('Awards')).getByRole('button', { name: 'Add entry to Awards' })
    expect(add).toHaveTextContent('+ Add entry')
    expect(add.closest('[data-print-hide]')).not.toBeNull()
    await user.click(add)
    const form = screen.getByRole('form', { name: 'Awards' })
    expect(resumeDoc.current.content.awards).toHaveLength(before)
    await user.type(within(form).getByLabelText(/^Title/), 'Hackathon Winner')
    await user.click(within(form).getByRole('button', { name: 'Apply' }))
    expect(resumeDoc.current.content.awards).toHaveLength(before + 1)
    expect(resumeDoc.current.content.awards.at(-1)!.text.en.title).toBe('Hackathon Winner')
    const added = resumeDoc.current.content.awards.at(-1)!
    expect(document.activeElement?.closest('[data-entry]')).toHaveAttribute('data-entry', `awards:${added.id}`)
  })

  it('creates nothing when the staged entry is cancelled', async () => {
    const user = await startEditing()
    const before = resumeDoc.current.content.projects.length
    await user.click(within(sectionOf('Projects')).getByRole('button', { name: 'Add entry to Projects' }))
    await user.type(within(screen.getByRole('form', { name: 'Projects' })).getByLabelText(/^Name/), 'Draft')
    await user.keyboard('{Escape}')
    expect(resumeDoc.current.content.projects).toHaveLength(before)
    expect(within(sectionOf('Projects')).getByRole('button', { name: 'Add entry to Projects' })).toHaveFocus()
  })

  it('shows an enabled empty section only while editing, hidden from print', async () => {
    seed((doc) => { doc.content.awards = [] })
    const user = userEvent.setup()
    render(App)
    expect(sectionOf('Awards')).toBeUndefined()
    await user.click(screen.getByRole('button', { name: 'Edit' }))
    const section = sectionOf('Awards')
    expect(section).toHaveAttribute('data-print-hide')
    expect(within(section).getByText('No entries yet')).toBeInTheDocument()
    expect(within(section).getByRole('button', { name: 'Add entry to Awards' })).toBeInTheDocument()
  })

  it('shows an icon empty state for an empty section', async () => {
    seed((doc) => { doc.content.awards = [] })
    const user = userEvent.setup()
    render(App)
    await user.click(screen.getByRole('button', { name: 'Edit' }))
    const empty = within(sectionOf('Awards')).getByText('No entries yet').closest('.section-empty')
    expect(empty?.querySelector('svg')).not.toBeNull()
  })

  it('offers no add action for a disabled section', async () => {
    seed((doc) => { doc.sections.find((section) => section.kind === 'awards')!.enabled = false })
    await startEditing()
    expect(screen.queryByRole('button', { name: 'Add entry to Awards' })).not.toBeInTheDocument()
  })
})

describe('entry actions', () => {
  const selectFirstExperience = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(within(paper()).getByRole('button', { name: 'Edit Role: Senior Software Engineer' }))
    await user.keyboard('{Escape}')
    return screen.getByRole('group', { name: 'Experience entry 1 of 2' })
  }

  it('appear for the selected entry with boundary disabling', async () => {
    const user = await startEditing()
    const actions = await selectFirstExperience(user)
    expect(actions.closest('[data-print-hide]')).not.toBeNull()
    expect(within(actions).getByRole('button', { name: 'Move up' })).toBeDisabled()
    expect(within(actions).getByRole('button', { name: 'Move down' })).toBeEnabled()
  })

  it('commits a bullet draft before moving its entry without relying on blur', async () => {
    const user = await startEditing()
    const item = resumeDoc.current.content.experience[0]!
    await user.click(within(paper()).getByRole('button', { name: `Edit Highlights: ${item.text.en.bullets[0]}` }))
    const input = screen.getByRole('textbox', { name: 'Highlights · this language' })
    await user.clear(input)
    await user.type(input, 'Before move')
    await fireEvent.click(screen.getByRole('button', { name: 'Move down' }))
    expect(editing.active).toBeNull()
    expect(resumeDoc.current.content.experience[1]!.text.en.bullets[0]).toBe('Before move')
  })

  it('move an entry, keep focus on it, and announce the move', async () => {
    const user = await startEditing()
    const actions = await selectFirstExperience(user)
    await user.click(within(actions).getByRole('button', { name: 'Move down' }))
    expect(resumeDoc.current.content.experience.map((item) => item.id)).toEqual(['exp_sample_2', 'exp_sample_1'])
    const moved = screen.getByRole('group', { name: 'Experience entry 2 of 2' })
    expect(moved.closest('[data-entry]')).toHaveAttribute('data-entry', 'experience:exp_sample_1')
    expect(moved.contains(document.activeElement)).toBe(true)
    expect(screen.getByText('Experience entry moved to position 2 of 2')).toBeInTheDocument()
  })

  it('delete only after confirmation, then focus the next entry', async () => {
    const user = await startEditing()
    const actions = await selectFirstExperience(user)
    await user.click(within(actions).getByRole('button', { name: 'Delete' }))
    expect(resumeDoc.current.content.experience).toHaveLength(2)
    await user.click(within(actions).getByRole('button', { name: 'Confirm delete' }))
    expect(resumeDoc.current.content.experience.map((item) => item.id)).toEqual(['exp_sample_2'])
    expect(document.activeElement).toHaveAttribute('data-entry', 'experience:exp_sample_2')
    expect(screen.getByText('Experience entry deleted')).toBeInTheDocument()
  })

  it('focus the Add action after deleting the last entry', async () => {
    const user = await startEditing()
    await user.click(within(paper()).getByRole('button', { name: /^Edit Title: / }))
    await user.keyboard('{Escape}')
    const actions = screen.getByRole('group', { name: 'Awards entry 1 of 1' })
    await user.click(within(actions).getByRole('button', { name: 'Delete' }))
    await user.click(within(actions).getByRole('button', { name: 'Confirm delete' }))
    expect(within(sectionOf('Awards')).getByRole('button', { name: 'Add entry to Awards' })).toHaveFocus()
  })

  it('edit every field of an entry from one form', async () => {
    const user = await startEditing()
    const actions = await selectFirstExperience(user)
    await user.click(within(actions).getByRole('button', { name: 'Edit entry' }))
    const form = screen.getByRole('form', { name: 'Experience' })
    for (const label of ['Role', 'Company', 'Team', 'Location']) {
      expect(within(form).getByLabelText(new RegExp(`^${label}`))).toBeInTheDocument()
    }
    expect(within(form).getByRole('textbox', { name: 'Highlights 1' })).toBeInTheDocument()
    expect(within(form).getByRole('textbox', { name: 'From' })).toBeInTheDocument()
    await user.clear(within(form).getByLabelText(/^Location/))
    await user.type(within(form).getByLabelText(/^Location/), 'Surabaya')
    await user.click(within(form).getByRole('button', { name: 'Apply' }))
    expect(resumeDoc.current.content.experience[0]!.text.en.location).toBe('Surabaya')
  })
})
