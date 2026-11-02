import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { auditCss, CHROME_SOURCES, contrast, readTokens, styleBlocks } from './designContract'

// Read from disk: Vitest does not process CSS, so a ?raw import comes back empty.
const read = (path: string) => readFileSync(resolve(__dirname, '../..', path), 'utf8')
const tokensCss = read('src/styles/tokens.css')

describe('auditCss', () => {
  it('flags colour literals', () => {
    expect(auditCss('.a { color: #171717 }', 'x.css')).toEqual([expect.stringContaining('colour-literal')])
    expect(auditCss('.a { background: white }', 'x.css')).toHaveLength(1)
    expect(auditCss('.a { box-shadow: 0 1px 2px rgb(0 0 0 / 0.1) }', 'x.css')).toHaveLength(1)
    expect(auditCss('.a { color: var(--color-ink) }', 'x.css')).toEqual([])
  })

  it('flags non-zero radius', () => {
    expect(auditCss('.a { border-radius: 0.5rem }', 'x')).toHaveLength(1)
    expect(auditCss('.a { border-radius: 0 }', 'x')).toEqual([])
  })

  it('flags raw z-index', () => {
    expect(auditCss('.a { z-index: 45 }', 'x')).toHaveLength(1)
    expect(auditCss('.a { z-index: var(--z-overlay) }', 'x')).toEqual([])
    expect(auditCss('.a { z-index: 1 }', 'x')).toEqual([])
  })

  it('flags layout transitions and layout keyframes', () => {
    expect(auditCss('.a { transition: all 200ms }', 'x')).toHaveLength(1)
    expect(auditCss('.a { transition: height 200ms }', 'x')).toHaveLength(1)
    expect(auditCss('.a { transition: opacity 200ms, box-shadow 200ms }', 'x')).toEqual([])
    expect(auditCss('@keyframes k { from { top: 0 } }', 'x')).toHaveLength(1)
    expect(auditCss('@keyframes k { from { opacity: 0; transform: translateY(16px) } }', 'x')).toEqual([])
  })

  it('flags text below 0.75rem / 12px', () => {
    expect(auditCss('.a { font-size: 0.6875rem }', 'x')).toHaveLength(1)
    expect(auditCss('.a { font: 400 calc(11px / var(--z, 1)) / 1 var(--font-sans) }', 'x')).toHaveLength(1)
    expect(auditCss('.a { font-size: 0.85em }', 'x')).toEqual([])
    expect(auditCss('.a { font-size: var(--text-caps) }', 'x')).toEqual([])
  })

  it('flags literal font stacks and 100vh', () => {
    expect(auditCss('.a { font-family: system-ui, sans-serif }', 'x')).toHaveLength(1)
    expect(auditCss('.a { font: inherit }', 'x')).toEqual([])
    expect(auditCss('.a { min-height: 100vh }', 'x')).toHaveLength(1)
    expect(auditCss('.a { min-height: 100dvh }', 'x')).toEqual([])
  })

  it('ignores comments', () => {
    expect(auditCss('/* color: #000 */ .a { color: var(--color-ink) }', 'x')).toEqual([])
  })
})

describe('styleBlocks', () => {
  it('extracts style block contents', () => {
    expect(styleBlocks('<div></div>\n<style>\n  .a { color: red }\n</style>')).toContain('.a { color: red }')
    expect(styleBlocks('<div></div>')).toBe('')
  })
})

describe('contrast', () => {
  it('computes WCAG ratios', () => {
    expect(contrast('#ffffff', '#000000')).toBeCloseTo(21, 1)
    expect(contrast('#808080', '#ffffff')).toBeCloseTo(3.95, 1)
  })
})

const CONTRAST_PAIRS = [
  ['--color-ink', '--color-surface', 7],
  ['--color-ink', '--color-canvas', 7],
  ['--color-ink', '--color-fill-hover', 7],
  ['--color-muted', '--color-surface', 7],
  ['--color-muted', '--color-canvas', 7],
  ['--color-muted', '--color-fill-hover', 7],
  ['--color-on-accent', '--color-accent-strong', 7],
  ['--color-on-accent', '--color-accent-strong-hover', 7],
  ['--color-danger', '--color-surface', 7],
  ['--color-danger', '--color-canvas', 7],
  ['--color-danger', '--color-danger-tint', 7],
  ['--color-line', '--color-surface', 3],
  ['--color-line', '--color-canvas', 3],
  ['--color-accent-strong', '--color-surface', 3],
  ['--color-accent-strong', '--color-canvas', 3],
] as const

describe('tokens', () => {
  const light = readTokens(tokensCss, 'light')
  const dark = readTokens(tokensCss, 'dark')

  it.each(CONTRAST_PAIRS)('light %s on %s ≥ %d:1', (fg, bg, min) => {
    expect(contrast(light[fg]!, light[bg]!)).toBeGreaterThanOrEqual(min)
  })

  it.each(CONTRAST_PAIRS)('dark %s on %s ≥ %d:1', (fg, bg, min) => {
    expect(contrast(dark[fg]!, dark[bg]!)).toBeGreaterThanOrEqual(min)
  })

  it('has a distinct dark palette', () => {
    expect(dark['--color-surface']).not.toBe(light['--color-surface'])
  })

  it('paper frame re-declares the light palette', () => {
    const firstSelector = tokensCss.replace(/\/\*[\s\S]*?\*\//g, '').split('{')[0]!
    expect(firstSelector.split(',').map((part) => part.trim())).toContain('.resume-paper-frame')
    expect(tokensCss).toMatch(/@media \(prefers-color-scheme: dark\)\s*\{\s*:root\s*\{/)
  })

  it('declares color-scheme', () => {
    expect(light['--color-ink']).toBeDefined()
    expect(tokensCss).toMatch(/\.resume-paper-frame\s*\{[^}]*color-scheme: light;/)
    expect(tokensCss).toMatch(/@media \(prefers-color-scheme: dark\)\s*\{\s*:root\s*\{[^}]*color-scheme: dark;/)
  })

  it('never uses pure black', () => {
    expect(Object.values(light).map((v) => v.toLowerCase())).not.toContain('#000000')
  })
})

describe('chrome sources', () => {
  it.each(CHROME_SOURCES.length ? CHROME_SOURCES : ['(none yet)'])('%s obeys the contract', (path) => {
    if (path === '(none yet)') return
    const raw = read(path)
    expect(auditCss(path.endsWith('.svelte') ? styleBlocks(raw) : raw, path)).toEqual([])
  })
})

describe('controls', () => {
  it('controls keep 44px targets', () => {
    const css = read('src/components/editor/drawer.css')
    expect(css).toMatch(/\.tool-btn,\s*\n\.toggle-group button,\s*\n\.repeat-btn,\s*\n\.avatar-pick\s*\{[^}]*min-width: 44px;[^}]*min-height: 44px;/)
  })

  it('invalid inputs get a 2px danger border', () => {
    const css = read('src/components/ui/field.css')
    expect(css).toMatch(/\[aria-invalid='true'\][^{]*\{[^}]*border: 2px solid var\(--color-danger\)/)
  })
})

describe('navigation', () => {
  it('pressed toggle has a forced-colors outline', () => {
    const css = read('src/components/editor/drawer.css')
    expect(css).toMatch(/@media \(forced-colors: active\)\s*\{[^@]*\.toggle-group button\[aria-pressed='true'\][^}]*outline: 2px solid/)
  })

  it('marks the active toggle with the accent indicator', () => {
    const css = read('src/components/editor/drawer.css')
    expect(css).toMatch(/\.toggle-group button\[aria-pressed='true'\]\s*\{[^}]*font-weight: 500;[^}]*box-shadow: inset 0 -2px 0 var\(--color-accent-strong\)/)
  })
})

describe('motion', () => {
  it('reduced motion disables animation and transition', () => {
    const css = read('src/styles/motion.css')
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)[^@]*animation: none !important;[^}]*transition: none !important;/)
  })
})
