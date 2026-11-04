import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/svelte'
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

afterEach(() => vi.unstubAllGlobals())

/** Phone width, where native drag and drop is unreliable under a finger. */
const stubPhone = () =>
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query === '(max-width: 639px)',
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))

describe('section rows', () => {
  const row = (kind: string) => document.querySelector<HTMLElement>(`li[data-section="${kind}"]`)!
  const follows = (later: Element, earlier: Element) =>
    Boolean(earlier.compareDocumentPosition(later) & Node.DOCUMENT_POSITION_FOLLOWING)

  it('lays out each row as drag handle, section name, then the show checkbox', () => {
    render(SectionSettings, { onNavigate: () => {} })
    const awards = row('awards')
    const handle = within(awards).getByRole('button', { name: /^Reorder Awards/ })
    const name = within(awards).getByRole('button', { name: 'Go to Awards' })
    const show = within(awards).getByRole('checkbox', { name: 'Show Awards' })
    expect(name).toHaveTextContent('Awards')
    expect(follows(name, handle)).toBe(true)
    expect(follows(show, name)).toBe(true)
    expect(name.contains(show)).toBe(false)
  })

  it('has no up or down buttons on wider screens; reordering is by drag or the handle', () => {
    render(SectionSettings, { onNavigate: () => {} })
    expect(screen.queryAllByRole('button', { name: /^Move / })).toHaveLength(0)
    const handles = document.querySelectorAll('.drag-handle')
    expect(handles).toHaveLength(7)
    for (const handle of handles) {
      expect(handle.querySelector('svg')).not.toBeNull()
      expect(handle.textContent?.trim()).toBe('')
    }
  })

  it('adds up and down buttons on phones, where dragging is unreliable', async () => {
    stubPhone()
    render(SectionSettings, { onNavigate: () => {} })
    expect(screen.getByRole('button', { name: 'Move Experience up' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Move References down' })).toBeDisabled()
    const awards = row('awards')
    const up = within(awards).getByRole('button', { name: 'Move Awards up' })
    expect(up.querySelector('svg')).not.toBeNull()
    expect(follows(up, within(awards).getByRole('button', { name: 'Go to Awards' }))).toBe(true)
    expect(follows(within(awards).getByRole('checkbox', { name: 'Show Awards' }), up)).toBe(true)
    await userEvent.click(screen.getByRole('button', { name: 'Move Experience down' }))
    expect(resumeDoc.current.sections.slice(0, 2).map((s) => s.kind)).toEqual(['education', 'experience'])
    expect(screen.getByRole('button', { name: 'Reorder Experience, position 2 of 7' })).toHaveFocus()
    expect(screen.getByRole('status')).toHaveTextContent('Experience, position 2 of 7')
  })

  it('translates the phone move buttons', () => {
    stubPhone()
    prefs.uiLocale = 'id'
    render(SectionSettings, { onNavigate: () => {} })
    expect(screen.getByRole('button', { name: 'Pindahkan Pendidikan ke atas' })).toBeInTheDocument()
  })

  it('shows and hides a section with its checkbox', async () => {
    render(SectionSettings, { onNavigate: () => {} })
    await userEvent.click(screen.getByRole('checkbox', { name: 'Show Awards' }))
    expect(resumeDoc.current.sections.find((s) => s.kind === 'awards')?.enabled).toBe(false)
    await userEvent.click(screen.getByRole('checkbox', { name: 'Show Awards' }))
    expect(resumeDoc.current.sections.find((s) => s.kind === 'awards')?.enabled).toBe(true)
  })

  it('reorders from the keyboard on the handle and announces the position', async () => {
    render(SectionSettings)
    screen.getByRole('button', { name: /^Reorder Education/ }).focus()
    await userEvent.keyboard('{ArrowUp}')
    expect(resumeDoc.current.sections[0]?.kind).toBe('education')
    expect(screen.getByRole('button', { name: 'Reorder Education, position 1 of 7' })).toHaveFocus()
    expect(screen.getByRole('status')).toHaveTextContent('Education, position 1 of 7')
  })

  it('translates the row controls and instructions', async () => {
    prefs.uiLocale = 'id'
    render(SectionSettings, { onNavigate: () => {} })
    expect(screen.getByRole('checkbox', { name: 'Tampilkan Pendidikan' })).toBeInTheDocument()
    expect(screen.getByText(/Seret/)).toHaveTextContent(/di ponsel, gunakan tombol pindah/)
    screen.getByRole('button', { name: /^Ubah urutan Pendidikan/ }).focus()
    await userEvent.keyboard('{ArrowUp}')
    expect(screen.getByRole('status')).toHaveTextContent('Pendidikan, posisi 1 dari 7')
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
