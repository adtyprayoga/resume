import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Autosaver, AUTOSAVE_DELAY_MS } from './autosave'
import { emptyDocument } from '$lib/model/document'
import { DOCUMENT_KEY } from '$lib/storage/persist'
import type { SaveStatus } from '$lib/storage/persist'

beforeEach(() => {
  vi.useFakeTimers()
  localStorage.clear()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('Autosaver', () => {
  it('does not write before the delay elapses', () => {
    const saver = new Autosaver(() => {})
    saver.schedule(emptyDocument())
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS - 1)
    expect(localStorage.getItem(DOCUMENT_KEY)).toBeNull()
    vi.advanceTimersByTime(1)
    expect(localStorage.getItem(DOCUMENT_KEY)).not.toBeNull()
  })

  it('coalesces rapid edits into a single write', () => {
    const statuses: SaveStatus[] = []
    const saver = new Autosaver((s) => statuses.push(s))
    for (let i = 0; i < 5; i += 1) {
      saver.schedule(emptyDocument())
      vi.advanceTimersByTime(100)
    }
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS)
    expect(statuses).toHaveLength(1)
  })

  it('reports the save status', () => {
    const statuses: SaveStatus[] = []
    const saver = new Autosaver((s) => statuses.push(s))
    saver.schedule(emptyDocument())
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS)
    expect(statuses[0]?.kind).toBe('saved')
  })

  it('cancel prevents a pending write', () => {
    const saver = new Autosaver(() => {})
    saver.schedule(emptyDocument())
    expect(saver.pending).toBe(true)
    saver.cancel()
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS * 2)
    expect(localStorage.getItem(DOCUMENT_KEY)).toBeNull()
    expect(saver.pending).toBe(false)
  })

  it('flush writes immediately and drops the pending timer', () => {
    const saver = new Autosaver(() => {})
    saver.schedule(emptyDocument())
    saver.flush(emptyDocument())
    expect(localStorage.getItem(DOCUMENT_KEY)).not.toBeNull()
    expect(saver.pending).toBe(false)
  })
})
