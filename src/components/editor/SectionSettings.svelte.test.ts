import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import SectionSettings from './SectionSettings.svelte'
import { resumeDoc } from '$lib/state/document.svelte'
import { prefs } from '$lib/state/preferences.svelte'
import { editing } from '$lib/state/editing.svelte'
import { sampleDocument } from '../../data/sample'

beforeEach(() => {
  resumeDoc.replace(sampleDocument())
  prefs.uiLocale = 'en'
})

describe('section reorder controls', () => {
  it('uses icons, not glyphs, for reorder controls', () => {
    const { container } = render(SectionSettings)
    const handles = container.querySelectorAll('.drag-handle')
    expect(handles.length).toBeGreaterThan(0)
    for (const handle of handles) {
      expect(handle.querySelector('svg')).not.toBeNull()
      expect(handle.textContent?.trim()).toBe('')
    }
    for (const button of screen.getAllByRole('button', { name: /^Move .* (up|down)$/ })) {
      expect(button.querySelector('svg')).not.toBeNull()
      expect(button.textContent).not.toMatch(/[↑↓⠿]/)
    }
  })

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

describe('section navigation', () => {
  it('offers navigation buttons separate from the visibility checkbox and reorder controls', async () => {
    const visited: string[] = []
    render(SectionSettings, { onNavigate: (target: string) => visited.push(target) })
    const go = screen.getByRole('button', { name: 'Go to Awards' })
    const check = screen.getByRole('checkbox', { name: /Awards/ })
    expect(go.contains(check)).toBe(false)
    expect(go.closest('label')).toBeNull()
    expect(go).not.toHaveClass('drag-handle')
    await userEvent.click(go)
    expect(visited).toEqual(['awards'])
    expect(resumeDoc.current.sections.find((s) => s.kind === 'awards')?.enabled).toBe(true)
  })

  it('lists a fixed Profile row first, without reorder or visibility controls', async () => {
    const visited: string[] = []
    render(SectionSettings, { onNavigate: (target: string) => visited.push(target) })
    const buttons = screen.getAllByRole('button', { name: /^Go to / })
    expect(buttons[0]).toHaveAccessibleName('Go to Profile')
    expect(screen.queryByRole('button', { name: /^Reorder Profile/ })).toBeNull()
    expect(screen.queryByRole('checkbox', { name: /Profile/ })).toBeNull()
    await userEvent.click(buttons[0]!)
    expect(visited).toEqual(['profile'])
  })

  it('disables navigation to a hidden section and says why', async () => {
    resumeDoc.setSectionEnabled('awards', false)
    render(SectionSettings, { onNavigate: () => {} })
    const go = screen.getByRole('button', { name: 'Go to Awards' })
    expect(go).toBeDisabled()
    expect(go).toHaveAccessibleDescription(/hidden/i)
  })

  it('disables navigation to an empty section in Preview but allows it in Edit mode', async () => {
    resumeDoc.current.content.awards = []
    editing.reset()
    const { unmount } = render(SectionSettings, { onNavigate: () => {} })
    expect(screen.getByRole('button', { name: 'Go to Awards' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Go to Awards' })).toHaveAccessibleDescription(/Edit mode/)
    unmount()
    editing.enter()
    render(SectionSettings, { onNavigate: () => {} })
    expect(screen.getByRole('button', { name: 'Go to Awards' })).toBeEnabled()
    editing.reset()
  })

  it('translates the navigation names', () => {
    prefs.uiLocale = 'id'
    render(SectionSettings, { onNavigate: () => {} })
    expect(screen.getByRole('button', { name: 'Ke Profil' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ke Penghargaan' })).toBeInTheDocument()
  })

  it('omits navigation when no handler is given', () => {
    render(SectionSettings)
    expect(screen.queryByRole('button', { name: /^Go to / })).toBeNull()
  })
})
