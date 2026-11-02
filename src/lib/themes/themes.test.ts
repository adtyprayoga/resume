import { describe, expect, it } from 'vitest'
import { buildThemeStyleVars, defaultTheme, FONT_SCALES, getTheme, resumeThemes, themeStyleAttr } from './index'

describe('theme registry', () => {
  it('registers at least one preset and exposes the lowest order as default', () => {
    expect(resumeThemes.length).toBeGreaterThan(0)
    expect(defaultTheme.order).toBe(Math.min(...resumeThemes.map((t) => t.order)))
  })

  it('falls back to the default for an unknown key', () => {
    expect(getTheme('nope')).toBe(defaultTheme)
    expect(getTheme(null)).toBe(defaultTheme)
  })

  it('resolves a known key', () => {
    expect(getTheme(defaultTheme.key).key).toBe(defaultTheme.key)
  })

  it('uses hex colours, not oklch, to keep the print path simple', () => {
    for (const theme of resumeThemes) {
      for (const colour of Object.values(theme.palette)) {
        expect(colour).toMatch(/^#[0-9a-f]{3,8}$/i)
      }
    }
  })
})

describe('buildThemeStyleVars', () => {
  it('emits every variable the print stylesheet reads', () => {
    const vars = buildThemeStyleVars(defaultTheme)
    for (const name of [
      '--paper-padding',
      '--section-gap',
      '--item-gap',
      '--paper-text',
      '--paper-muted',
      '--paper-rule',
      '--paper-font',
      '--paper-font-size',
      '--paper-line-height',
      '--name-font-size',
      '--title-font-size',
      '--item-title-font-size',
    ]) {
      expect(vars[name], name).toBeTruthy()
    }
  })

  it('scales every type size and leaves lengths alone', () => {
    const standard = buildThemeStyleVars(defaultTheme, 'standard')
    const large = buildThemeStyleVars(defaultTheme, 'large')
    expect(parseFloat(large['--paper-font-size']!)).toBeGreaterThan(
      parseFloat(standard['--paper-font-size']!),
    )
    expect(large['--paper-padding']).toBe(standard['--paper-padding'])
  })

  it('keeps standard scale at exactly 1 so it is the unscaled baseline', () => {
    expect(FONT_SCALES.standard).toBe(1)
    expect(buildThemeStyleVars(defaultTheme, 'standard')['--paper-font-size']).toBe(
      `${defaultTheme.type.baseSize}pt`,
    )
  })

  it('serialises to a style attribute', () => {
    const attr = themeStyleAttr(defaultTheme)
    expect(attr).toContain('--paper-text: #')
    expect(attr).toMatch(/; /)
  })
})
