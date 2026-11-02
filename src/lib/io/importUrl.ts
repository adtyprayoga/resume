import { err, type Result } from '$lib/model/result'
import type { ResumeDocument } from '$lib/model/types'
import { MAX_IMPORT_BYTES, parseResumeJson } from './importJson'

const TIMEOUT_MS = 10_000

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>

/**
 * Loads a resume from a remote URL.
 *
 * https only (an http URL would silently downgrade a resume fetch to plaintext),
 * with a timeout, a content-type check and the same size cap as file import.
 */
export const fetchResumeJson = async (
  rawUrl: string,
  fetchImpl: FetchLike = fetch,
): Promise<Result<ResumeDocument>> => {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    return err('Enter a valid URL.')
  }

  if (url.protocol !== 'https:') return err('Only https URLs are supported.')

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const response = await fetchImpl(url.toString(), { signal: controller.signal })

    if (!response.ok) return err(`The server returned ${response.status}.`)

    const contentType = response.headers.get('content-type') ?? ''
    if (!/\bjson\b/i.test(contentType)) {
      return err(`That URL did not return JSON (content type "${contentType || 'unknown'}").`)
    }

    const declared = Number(response.headers.get('content-length') ?? '')
    if (Number.isFinite(declared) && declared > MAX_IMPORT_BYTES) {
      return err('That file is too large.')
    }

    return parseResumeJson(await response.text())
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') {
      return err('The request timed out.')
    }
    return err('That URL could not be reached.')
  } finally {
    clearTimeout(timeout)
  }
}
