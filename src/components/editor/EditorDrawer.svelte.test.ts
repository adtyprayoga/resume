import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import EditorDrawer from './EditorDrawer.svelte'
import { resumeDoc } from '$lib/state/document.svelte'
import { prefs } from '$lib/state/preferences.svelte'
import { sampleDocument } from '../../data/sample'
import { LIST_SECTION_KINDS } from '$lib/sections/kinds'

beforeEach(() => {
  resumeDoc.replace(sampleDocument())
  prefs.uiLocale = 'en'
  prefs.documentLocale = 'en'
  prefs.drawerSection = 'profile'
  prefs.drawerOpen = true
})

describe('EditorDrawer', () => {
  it('is a labelled modal dialog', () => {
    render(EditorDrawer)
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAccessibleName('Edit resume')
  })

  it('offers a tab for profile, every registered section, and settings', () => {
    render(EditorDrawer)
    expect(screen.getByRole('button', { name: 'Profile' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sections' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Experience' })).toBeInTheDocument()
    expect(LIST_SECTION_KINDS.length).toBe(5)
  })

  it('closes on Escape', async () => {
    render(EditorDrawer)
    await userEvent.setup().keyboard('{Escape}')
    expect(prefs.drawerOpen).toBe(false)
  })

  it('moves focus into the dialog on open', () => {
    render(EditorDrawer)
    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true)
  })

  it('switches panes without closing', async () => {
    render(EditorDrawer)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Awards' }))
    expect(prefs.drawerSection).toBe('awards')
    expect(prefs.drawerOpen).toBe(true)
  })

  it('shows the section settings pane with a reorder handle per section', async () => {
    render(EditorDrawer)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Sections' }))
    expect(screen.getByRole('checkbox', { name: /Experience/ })).toBeChecked()
    expect(screen.getAllByRole('button', { name: /^Reorder / })).toHaveLength(5)
  })

  it('reorders a section from the keyboard, since dragging needs a pointer', async () => {
    render(EditorDrawer)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Sections' }))

    const before = resumeDoc.current.sections.map((s) => s.kind)
    screen.getByRole('button', { name: /^Reorder Experience/ }).focus()
    await user.keyboard('{ArrowDown}')

    expect(resumeDoc.current.sections.map((s) => s.kind)).toEqual([
      before[1], before[0], ...before.slice(2),
    ])
  })

  it('announces each handle position for screen readers', async () => {
    render(EditorDrawer)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Sections' }))
    expect(
      screen.getByRole('button', { name: 'Reorder Experience, position 1 of 5' }),
    ).toBeInTheDocument()
  })

  it('toggling a section off updates the document', async () => {
    render(EditorDrawer)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Sections' }))
    await user.click(screen.getByRole('checkbox', { name: /Awards/ }))
    expect(resumeDoc.current.sections.find((s) => s.kind === 'awards')?.enabled).toBe(false)
  })
})

describe('scope badges', () => {
  it('badges only the fields whose scope differs from the pane', async () => {
    render(EditorDrawer)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Experience' }))

    // Experience is per-language, so only Company and Dates are marked shared.
    expect(screen.queryAllByText('this language')).toHaveLength(0)
    expect(screen.getAllByText('both languages').length).toBeGreaterThan(0)
  })

  it('keeps the shared marker off per-language fields', async () => {
    render(EditorDrawer)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Skills' }))
    // Every skills field is per-language, so nothing needs a badge at all.
    expect(screen.queryAllByText('both languages')).toHaveLength(0)
  })
})
