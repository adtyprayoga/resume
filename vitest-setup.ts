import '@testing-library/jest-dom/vitest'

/**
 * jsdom has no layout engine and therefore no ResizeObserver. The page-break
 * overlay uses one to know when to remeasure. A no-op stub lets components
 * mount; the pagination itself is covered by pure unit tests, and the real
 * geometry is verified against a rendered PDF by scripts/verify-print.sh.
 */
if (!('ResizeObserver' in globalThis)) {
  class ResizeObserverStub implements ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  Object.defineProperty(globalThis, 'ResizeObserver', {
    writable: true,
    configurable: true,
    value: ResizeObserverStub,
  })
}
