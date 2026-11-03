import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { tick } from 'svelte'
import App from './App.svelte'
import { editing } from '$lib/state/editing.svelte'
import { resumeDoc } from '$lib/state/document.svelte'
import { prefs } from '$lib/state/preferences.svelte'
import { defaultTheme } from '$lib/themes/index'
import { sampleDocument } from './data/sample'

beforeEach(() => {
  localStorage.clear()
  editing.reset()
  resumeDoc.replace(sampleDocument())
  prefs.themeKey = defaultTheme.key
  prefs.uiLocale = 'en'
  prefs.documentLocale = 'en'
})

afterEach(() => {
  editing.reset()
  vi.unstubAllGlobals()
})

const toolbar = () => screen.getByRole('toolbar', { name: 'Resume actions' })
const toggle = (name: 'Sections' | 'Settings') => within(toolbar()).getByRole('button', { name })
const panel = (name: 'Sections' | 'Settings') => screen.queryByRole('complementary', { name })

/** A controllable `(max-width: 1023px)` media query. */
const stubNarrow = (initial: boolean) => {
  let matches = initial
  const listeners = new Set<(event: { matches: boolean }) => void>()
  vi.stubGlobal('matchMedia', (query: string) => ({
    get matches() { return query.includes('1023px') ? matches : false },
    media: query,
    addEventListener: (_: string, listener: (event: { matches: boolean }) => void) => listeners.add(listener),
    removeEventListener: (_: string, listener: (event: { matches: boolean }) => void) => listeners.delete(listener),
  }))
  return async (next: boolean) => {
    matches = next
    for (const listener of listeners) listener({ matches })
    await tick()
  }
}

describe('side panels', () => {
  it('start closed', () => {
    render(App)
    expect(panel('Sections')).toBeNull()
    expect(panel('Settings')).toBeNull()
    expect(toggle('Sections')).toHaveAttribute('aria-expanded', 'false')
    expect(toggle('Settings')).toHaveAttribute('aria-expanded', 'false')
  })

  it('toggle independently on desktop and may both stay open', async () => {
    render(App)
    const user = userEvent.setup()
    await user.click(toggle('Sections'))
    await user.click(toggle('Settings'))
    expect(panel('Sections')).toBeInTheDocument()
    expect(panel('Settings')).toBeInTheDocument()
    expect(toggle('Sections')).toHaveAttribute('aria-controls', panel('Sections')!.id)
    expect(toggle('Settings')).toHaveAttribute('aria-controls', panel('Settings')!.id)
    await user.click(toggle('Sections'))
    expect(panel('Sections')).toBeNull()
    expect(panel('Settings')).toBeInTheDocument()
  })

  it('are not modal and are hidden from print', async () => {
    render(App)
    const user = userEvent.setup()
    await user.click(toggle('Settings'))
    expect(screen.queryByRole('dialog', { name: 'Settings' })).toBeNull()
    expect(panel('Settings')).toHaveAttribute('data-print-hide')
    expect(panel('Settings')).not.toHaveAttribute('aria-modal')
    expect(document.querySelector('.drawer-overlay')).toBeNull()
  })

  it('focus their heading on open and return focus to the toggle on close', async () => {
    render(App)
    const user = userEvent.setup()
    await user.click(toggle('Sections'))
    expect(within(panel('Sections')!).getByRole('heading', { name: 'Sections' })).toHaveFocus()
    await user.click(within(panel('Sections')!).getByRole('button', { name: 'Close' }))
    expect(panel('Sections')).toBeNull()
    expect(toggle('Sections')).toHaveFocus()
  })

  it('close on Escape pressed inside them, leaving the other panel open', async () => {
    render(App)
    const user = userEvent.setup()
    await user.click(toggle('Sections'))
    await user.click(toggle('Settings'))
    await user.keyboard('{Escape}')
    expect(panel('Settings')).toBeNull()
    expect(panel('Sections')).toBeInTheDocument()
    expect(toggle('Settings')).toHaveFocus()
  })

  it('ignore Escape pressed outside them', async () => {
    render(App)
    const user = userEvent.setup()
    await user.click(toggle('Settings'))
    toggle('Sections').focus()
    await user.keyboard('{Escape}')
    expect(panel('Settings')).toBeInTheDocument()
  })

  it('apply the open draft when toggled', async () => {
    render(App)
    const user = userEvent.setup()
    editing.enter()
    editing.begin({ kind: 'field', ref: { owner: 'profile', key: 'name' } })
    editing.setDraft('profile.name', 'Kept On Toggle')
    await user.click(toggle('Sections'))
    expect(resumeDoc.current.profile.text.en.name).toBe('Kept On Toggle')
    expect(editing.active).toBeNull()
  })

  it('drop an untouched new entry when toggled', async () => {
    render(App)
    const user = userEvent.setup()
    await user.click(within(toolbar()).getByRole('button', { name: 'Edit' }))
    const before = resumeDoc.current.content.awards.length
    await user.click(screen.getByRole('button', { name: 'Add entry to Awards' }))
    await user.click(toggle('Settings'))
    expect(resumeDoc.current.content.awards).toHaveLength(before)
  })

  it('keep the CV editable while open, without suspending the editor', async () => {
    render(App)
    const user = userEvent.setup()
    await user.click(toggle('Settings'))
    await user.click(toggle('Sections'))
    await user.click(within(toolbar()).getByRole('button', { name: 'Edit' }))
    const paper = document.querySelector<HTMLElement>('.resume-paper')!
    await user.click(within(paper).getByRole('button', { name: /^Edit Phone/ }))
    expect(screen.getByRole('form', { name: 'Phone' })).toBeInTheDocument()
    expect(editing.suspended).toBe(false)
    await user.click(document.querySelector<HTMLElement>('.preview-container')!)
    expect(panel('Settings')).toBeInTheDocument()
    expect(panel('Sections')).toBeInTheDocument()
  })

  it('split the controls: section management left, everything else in Settings', async () => {
    render(App)
    const user = userEvent.setup()
    await user.click(toggle('Sections'))
    await user.click(toggle('Settings'))
    expect(within(panel('Sections')!).getAllByRole('button', { name: /^Reorder / })).toHaveLength(5)
    expect(within(panel('Settings')!).queryAllByRole('button', { name: /^Reorder / })).toHaveLength(0)
    expect(within(panel('Settings')!).getByRole('button', { name: 'Reset to sample' })).toBeInTheDocument()
    expect(within(panel('Settings')!).getByRole('button', { name: 'Start blank' })).toBeInTheDocument()
  })
})

describe('side panels on narrow screens', () => {
  it('show one panel at a time', async () => {
    stubNarrow(true)
    render(App)
    const user = userEvent.setup()
    await user.click(toggle('Sections'))
    await user.click(toggle('Settings'))
    expect(panel('Sections')).toBeNull()
    expect(panel('Settings')).toBeInTheDocument()
    expect(toggle('Sections')).toHaveAttribute('aria-expanded', 'false')
  })

  it('keep the most recently opened panel when the window narrows', async () => {
    const resize = stubNarrow(false)
    render(App)
    const user = userEvent.setup()
    await user.click(toggle('Settings'))
    await user.click(toggle('Sections'))
    await resize(true)
    expect(panel('Sections')).toBeInTheDocument()
    expect(panel('Settings')).toBeNull()
  })
})
