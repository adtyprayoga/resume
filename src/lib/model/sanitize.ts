/**
 * URL allowlisting for the two places imported strings reach the DOM as a URL:
 * `<a href>` and `<img src>`. Svelte escapes `{text}`, so plain text is safe —
 * these two are not.
 */

/** Strips the characters browsers tolerate inside a scheme but humans don't see. */
const normalizeScheme = (value: string): string =>
  value.replace(/[\u0000- ]/g, '').toLowerCase()

const LINK_SCHEMES = ['http:', 'https:', 'mailto:']

/** Raster only. `data:image/svg+xml` can carry script, so it is not allowed. */
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

/** Returns the URL unchanged if its scheme is allowed for a link, else `''`. */
export const safeHref = (value: string): string => {
  const trimmed = value.trim()
  if (!trimmed) return ''
  const scheme = schemeOf(trimmed)
  if (!scheme) return ''
  return LINK_SCHEMES.includes(scheme) ? trimmed : ''
}

/** Returns the URL unchanged if it is usable as an image source, else `''`. */
export const safeImageSrc = (value: string): string => {
  const trimmed = value.trim()
  if (!trimmed) return ''
  const normalized = normalizeScheme(trimmed)
  if (normalized.startsWith('data:')) {
    return IMAGE_DATA_PREFIXES.some((prefix) => normalized.startsWith(prefix)) ? trimmed : ''
  }
  const scheme = schemeOf(trimmed)
  return scheme === 'http:' || scheme === 'https:' ? trimmed : ''
}
