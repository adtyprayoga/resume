/**
 * Svelte escapes `{text}`, so plain strings are safe. These two sinks are not:
 * `<a href>` and `<img src>`.
 */

/** Strips characters browsers tolerate inside a scheme but humans cannot see. */
const normalizeScheme = (value: string): string =>
  value.replace(/[\u0000- ]/g, '').toLowerCase()

const LINK_SCHEMES = ['http:', 'https:', 'mailto:']

/** Raster only: `data:image/svg+xml` can carry script. */
const IMAGE_DATA_PREFIXES = [
  'data:image/png',
  'data:image/jpeg',
  'data:image/jpg',
  'data:image/gif',
  'data:image/webp',
]

const schemeOf = (value: string): string | null => {
  const match = /^([a-z][a-z0-9+.-]*):/.exec(normalizeScheme(value))
  return match?.[1] ? `${match[1]}:` : null
}

/**
 * A relative URL cannot change origin, so it is safe. The exception is the
 * protocol-relative `//host` form, which can.
 */
const isSafeRelative = (value: string): boolean =>
  schemeOf(value) === null && !normalizeScheme(value).startsWith('//')

/** The URL, or `''` if its scheme is not allowed. */
export const safeHref = (value: string): string => {
  const trimmed = value.trim()
  if (!trimmed) return ''
  const scheme = schemeOf(trimmed)
  if (!scheme) return isSafeRelative(trimmed) ? trimmed : ''
  return LINK_SCHEMES.includes(scheme) ? trimmed : ''
}

/** The URL, or `''` if it is not usable as an image source. */
export const safeImageSrc = (value: string): string => {
  const trimmed = value.trim()
  if (!trimmed) return ''
  const normalized = normalizeScheme(trimmed)
  if (normalized.startsWith('data:')) {
    return IMAGE_DATA_PREFIXES.some((prefix) => normalized.startsWith(prefix)) ? trimmed : ''
  }
  const scheme = schemeOf(trimmed)
  if (!scheme) return isSafeRelative(trimmed) ? trimmed : ''
  return scheme === 'http:' || scheme === 'https:' ? trimmed : ''
}

/**
 * Turns what people actually type into a usable URL.
 *
 * `github.com/me` has no scheme, so it would otherwise be treated as a path
 * relative to the current page. A root-relative path is left alone.
 */
export const normalizeUrl = (value: string): string => {
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (schemeOf(trimmed)) return trimmed
  if (trimmed.startsWith('//')) return `https:${trimmed}`
  if (trimmed.startsWith('/') || trimmed.startsWith('./') || trimmed.startsWith('../')) {
    return trimmed
  }

  // A dot before the first slash means it reads as a hostname.
  const firstSlash = trimmed.indexOf('/')
  const host = firstSlash === -1 ? trimmed : trimmed.slice(0, firstSlash)
  return host.includes('.') ? `https://${trimmed}` : trimmed
}
