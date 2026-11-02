import { afterEach, expect, it, vi } from 'vitest'
import { render } from '@testing-library/svelte'
import { tick } from 'svelte'
import App from './App.svelte'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

it('fits the paper to observed preview space, caps its scale, and releases the observer', async () => {
  localStorage.clear()
  const frames: FrameRequestCallback[] = []
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frames.push(callback); return frames.length })
  const cancelFrame = vi.fn()
  vi.stubGlobal('cancelAnimationFrame', cancelFrame)
  const observed: { target: Element; resize: ResizeObserverCallback; disconnect: ReturnType<typeof vi.fn> }[] = []
  vi.stubGlobal('ResizeObserver', class {
    disconnect = vi.fn()
    constructor(private resize: ResizeObserverCallback) {}
    observe(target: Element) { observed.push({ target, resize: this.resize, disconnect: this.disconnect }) }
  })
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (this: HTMLElement) {
    return this.classList.contains('resume-paper') ? 794 : 0
  })

  const { container, unmount } = render(App)
  const preview = observed.find(entry => entry.target.classList.contains('preview-container'))!
  const frame = container.querySelector<HTMLElement>('.resume-paper-frame')!
  const resize = async (width: number) => {
    const previous = frame.style.getPropertyValue('--preview-zoom')
    preview.resize([{ contentRect: { width } } as ResizeObserverEntry], {} as ResizeObserver)
    await tick()
    expect(frame.style.getPropertyValue('--preview-zoom')).toBe(previous)
    frames.pop()?.(0)
    await tick()
  }

  await resize(343)
  expect(Number(frame.style.getPropertyValue('--preview-zoom'))).toBeCloseTo(343 / 794)
  await resize(1000)
  expect(frame.style.getPropertyValue('--preview-zoom')).toBe('1')
  preview.resize([{ contentRect: { width: 300 } } as ResizeObserverEntry], {} as ResizeObserver)
  await unmount()
  expect(cancelFrame).toHaveBeenCalled()
  expect(preview.disconnect).toHaveBeenCalledOnce()
})
