import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { render } from '@testing-library/svelte'
import { tick } from 'svelte'
import PageBreakOverlay from './PageBreakOverlay.svelte'

/** jsdom has no layout: atoms carry their geometry in data attributes, the A4 probe reports 1000px. */
const SHEET = 1000

let frames: Map<number, FrameRequestCallback>
let nextFrame: number
let resizeCallbacks: ResizeObserverCallback[]
let fontsReady: { resolve: () => void }
let paper: HTMLElement

const flush = async () => {
  // MutationObserver records and promise callbacks are both microtasks.
  for (let i = 0; i < 5; i += 1) await Promise.resolve()
  await tick()
}

const runFrames = async () => {
  const pending = [...frames.values()]
  frames.clear()
  for (const callback of pending) callback(0)
  await flush()
}

const atom = (top: number, height: number) => {
  const element = document.createElement('div')
  element.dataset.breakAtom = ''
  element.dataset.top = String(top)
  element.dataset.height = String(height)
  return element
}

const guides = () =>
  [...document.querySelectorAll<HTMLElement>('.page-break')].map((element) => element.style.top)

beforeEach(() => {
  frames = new Map()
  nextFrame = 0
  resizeCallbacks = []
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    nextFrame += 1
    frames.set(nextFrame, callback)
    return nextFrame
  })
  vi.stubGlobal('cancelAnimationFrame', vi.fn((id: number) => { frames.delete(id) }))
  vi.stubGlobal('ResizeObserver', class {
    constructor(callback: ResizeObserverCallback) { resizeCallbacks.push(callback) }
    observe() {}
    disconnect() { resizeCallbacks = [] }
  })
  let resolveFonts!: () => void
  const ready = new Promise<void>((resolve) => { resolveFonts = resolve })
  fontsReady = { resolve: resolveFonts }
  Object.defineProperty(document, 'fonts', { configurable: true, value: { ready } })

  vi.spyOn(HTMLElement.prototype, 'offsetTop', 'get').mockImplementation(function (this: HTMLElement) {
    return Number(this.dataset.top ?? 0)
  })
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) {
    return this.style.height === '297mm' ? SHEET : Number(this.dataset.height ?? 0)
  })

  paper = document.createElement('article')
  paper.className = 'resume-paper'
  paper.style.padding = '0px'
  paper.append(atom(0, 600), atom(600, 600))
  document.body.append(paper)
})

afterEach(() => {
  paper.remove()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  Reflect.deleteProperty(document, 'fonts')
})

it('measures without mutating the observed paper', async () => {
  const records: MutationRecord[] = []
  const watcher = new MutationObserver((list) => records.push(...list))
  watcher.observe(paper, { childList: true, subtree: true, characterData: true, attributes: true })
  render(PageBreakOverlay, { paper })
  await runFrames()
  watcher.disconnect()
  expect(records).toEqual([])
  expect(guides()).toEqual(['600px'])
})

it('settles: an idle measurement schedules no further frames', async () => {
  render(PageBreakOverlay, { paper })
  await runFrames()
  expect(frames.size).toBe(0)
  await runFrames()
  expect(frames.size).toBe(0)
})

it('coalesces a burst of notifications into one frame', async () => {
  render(PageBreakOverlay, { paper })
  await runFrames()
  for (const callback of resizeCallbacks) callback([], {} as ResizeObserver)
  paper.append(atom(1200, 10))
  paper.append(atom(1210, 10))
  await flush()
  expect(frames.size).toBe(1)
})

it('refreshes guide positions after an edit and after a resize', async () => {
  render(PageBreakOverlay, { paper })
  await runFrames()
  expect(guides()).toEqual(['600px'])
  paper.prepend(atom(0, 300))
  paper.children[1]!.setAttribute('data-top', '300')
  paper.children[2]!.setAttribute('data-top', '900')
  await flush()
  await runFrames()
  expect(guides()).toEqual(['900px'])

  paper.children[2]!.setAttribute('data-top', '950')
  for (const callback of resizeCallbacks) callback([], {} as ResizeObserver)
  await runFrames()
  expect(guides()).toEqual(['950px'])
})

it('remeasures once fonts are ready', async () => {
  render(PageBreakOverlay, { paper })
  await runFrames()
  paper.children[1]!.setAttribute('data-top', '700')
  fontsReady.resolve()
  await flush()
  expect(frames.size).toBe(1)
  await runFrames()
  expect(guides()).toEqual(['700px'])
})

it('stops every callback on teardown, including late font readiness', async () => {
  const { unmount } = render(PageBreakOverlay, { paper })
  expect(frames.size).toBe(1)
  unmount()
  expect(frames.size).toBe(0)
  fontsReady.resolve()
  paper.append(atom(2000, 10))
  await flush()
  expect(frames.size).toBe(0)
})
