import { beforeEach, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import BulletRows from './BulletRows.svelte'
import { prefs } from '$lib/state/preferences.svelte'

beforeEach(() => { prefs.uiLocale = 'en' })

it('edits one row, preserves siblings verbatim and keeps multiline paste in one bullet', async () => {
  const user = userEvent.setup()
  const onchange = vi.fn()
  render(BulletRows, { value: [' padded ', 'same', 'same', 'A\nB'], label: 'Highlights', onchange })
  const inputs = screen.getAllByRole('textbox')
  expect(inputs).toHaveLength(4)
  await user.click(inputs[2]!)
  await user.clear(inputs[2]!)
  await user.paste('New\ntext')
  await user.keyboard('{Enter}')
  expect(onchange).toHaveBeenLastCalledWith([' padded ', 'same', 'New\ntext', 'A\nB'])
  expect(screen.getAllByRole('textbox')).toHaveLength(4)
})

it('stages empty additions and Escape discards them', async () => {
  const user = userEvent.setup()
  const onchange = vi.fn()
  render(BulletRows, { value: [], label: 'Highlights', onchange })
  const add = screen.getByRole('button', { name: 'Add highlight' })
  await user.click(add)
  expect(screen.getByRole('textbox')).toHaveFocus()
  await user.type(screen.getByRole('textbox'), 'draft')
  expect(onchange).not.toHaveBeenCalled()
  await user.keyboard('{Escape}')
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  expect(add).toHaveFocus()
  expect(onchange).not.toHaveBeenCalled()
  await user.click(add)
  await user.type(screen.getByRole('textbox'), ' saved {Enter}')
  expect(onchange).toHaveBeenLastCalledWith(['saved'])
})

it('preserves row identity when removing a preceding duplicate', async () => {
  const user = userEvent.setup()
  const onchange = vi.fn()
  render(BulletRows, { value: ['same', 'same', 'last'], label: 'Highlights', onchange })
  const second = screen.getAllByRole('textbox')[1]!
  await user.click(screen.getByRole('button', { name: 'Remove highlight 1' }))
  expect(screen.getAllByRole('textbox')[0]).toBe(second)
  expect(second).toHaveFocus()
  expect(onchange).toHaveBeenLastCalledWith(['same', 'last'])
})

it('restores the opening value on Escape and ignores IME Enter', async () => {
  const user = userEvent.setup()
  const onchange = vi.fn()
  render(BulletRows, { value: ['old'], label: 'Highlights', onchange })
  const input = screen.getByRole('textbox')
  await user.click(input)
  await user.clear(input)
  await user.type(input, 'new')
  await fireEvent.keyDown(input, { key: 'Enter', isComposing: true })
  expect(input).toHaveValue('new')
  await user.keyboard('{Escape}')
  expect(input).toHaveValue('old')
  expect(onchange).toHaveBeenLastCalledWith(['old'])
})
