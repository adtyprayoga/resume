import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import SectionSettings from './SectionSettings.svelte'
import { resumeDoc } from '$lib/state/document.svelte'
import { prefs } from '$lib/state/preferences.svelte'
import { sampleDocument } from '../../data/sample'

beforeEach(() => {
  resumeDoc.replace(sampleDocument())
  prefs.uiLocale = 'en'
})

describe('section reorder controls', () => {
  it('offers tap moves with disabled boundaries and preserves focus on the moved section', async () => {
    render(SectionSettings)
    expect(screen.getByRole('button', { name: 'Move Experience up' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Move Awards down' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'Move Experience down' }))
    expect(resumeDoc.current.sections.slice(0, 2).map(s => s.kind)).toEqual(['education', 'experience'])
    expect(screen.getByRole('button', { name: 'Reorder Experience, position 2 of 5' })).toHaveFocus()
    expect(screen.getByRole('status')).toHaveTextContent('Experience, position 2 of 5')
  })

  it('retains arrow-key reordering and announces the position', async () => {
    render(SectionSettings)
    screen.getByRole('button', { name: /^Reorder Education/ }).focus()
    await userEvent.keyboard('{ArrowUp}')
    expect(resumeDoc.current.sections[0]?.kind).toBe('education')
    expect(screen.getByRole('button', { name: 'Reorder Education, position 1 of 5' })).toHaveFocus()
    expect(screen.getByRole('status')).toHaveTextContent('Education, position 1 of 5')
  })

  it('renders Indonesian instructions and tap actions', async () => {
    prefs.uiLocale = 'id'
    render(SectionSettings)
    await userEvent.click(screen.getByRole('button', { name: 'Pindahkan Pendidikan ke atas' }))
    expect(resumeDoc.current.sections[0]?.kind).toBe('education')
    expect(screen.getByRole('status')).toHaveTextContent('Pendidikan, posisi 1 dari 5')
  })
})
