import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/svelte'
import { tick } from 'svelte'
import App from './App.svelte'
import { resumeDoc } from '$lib/state/document.svelte'
import { prefs } from '$lib/state/preferences.svelte'
import { AUTOSAVE_DELAY_MS } from '$lib/state/autosave'
import { DOCUMENT_KEY, PREFERENCES_KEY } from '$lib/storage/persist'
import { defaultTheme, getTheme } from '$lib/themes/index'

const paper = () => document.querySelector<HTMLElement>('.resume-paper')!

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers({ shouldAdvanceTime: true })
  // prefs is a module singleton; hydrate leaves fields alone when nothing is stored.
  prefs.themeKey = defaultTheme.key
  prefs.uiLocale = 'en'
  prefs.documentLocale = 'en'
  prefs.drawerOpen = false
})

afterEach(() => {
  vi.useRealTimers()
})

describe('theme registry', () => {
  it('keeps Classic as the default and registers an ATS preset', () => {
    expect(defaultTheme.key).toBe('minimal')
    expect(defaultTheme.presentation).toBe('classic')
    expect(getTheme('ats').presentation).toBe('ats')
  })
})

describe('resume layout selection', () => {
  it('starts in Classic when no preference is stored', () => {
    render(App)
    expect(paper()).toHaveAttribute('data-presentation', 'classic')
    const group = screen.getByRole('group', { name: 'Resume layout' })
    expect(within(group).getByRole('button', { name: 'Resume layout: Classic' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(group).getByRole('button', { name: 'Resume layout: ATS' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('restores an explicit ATS selection', () => {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify({ uiLocale: 'en', documentLocale: 'en', themeKey: 'ats', fontScale: 'standard' }))
    render(App)
    expect(paper()).toHaveAttribute('data-presentation', 'ats')
    expect(screen.getByRole('button', { name: 'Resume layout: ATS' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('falls back to Classic for an invalid stored layout', () => {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify({ themeKey: 'two-column-fancy' }))
    render(App)
    expect(paper()).toHaveAttribute('data-presentation', 'classic')
  })

  it('persists the selection so it survives a reload', async () => {
    render(App)
    await fireEvent.click(screen.getByRole('button', { name: 'Resume layout: ATS' }))
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS * 3)
    expect(JSON.parse(localStorage.getItem(PREFERENCES_KEY)!).themeKey).toBe('ats')
  })

  it('switches presentation without changing the document or languages', async () => {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify({ uiLocale: 'id', documentLocale: 'en' }))
    render(App)
    const before = JSON.stringify(resumeDoc.snapshot())
    const article = paper()

    await fireEvent.click(screen.getByRole('button', { name: 'Tata letak resume: ATS' }))
    expect(paper()).toHaveAttribute('data-presentation', 'ats')
    expect(paper()).toBe(article)
    await fireEvent.click(screen.getByRole('button', { name: 'Tata letak resume: Klasik' }))
    expect(paper()).toHaveAttribute('data-presentation', 'classic')

    expect(JSON.stringify(resumeDoc.snapshot())).toBe(before)
    expect(prefs.uiLocale).toBe('id')
    expect(prefs.documentLocale).toBe('en')
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS * 3)
    expect(JSON.parse(localStorage.getItem(DOCUMENT_KEY)!)).toEqual(JSON.parse(before))
  })

  it('keeps the open editor mounted with its unfinished input', async () => {
    render(App)
    prefs.openDrawer('profile')
    await tick()
    const input = screen.getByLabelText(/^Name/) as HTMLInputElement
    input.value = 'half-typed'
    prefs.themeKey = 'ats'
    await tick()
    expect(screen.getByLabelText(/^Name/)).toBe(input)
    expect(input.value).toBe('half-typed')
  })

  it('hides the layout controls when printing', () => {
    render(App)
    const group = screen.getByRole('group', { name: 'Resume layout' })
    expect(group.closest('[data-print-hide]')).not.toBeNull()
  })
})

describe('page guides follow the layout', () => {
  it('remeasures once after a layout switch and then settles', async () => {
    const frames = new Map<number, FrameRequestCallback>()
    let next = 0
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frames.set(++next, callback); return next })
    vi.stubGlobal('cancelAnimationFrame', (id: number) => { frames.delete(id) })
    const run = async () => {
      const pending = [...frames.values()]
      frames.clear()
      for (const callback of pending) callback(0)
      for (let i = 0; i < 5; i += 1) await Promise.resolve()
      await tick()
    }
    try {
      prefs.showPageBreaks = true
      render(App)
      await run()
      await run()
      expect(frames.size).toBe(0)

      await fireEvent.click(screen.getByRole('button', { name: 'Resume layout: ATS' }))
      for (let i = 0; i < 5; i += 1) await Promise.resolve()
      expect(frames.size).toBe(1)
      await run()
      expect(frames.size).toBe(0)
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
