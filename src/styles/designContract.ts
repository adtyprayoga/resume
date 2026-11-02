/**
 * Enforces design.md's rules on chrome stylesheets. Regex-level parsing is
 * enough: the audited files are hand-written CSS with one declaration per line.
 */

/** Repo-relative paths of stylesheets (or Svelte files with <style>) migrated to the tokens. */
export const CHROME_SOURCES: string[] = [
  'src/components/ui/field.css',
  'src/components/editor/drawer.css',
  'src/components/ImportDialog.svelte',
  'src/components/RecoveryScreen.svelte',
  'src/components/shell/shell.css',
]

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

const declarations = (css: string): Array<[string, string]> => {
  const result: Array<[string, string]> = []
  for (const [, body] of css.matchAll(/\{([^{}]*)\}/g)) {
    for (const raw of body!.split(';')) {
      const colon = raw.indexOf(':')
      if (colon < 0) continue
      const prop = raw.slice(0, colon).trim().toLowerCase()
      const value = raw.slice(colon + 1).replace(/!important/g, '').trim()
      if (prop && value) result.push([prop, value])
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

  for (const [prop, value] of declarations(rest)) {
    if (/#[0-9a-f]{3,8}\b|\b(rgba?|hsla?)\(|\b(black|white)\b/i.test(value)) report('colour-literal', prop, value)
    if (/^border(-[a-z]+)*-radius$/.test(prop) && value !== '0') report('radius', prop, value)
    if (prop === 'z-index' && !Z_INDEX.test(value)) report('z-index', prop, value)
    if (prop === 'transition' || prop === 'transition-property') {
      const names = value.split(',').map((part) => part.trim().split(/\s+/)[0]!)
      if (names.some((name) => !TRANSITIONABLE.has(name))) report('transition', prop, value)
    }
    if ((prop === 'font-size' || prop === 'font') && tooSmall(value)) report('font-size', prop, value)
    if ((prop === 'font-family' || prop === 'font') && value !== 'inherit' && !/var\(--font-(sans|mono)\)/.test(value)) {
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
