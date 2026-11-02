import { afterEach, describe, expect, it, vi } from 'vitest'
import { trackAnchor } from './anchor'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

const frames = () => {
  const queue = new Map<number, FrameRequestCallback>()
  let next = 0
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { queue.set(++next, callback); return next })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => { queue.delete(id) })
  return {
    get size() { return queue.size },
    run() { const pending = [...queue.values()]; queue.clear(); for (const callback of pending) callback(0) },
  }
}

describe('trackAnchor', () => {
  it('measures once immediately', () => {
    const anchor = document.createElement('span')
    document.body.append(anchor)
    const seen: (DOMRect | null)[] = []
    const stop = trackAnchor(() => anchor, (rect) => seen.push(rect))
    expect(seen).toHaveLength(1)
    expect(seen[0]).not.toBeNull()
    stop()
    anchor.remove()
  })

  it('coalesces a burst of scroll and resize events into one frame', () => {
    const queue = frames()
    const anchor = document.createElement('span')
    document.body.append(anchor)
    let count = 0
    const stop = trackAnchor(() => anchor, () => { count += 1 })
    window.dispatchEvent(new Event('scroll'))
    window.dispatchEvent(new Event('resize'))
    document.dispatchEvent(new Event('scroll'))
    expect(queue.size).toBe(1)
    queue.run()
    expect(count).toBe(2)
    stop()
    anchor.remove()
  })

  it('reports null when the anchor disappears', () => {
    const queue = frames()
    let anchor: Element | null = document.createElement('span')
    const seen: (DOMRect | null)[] = []
    const stop = trackAnchor(() => anchor, (rect) => seen.push(rect))
    anchor = null
    window.dispatchEvent(new Event('resize'))
    queue.run()
    expect(seen.at(-1)).toBeNull()
    stop()
  })

  it('removes every listener and pending frame when stopped', () => {
    const queue = frames()
    const added = vi.spyOn(window, 'addEventListener')
    const removed = vi.spyOn(window, 'removeEventListener')
    let count = 0
    const stop = trackAnchor(() => document.body, () => { count += 1 })
    window.dispatchEvent(new Event('resize'))
    stop()
    expect(queue.size).toBe(0)
    queue.run()
    window.dispatchEvent(new Event('resize'))
    expect(queue.size).toBe(0)
    expect(count).toBe(1)
    expect(removed.mock.calls.map((call) => call[0]).sort()).toEqual(added.mock.calls.map((call) => call[0]).sort())
  })
})
