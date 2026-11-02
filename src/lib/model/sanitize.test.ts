import { describe, expect, it } from 'vitest'
import { safeHref, safeImageSrc } from './sanitize'

describe('safeHref', () => {
  it('allows http, https and mailto', () => {
    expect(safeHref('https://example.com')).toBe('https://example.com')
    expect(safeHref('http://example.com')).toBe('http://example.com')
    expect(safeHref('mailto:a@b.c')).toBe('mailto:a@b.c')
  })

  it('rejects javascript: in any casing or with padding', () => {
    expect(safeHref('javascript:alert(1)')).toBe('')
    expect(safeHref('JavaScript:alert(1)')).toBe('')
    expect(safeHref('  javascript:alert(1)')).toBe('')
    expect(safeHref('java\tscript:alert(1)')).toBe('')
  })

  it('rejects data: and other schemes', () => {
    expect(safeHref('data:text/html,<script>')).toBe('')
    expect(safeHref('vbscript:x')).toBe('')
    expect(safeHref('file:///etc/passwd')).toBe('')
  })

  it('passes through blank and keeps protocol-relative out', () => {
    expect(safeHref('')).toBe('')
    expect(safeHref('//evil.com')).toBe('')
  })

  it('allows same-origin relative links', () => {
    expect(safeHref('/about')).toBe('/about')
    expect(safeHref('./cv.pdf')).toBe('./cv.pdf')
  })
})

describe('safeImageSrc', () => {
  it('allows http and https', () => {
    expect(safeImageSrc('https://example.com/a.png')).toBe('https://example.com/a.png')
  })

  it('allows only raster data URLs, not svg', () => {
    expect(safeImageSrc('data:image/png;base64,AAA')).toBe('data:image/png;base64,AAA')
    expect(safeImageSrc('data:image/jpeg;base64,AAA')).toBe('data:image/jpeg;base64,AAA')
    expect(safeImageSrc('data:image/svg+xml;base64,AAA')).toBe('')
    expect(safeImageSrc('data:text/html,<script>')).toBe('')
  })

  it('rejects javascript: and mailto:', () => {
    expect(safeImageSrc('javascript:alert(1)')).toBe('')
    expect(safeImageSrc('mailto:a@b.c')).toBe('')
  })

  it('allows a self-hosted relative image but not a protocol-relative one', () => {
    expect(safeImageSrc('/images/me.png')).toBe('/images/me.png')
    expect(safeImageSrc('avatar.jpg')).toBe('avatar.jpg')
    expect(safeImageSrc('//evil.com/x.png')).toBe('')
  })
})
