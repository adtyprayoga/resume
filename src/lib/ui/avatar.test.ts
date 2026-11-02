import { describe, expect, it } from 'vitest'
import { checkSource, dataUrlBytes, fitWithin, MAX_SOURCE_BYTES } from './avatar'

describe('checkSource', () => {
  it('accepts the common raster types', () => {
    for (const type of ['image/png', 'image/jpeg', 'image/webp', 'image/gif']) {
      expect(checkSource({ type, size: 1000 })).toBeNull()
    }
  })

  it('rejects SVG, which can carry script', () => {
    expect(checkSource({ type: 'image/svg+xml', size: 1000 })).toMatch(/PNG, JPEG/)
  })

  it('rejects non-images', () => {
    expect(checkSource({ type: 'application/pdf', size: 10 })).toMatch(/PNG, JPEG/)
  })

  it('rejects a file too large to decode', () => {
    expect(checkSource({ type: 'image/png', size: MAX_SOURCE_BYTES + 1 })).toMatch(/too large/)
  })
})

describe('fitWithin', () => {
  it('leaves a small image alone', () => {
    expect(fitWithin(100, 80, 320)).toEqual({ width: 100, height: 80 })
  })

  it('scales the longest side down and keeps the ratio', () => {
    expect(fitWithin(1600, 800, 320)).toEqual({ width: 320, height: 160 })
    expect(fitWithin(800, 1600, 320)).toEqual({ width: 160, height: 320 })
  })

  it('handles a square', () => {
    expect(fitWithin(4000, 4000, 320)).toEqual({ width: 320, height: 320 })
  })
})

describe('dataUrlBytes', () => {
  it('measures decoded size, not string length', () => {
    // "AAAA" base64 decodes to 3 bytes.
    expect(dataUrlBytes('data:image/jpeg;base64,AAAA')).toBe(3)
  })

  it('accounts for padding', () => {
    expect(dataUrlBytes('data:image/jpeg;base64,AAA=')).toBe(2)
    expect(dataUrlBytes('data:image/jpeg;base64,AA==')).toBe(1)
  })
})
