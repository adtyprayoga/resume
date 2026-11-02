import { safeImageSrc } from '$lib/model/sanitize'

export type ImageSource =
  | { kind: 'none' }
  /** A raster data URL: no network at all. */
  | { kind: 'embedded' }
  | { kind: 'same-origin' }
  /** Loading it contacts `host`, so it waits for consent. */
  | { kind: 'remote-https'; url: string; host: string }
  /** Never loaded: plaintext would expose the request and allow tampering. */
  | { kind: 'remote-http'; host: string }
  | { kind: 'blocked' }

const currentPage = () => globalThis.location?.href ?? 'http://localhost/'

/**
 * One policy for every place a photo is previewed. Parsing with `URL` and
 * comparing origins avoids prefix tricks like `https://this-site.evil.test`.
 */
export const classifyImageSource = (value: string, base: string = currentPage()): ImageSource => {
  if (!value.trim()) return { kind: 'none' }

  let url: URL
  let page: URL
  try {
    page = new URL(base)
    url = new URL(value.trim(), page)
  } catch {
    return { kind: 'blocked' }
  }

  if (url.protocol === 'data:') return safeImageSrc(value) ? { kind: 'embedded' } : { kind: 'blocked' }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return { kind: 'blocked' }
  if (url.origin === page.origin) return { kind: 'same-origin' }
  return url.protocol === 'https:'
    ? { kind: 'remote-https', url: url.href, host: url.host }
    : { kind: 'remote-http', host: url.host }
}
