import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

/**
 * Enforces design.md's rules on chrome stylesheets. Regex-level parsing is
 * enough: the audited files are hand-written CSS with one declaration per line.
 */

const EXCLUDED = new Set(['src/styles/tokens.css', 'src/styles/print.css'])

const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)],
  )

/**
 * Repo-relative paths the contract audits: every chrome stylesheet and every
 * component with a <style> block. tokens.css owns the literals; print.css
 * belongs to the paper and its themes.
 */
export const chromeSources = (root: string): string[] => {
  const files = ['src/components', 'src/styles', 'src/lib/sections'].flatMap((dir) => walk(join(root, dir)))
  return files
    .map((file) => relative(root, file).split(sep).join('/'))
    .filter((path) => !EXCLUDED.has(path))
    .filter((path) =>
      path.endsWith('.css') ||
      (path.endsWith('.svelte') && /<style[\s>]/.test(readFileSync(join(root, path), 'utf8'))),
    )
    .sort()
}

const TRANSITIONABLE = new Set([
  'opacity',
  'transform',
  'translate',
  'color',
  'background-color',
  'border-color',
  'outline-color',
  'box-shadow',
  'visibility',
  'none',
])
const ANIMATABLE = new Set(['opacity', 'transform', 'translate'])
const Z_INDEX = /^(var\(--z-(base|sticky|overlay|modal|toast)\)|1)$/

const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '')

/** Removes `@keyframes name { … }` blocks (balanced braces) and returns them separately. */
const splitKeyframes = (css: string): { rest: string; keyframes: string[] } => {
  const keyframes: string[] = []
  let rest = ''
  let index = 0
  const pattern = /@keyframes\s+[\w-]+\s*\{/g
  let match: RegExpExecArray | null
  while ((match = pattern.exec(css))) {
    rest += css.slice(index, match.index)
    let depth = 1
    let cursor = match.index + match[0].length
    while (cursor < css.length && depth > 0) {
      if (css[cursor] === '{') depth += 1
      else if (css[cursor] === '}') depth -= 1
      cursor += 1
    }
    keyframes.push(css.slice(match.index, cursor))
    index = cursor
    pattern.lastIndex = cursor
  }
  rest += css.slice(index)
  return { rest, keyframes }
}

const declarations = (css: string, context: string[] = []): Array<[string, string, string[]]> => {
  const result: Array<[string, string, string[]]> = []
  let cursor = 0
  while (cursor < css.length) {
    const open = css.indexOf('{', cursor)
    if (open < 0) break
    const rule = css.slice(cursor, open).trim()
    let end = open + 1
    let depth = 1
    while (end < css.length && depth) {
      if (css[end] === '{') depth += 1
      if (css[end] === '}') depth -= 1
      end += 1
    }
    const body = css.slice(open + 1, end - 1)
    const parents = [...context, rule]
    cursor = end
    if (body.includes('{')) {
      result.push(...declarations(body, parents))
      continue
    }
    for (const raw of body.split(';')) {
      const colon = raw.indexOf(':')
      if (colon < 0) continue
      const prop = raw.slice(0, colon).trim().toLowerCase()
      const value = raw.slice(colon + 1).replace(/!important/g, '').trim()
      if (prop && value) result.push([prop, value, parents])
    }
  }
  return result
}

const tooSmall = (value: string): boolean => {
  for (const [, n] of value.matchAll(/(\d*\.?\d+)rem\b/g)) if (parseFloat(n!) < 0.75) return true
  for (const [, n] of value.matchAll(/(\d*\.?\d+)px\b/g)) if (parseFloat(n!) < 12) return true
  return false
}

export const auditCss = (css: string, source: string): string[] => {
  const violations: string[] = []
  const report = (rule: string, prop: string, value: string) =>
    violations.push(`${source}: ${rule} — ${prop}: ${value}`)
  const { rest, keyframes } = splitKeyframes(stripComments(css))

  for (const block of keyframes) {
    for (const [prop, value] of declarations(block)) {
      if (!ANIMATABLE.has(prop)) report('keyframes', prop, value)
    }
  }

  for (const [prop, value, context] of declarations(rest)) {
    if (/#[0-9a-f]{3,8}\b|\b(rgba?|hsla?)\(|\b(black|white)\b/i.test(value)) report('colour-literal', prop, value)
    const mobilePanelRadius = source === 'src/components/shell/shell.css'
      && prop === 'border-radius' && value === 'var(--radius-mobile-panel)'
      && context.length === 2 && context[0] === '@media screen and (max-width: 639px)' && context[1] === '.side-panel'
    if (/^border(-[a-z]+)*-radius$/.test(prop) && value !== '0' && !mobilePanelRadius) report('radius', prop, value)
    if (prop === 'z-index' && !Z_INDEX.test(value)) report('z-index', prop, value)
    if (prop === 'transition' || prop === 'transition-property') {
      const names = value.split(',').map((part) => part.trim().split(/\s+/)[0]!)
      if (names.some((name) => !TRANSITIONABLE.has(name))) report('transition', prop, value)
    }
    if ((prop === 'font-size' || prop === 'font') && tooSmall(value)) report('font-size', prop, value)
    if ((prop === 'font-family' || prop === 'font') && value !== 'inherit' && !/var\(--font-(sans|mono|story)\)/.test(value)) {
      report('font-family', prop, value)
    }
    if (/\b100vh\b/.test(value)) report('viewport-height', prop, value)
  }
  return violations
}

export const styleBlocks = (svelteSource: string): string =>
  [...svelteSource.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(([, body]) => body).join('\n')

const customProperties = (body: string): Record<string, string> => {
  const tokens: Record<string, string> = {}
  for (const [, name, value] of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) tokens[name!] = value!.trim()
  return tokens
}

export const readTokens = (css: string, scheme: 'light' | 'dark'): Record<string, string> => {
  const clean = stripComments(css)
  const light = customProperties(/:root[^{]*\{([^}]*)\}/.exec(clean)?.[1] ?? '')
  if (scheme === 'light') return light
  const dark = /@media\s*\(prefers-color-scheme:\s*dark\)\s*\{\s*:root\s*\{([^}]*)\}/.exec(clean)?.[1] ?? ''
  return { ...light, ...customProperties(dark) }
}

const luminance = (hex: string): number => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const channel = parseInt(hex.slice(i, i + 2), 16) / 255
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
}

/** WCAG 2 contrast ratio of two `#rrggbb` colours. */
export const contrast = (a: string, b: string): number => {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (high! + 0.05) / (low! + 0.05)
}
