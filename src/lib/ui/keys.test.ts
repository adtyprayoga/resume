import { describe, expect, it } from 'vitest'
import { historyShortcut, isTextEntry } from './keys'

const element = (html: string): Element => {
  const host = document.createElement('div')
  host.innerHTML = html
  return host.firstElementChild!
}

describe('isTextEntry', () => {
  it.each([
    ['<textarea></textarea>', true],
    ['<input>', true],
    ['<input type="text">', true],
    ['<input type="email">', true],
    ['<input type="search">', true],
    ['<input type="checkbox">', false],
    ['<input type="radio">', false],
    ['<input type="range">', false],
    ['<input type="file">', false],
    ['<button>x</button>', false],
    ['<div contenteditable="true"></div>', true],
    ['<div></div>', false],
  ])('%s is %s', (html, expected) => {
    expect(isTextEntry(element(html))).toBe(expected)
  })

  it('is false for no target', () => {
    expect(isTextEntry(null)).toBe(false)
  })
})

describe('historyShortcut', () => {
  const key = (init: KeyboardEventInit) => historyShortcut(new KeyboardEvent('keydown', init))

  it('maps undo and redo on Ctrl and Cmd', () => {
    expect(key({ key: 'z', ctrlKey: true })).toBe('undo')
    expect(key({ key: 'z', metaKey: true })).toBe('undo')
    expect(key({ key: 'Z', ctrlKey: true, shiftKey: true })).toBe('redo')
    expect(key({ key: 'z', metaKey: true, shiftKey: true })).toBe('redo')
    expect(key({ key: 'y', ctrlKey: true })).toBe('redo')
  })

  it('ignores other combinations', () => {
    expect(key({ key: 'z' })).toBeNull()
    expect(key({ key: 'z', ctrlKey: true, altKey: true })).toBeNull()
    expect(key({ key: 'x', ctrlKey: true })).toBeNull()
  })
})
