/**
 * Keeps a floating editor aligned with the text it edits. The anchor is
 * re-resolved on every measurement, so a re-rendered element is picked up
 * instead of measuring a detached node. Scroll (any scroller, via capture),
 * window and visual-viewport resizes, and anchor resizes all ride one frame.
 */
export const trackAnchor = (
  resolve: () => Element | null,
  onRect: (rect: DOMRect | null) => void,
): (() => void) => {
  let frame = 0
  let observed: Element | null = null
  let active = true

  const measure = () => {
    frame = 0
    if (!active) return
    const element = resolve()
    if (element !== observed) {
      if (observed) resize.unobserve(observed)
      if (element) resize.observe(element)
      observed = element
    }
    onRect(element ? element.getBoundingClientRect() : null)
  }

  const schedule = () => {
    if (active && frame === 0) frame = requestAnimationFrame(measure)
  }

  const resize = new ResizeObserver(schedule)
  const options: AddEventListenerOptions = { capture: true, passive: true }
  window.addEventListener('scroll', schedule, options)
  window.addEventListener('resize', schedule, options)
  const viewport = window.visualViewport
  viewport?.addEventListener('resize', schedule)
  viewport?.addEventListener('scroll', schedule)

  measure()

  return () => {
    active = false
    cancelAnimationFrame(frame)
    frame = 0
    resize.disconnect()
    window.removeEventListener('scroll', schedule, options)
    window.removeEventListener('resize', schedule, options)
    viewport?.removeEventListener('resize', schedule)
    viewport?.removeEventListener('scroll', schedule)
  }
}
