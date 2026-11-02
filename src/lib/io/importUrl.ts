import { err, type Result } from '$lib/model/result'
import type { ResumeDocument } from '$lib/model/types'
import { importLimitError, MAX_IMPORT_BYTES, parseResumeJson } from './importJson'

const TIMEOUT_MS = 10_000

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>

const cancelled = () => err('The import was cancelled.', { messageKey: 'error.importCancelled' })
const timedOut = () => err('The request timed out.', { messageKey: 'error.urlTimeout' })

/**
 * Reads at most MAX_IMPORT_BYTES of the body, counting bytes as they arrive:
 * Content-Length can be absent or wrong. Returns null once the signal aborts.
 */
const readBounded = async (response: Response, signal: AbortSignal): Promise<Result<string> | null> => {
  if (!response.body) return { ok: true, value: '' }

  const reader = response.body.getReader()
  // An injected fetch may not tie the body to the signal; cancelling the reader settles a pending read.
  const stop = () => void reader.cancel().catch(() => {})
  signal.addEventListener('abort', stop, { once: true })

  const decoder = new TextDecoder()
  let bytes = 0
  let text = ''
  try {
    for (;;) {
      let chunk: ReadableStreamReadResult<Uint8Array>
      try {
        chunk = await reader.read()
      } catch {
        if (signal.aborted) return null
        return err('The response could not be read completely.', { messageKey: 'error.urlRead' })
      }
      if (signal.aborted) return null
      if (chunk.done) break

      bytes += chunk.value.byteLength
      if (bytes > MAX_IMPORT_BYTES) {
        stop()
        return importLimitError()
      }
      text += decoder.decode(chunk.value, { stream: true })
    }
  } finally {
    signal.removeEventListener('abort', stop)
  }
  return { ok: true, value: text + decoder.decode() }
}

/**
 * Loads a resume from a remote URL.
 *
 * https only (an http URL would silently downgrade a resume fetch to plaintext),
 * with a timeout, a content-type check and the same size cap as file import.
 * `signal` lets the caller cancel; cancellation is reported apart from a timeout.
 */
export const fetchResumeJson = async (
  rawUrl: string,
  fetchImpl: FetchLike = fetch,
  signal?: AbortSignal,
): Promise<Result<ResumeDocument>> => {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    return err('Enter a valid URL.', { messageKey: 'error.urlInvalid' })
  }

  if (url.protocol !== 'https:') return err('Only https URLs are supported.', { messageKey: 'error.urlHttps' })
  if (signal?.aborted) return cancelled()

  const controller = new AbortController()
  let expired = false
  const timeout = setTimeout(() => {
    expired = true
    controller.abort()
  }, TIMEOUT_MS)
  const forward = () => controller.abort()
  signal?.addEventListener('abort', forward, { once: true })
  const aborted = () => (expired ? timedOut() : cancelled())

  try {
    const response = await fetchImpl(url.toString(), { signal: controller.signal })
    if (controller.signal.aborted) return aborted()

    if (!response.ok) return err(`The server returned ${response.status}.`, { messageKey: 'error.urlStatus', messageParams: { status: response.status } })

    const contentType = response.headers.get('content-type') ?? ''
    if (!/\bjson\b/i.test(contentType)) {
      return err(`That URL did not return JSON (content type "${contentType || 'unknown'}").`, { messageKey: 'error.urlContentType', messageParams: { contentType: contentType || 'unknown' } })
    }

    // An honest header lets us refuse early; the byte count below is what is enforced.
    const declared = Number(response.headers.get('content-length') ?? '')
    if (Number.isFinite(declared) && declared > MAX_IMPORT_BYTES) {
      void response.body?.cancel().catch(() => {})
      return importLimitError()
    }

    const body = await readBounded(response, controller.signal)
    if (body === null) return aborted()
    if (!body.ok) return body
    return parseResumeJson(body.value)
  } catch {
    if (controller.signal.aborted) return aborted()
    return err('That URL could not be reached.', { messageKey: 'error.urlUnreachable' })
  } finally {
    clearTimeout(timeout)
    signal?.removeEventListener('abort', forward)
  }
}
