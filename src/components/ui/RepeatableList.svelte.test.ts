import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import RepeatableList from './RepeatableList.svelte'
import ListHarness from './ListHarness.test.svelte'

const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]

const setup = (overrides: Record<string, unknown> = {}) => {
  const onRemove = vi.fn()
  const onMove = vi.fn()
  const onAdd = vi.fn()
  render(ListHarness, { items, onAdd, onRemove, onMove, addLabel: 'Add one', ...overrides })
  return { onAdd, onRemove, onMove, user: userEvent.setup() }
}

describe('RepeatableList', () => {
  it('requires a confirming second click before deleting', async () => {
    const { onRemove, user } = setup()
    const first = screen.getAllByRole('button', { name: 'Delete' })[0]!

    await user.click(first)
    expect(onRemove).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Confirm' }))
    expect(onRemove).toHaveBeenCalledWith('a')
  })

  it('arms only one item at a time', async () => {
    const { user } = setup()
    const deletes = screen.getAllByRole('button', { name: 'Delete' })
    await user.click(deletes[0]!)
    await user.click(screen.getAllByRole('button', { name: 'Delete' })[0]!)
    expect(screen.getAllByRole('button', { name: 'Confirm' })).toHaveLength(1)
  })

  it('disarms when another action is taken', async () => {
    const { onRemove, user } = setup()
    await user.click(screen.getAllByRole('button', { name: 'Delete' })[0]!)
    await user.click(screen.getAllByRole('button', { name: 'Move down' })[0]!)
    expect(screen.queryByRole('button', { name: 'Confirm' })).not.toBeInTheDocument()
    expect(onRemove).not.toHaveBeenCalled()
  })

  it('disables move up on the first item and move down on the last', () => {
    setup()
    const ups = screen.getAllByRole('button', { name: 'Move up' })
    const downs = screen.getAllByRole('button', { name: 'Move down' })
    expect(ups[0]).toBeDisabled()
    expect(ups[1]).toBeEnabled()
    expect(downs.at(-1)).toBeDisabled()
  })

  it('reports the move direction', async () => {
    const { onMove, user } = setup()
    await user.click(screen.getAllByRole('button', { name: 'Move down' })[0]!)
    expect(onMove).toHaveBeenCalledWith('a', 1)
    await user.click(screen.getAllByRole('button', { name: 'Move up' })[1]!)
    expect(onMove).toHaveBeenCalledWith('b', -1)
  })

  it('adds through the labelled button', async () => {
    const { onAdd, user } = setup()
    await user.click(screen.getByRole('button', { name: 'Add one' }))
    expect(onAdd).toHaveBeenCalled()
  })

  it('numbers items from one', () => {
    setup()
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('renders nothing but the add button for an empty list', () => {
    render(RepeatableList as never, {
      items: [],
      addLabel: 'Add one',
      onAdd: vi.fn(),
      onRemove: vi.fn(),
      onMove: vi.fn(),
      children: undefined,
    } as never)
    expect(screen.queryAllByRole('button', { name: 'Delete' })).toHaveLength(0)
  })
})
