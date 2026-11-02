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

  it('shows the section settings pane with per-section entry counts', async () => {
    render(EditorDrawer)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Sections' }))
    expect(screen.getByRole('checkbox', { name: /Experience/ })).toBeChecked()
    expect(screen.getAllByRole('button', { name: 'Move section up' })).toHaveLength(5)
  })

  it('toggling a section off updates the document', async () => {
    render(EditorDrawer)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Sections' }))
    await user.click(screen.getByRole('checkbox', { name: /Awards/ }))
    expect(resumeDoc.current.sections.find((s) => s.kind === 'awards')?.enabled).toBe(false)
  })
})
