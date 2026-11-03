import { afterEach, describe, expect, it, vi } from 'vitest'
import { revealSection } from './revealSection'

afterEach(() => { document.body.innerHTML = '' })

const mount = (top: number, height = 30) => {
  document.body.innerHTML = '<section data-cv-section="awards"><h2>Awards</h2><p>x</p></section>'
  const heading = document.querySelector('h2')!
  heading.getBoundingClientRect = () => ({ top, bottom: top + height, left: 0, right: 0, width: 0, height, x: 0, y: top, toJSON: () => ({}) })
  const scroll = vi.fn()
  heading.scrollIntoView = scroll
  return scroll
}

describe('revealSection', () => {
  it('does not move a heading that is already fully visible', () => {
    const scroll = mount(100)
    expect(revealSection('awards')).toBe(false)
    expect(scroll).not.toHaveBeenCalled()
  })

  it('scrolls a heading below the viewport to the nearest edge, immediately', () => {
    const scroll = mount(window.innerHeight + 200)
    expect(revealSection('awards')).toBe(true)
    expect(scroll).toHaveBeenCalledWith({ block: 'nearest', inline: 'nearest', behavior: 'instant' })
  })

  it('scrolls a heading above the viewport', () => {
    const scroll = mount(-80)
    expect(revealSection('awards')).toBe(true)
    expect(scroll).toHaveBeenCalledTimes(1)
  })

  it('scrolls a heading cut off by the bottom edge', () => {
    const scroll = mount(window.innerHeight - 10)
    expect(revealSection('awards')).toBe(true)
    expect(scroll).toHaveBeenCalledTimes(1)
  })

  it('ignores a section that is not rendered', () => {
    expect(revealSection('awards')).toBe(false)
  })
})
