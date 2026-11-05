import { beforeEach, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/svelte'
import { tick } from 'svelte'
import userEvent from '@testing-library/user-event'
import { sampleDocument } from '../../data/sample'
import { resumeDoc } from '$lib/state/document.svelte'
import { prefs } from '$lib/state/preferences.svelte'
import { buildStory } from '$lib/guidance/story'
import { storyHighlights } from '$lib/state/storyHighlights.svelte'
import Storybook from './Storybook.svelte'

beforeEach(() => {
  resumeDoc.load(sampleDocument())
  prefs.documentLocale = 'en'
  prefs.uiLocale = 'en'
  storyHighlights.clear()
})
const turn = () => screen.getByRole('button', { name: /^(Turn the page|Write it in and turn the page)$/ })

it('renders fixed narration and marked facts, focuses the heading and traps focus', async () => {
  render(Storybook, { onClose: vi.fn() })
  const dialog = screen.getByRole('dialog')
  expect(dialog).toHaveAttribute('aria-modal', 'true')
  expect(dialog).toHaveTextContent('Once upon a time, there lived a')
  expect(dialog.querySelector('mark')).toHaveTextContent(resumeDoc.resolved('en').profile.headline.split('|')[0]!.trim())
  await tick()
  expect(screen.getByRole('heading')).toHaveFocus()
  await userEvent.setup().tab({ shift: true })
  expect(turn()).toHaveFocus()
  await userEvent.setup().tab()
  expect(screen.getByRole('button', { name: 'Close the book' })).toHaveFocus()
})

it('writes partial summary once, revisits read-only, and undoes exactly', async () => {
  render(Storybook, { onClose: vi.fn() })
  const user = userEvent.setup()
  await user.click(turn())
  const page = buildStory(resumeDoc.current, 'en').find(p => p.chapter === 'summary')!
  const years = page.blanks.find(b => b.id === 'summary:years')!
  const before = JSON.stringify(resumeDoc.snapshot())
  await user.type(screen.getByLabelText(years.label.en), '8')
  await user.click(turn())
  expect(resumeDoc.current.profile.text.en.summary).toContain('8')
  expect(storyHighlights.count).toBeGreaterThan(0)
  await user.click(screen.getByRole('button', { name: 'Previous page' }))
  expect(screen.getByLabelText(years.label.en)).toHaveAttribute('readonly')
  await user.click(turn())
  resumeDoc.undo()
  expect(JSON.stringify(resumeDoc.snapshot())).toBe(before)
  expect(resumeDoc.canUndo).toBe(false)
})

it('keeps narration language independent, closes with Escape', async () => {
  prefs.documentLocale = 'id'
  const onClose = vi.fn()
  render(Storybook, { onClose })
  expect(screen.getByRole('dialog')).toHaveTextContent('Pada suatu masa, hiduplah seorang')
  expect(turn()).toHaveTextContent('Turn the page')
  await userEvent.setup().keyboard('{Escape}')
  expect(onClose).toHaveBeenCalledOnce()
})

it('skips disabled chapters and ends with totals and only Close', async () => {
  resumeDoc.current.sections.find(s => s.kind === 'certifications')!.enabled = false
  const pages = buildStory(resumeDoc.current, 'en')
  render(Storybook, { onClose: vi.fn() })
  const user = userEvent.setup()
  for (const page of pages.slice(0, -1)) {
    expect(page.chapter).not.toBe('course')
    await user.click(screen.getByRole('button', { name: 'Skip' }))
  }
  expect(screen.getByRole('dialog')).toHaveTextContent(/You filled 0 blanks and skipped \d+/)
  expect(screen.getAllByRole('button')).toHaveLength(1)
  expect(resumeDoc.canUndo).toBe(false)
})

it('gates confirm and end question prose and never creates an all-skipped entry', async () => {
  resumeDoc.current.content.experience = []
  const pages = buildStory(resumeDoc.current, 'en')
  render(Storybook, { onClose: vi.fn() })
  const user = userEvent.setup()
  for (let i = 0; i < pages.findIndex(p => p.chapter === 'experience'); i++) await user.click(turn())
  expect(screen.queryByText(/If that chapter had closed/)).not.toBeInTheDocument()
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  await user.click(screen.getByRole('radio', { name: 'Yes' }))
  expect(screen.queryByText(/If that chapter had closed/)).not.toBeInTheDocument()
  const current = screen.getByRole('group', { name: /current|still/i })
  await user.click(within(current).getByRole('radio', { name: 'No' }))
  expect(screen.getByText(/If that chapter had closed/)).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Skip' }))
  expect(resumeDoc.current.content.experience).toEqual([])
})

it('counts written answers on the ending page', async () => {
  const pages = buildStory(resumeDoc.current, 'en')
  render(Storybook, { onClose: vi.fn() })
  const user = userEvent.setup()
  const first = within(screen.getByRole('dialog')).getAllByRole('textbox')
  expect(first.length).toBeGreaterThan(0)
  for (const [index, input] of first.entries()) await user.type(input, `Answer ${index}`)
  await user.click(screen.getByRole('button', { name: 'Write it in and turn the page' }))
  for (let page = 1; page < pages.length - 1; page += 1) await user.click(screen.getByRole('button', { name: 'Skip' }))
  expect(screen.getByRole('dialog')).toHaveTextContent(new RegExp(`You filled ${first.length} blanks? and skipped \\d+`))
})

it('describes every blank with its tip in the interface language', () => {
  prefs.documentLocale = 'id'
  prefs.uiLocale = 'en'
  render(Storybook, { onClose: vi.fn() })
  const inputs = within(screen.getByRole('dialog')).getAllByRole('textbox')
  expect(inputs.length).toBeGreaterThan(0)
  for (const input of inputs) {
    const tip = document.getElementById(input.getAttribute('aria-describedby') ?? '')
    expect(tip).not.toBeNull()
    expect(tip).toHaveTextContent(/Example:/)
  }
})

it('opens one tip band under the paragraph of the focused blank', async () => {
  render(Storybook, { onClose: vi.fn() })
  const user = userEvent.setup()
  const [first, second] = within(screen.getByRole('dialog')).getAllByRole('textbox')
  expect(document.querySelector('.story-tip-band')).toBeNull()
  await user.click(first!)
  const bands = () => [...document.querySelectorAll('.story-tip-band')]
  expect(bands()).toHaveLength(1)
  expect(bands()[0]!.previousElementSibling?.contains(first!)).toBe(true)
  expect(bands()[0]).toHaveTextContent(document.getElementById(first!.getAttribute('aria-describedby')!)!.textContent!)
  if (second) {
    await user.click(second)
    expect(bands()).toHaveLength(1)
    expect(bands()[0]!.previousElementSibling?.contains(second)).toBe(true)
  }
})
