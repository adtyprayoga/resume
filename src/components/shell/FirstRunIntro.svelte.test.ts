import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, act } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import FirstRunIntro from './FirstRunIntro.svelte'
import { sampleDocument } from '../../data/sample'
import { resumeDoc } from '$lib/state/document.svelte'
import { editing } from '$lib/state/editing.svelte'
import { prefs } from '$lib/state/preferences.svelte'

beforeEach(() => {
  resumeDoc.replace(sampleDocument())
  prefs.introDismissed = false
  prefs.uiLocale = 'en'
  editing.reset()
})

const region = () => screen.queryByRole('region', { name: 'This is a sample resume' })

describe('first-run introduction', () => {
  it('introduces the untouched sample', () => {
    render(FirstRunIntro)
    expect(region()).toBeInTheDocument()
  })

  it('stays hidden for a document that differs from the sample', () => {
    const mine = sampleDocument()
    mine.profile.text.en.name = 'Mine'
    resumeDoc.replace(mine)
    render(FirstRunIntro)
    expect(region()).not.toBeInTheDocument()
  })

  it('stays hidden once dismissed and remembers it', async () => {
    render(FirstRunIntro)
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss introduction' }))
    expect(region()).not.toBeInTheDocument()
    expect(prefs.introDismissed).toBe(true)
  })

  it('hides in Edit mode', async () => {
    render(FirstRunIntro)
    await act(() => editing.enter())
    expect(editing.mode).toBe('edit')
    expect(region()).not.toBeInTheDocument()
  })

  it('starts blank and enters Edit mode', async () => {
    render(FirstRunIntro)
    await userEvent.click(screen.getByRole('button', { name: 'Start blank' }))
    expect(resumeDoc.current.profile.text.en.name).toBe('')
    expect(editing.mode).toBe('edit')
  })

  it('is hidden from print', () => {
    render(FirstRunIntro)
    expect(region()).toHaveAttribute('data-print-hide')
  })

  it('renders in the interface language', () => {
    prefs.uiLocale = 'id'
    render(FirstRunIntro)
    expect(screen.getByRole('region', { name: 'Ini contoh resume' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mulai dari kosong' })).toBeInTheDocument()
  })
})
