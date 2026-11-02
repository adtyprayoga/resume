import { afterEach, describe, expect, it, vi } from 'vitest'
import { MAX_IMPORT_BYTES, readResumeFile } from './importJson'
import { fetchResumeJson } from './importUrl'
import { emptyDocument } from '$lib/model/document'

const encoder = new TextEncoder()

/** Valid resume JSON padded to exactly `bytes` UTF-8 bytes. */
const paddedJson = (bytes: number) => {
  const base = JSON.stringify({ ...emptyDocument(), pad: '' })
  return base.replace('"pad":""', `"pad":"${'x'.repeat(bytes - encoder.encode(base).byteLength)}"`)
}

/** A pull-based body: each chunk is produced only when read, so `pulled` shows how far reading got. */
const streamed = (chunks: Uint8Array[], options: { failAfter?: number; hang?: boolean } = {}) => {
  const state = { pulled: 0, cancelled: false }
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (options.failAfter !== undefined && state.pulled >= options.failAfter) {
        controller.error(new TypeError('connection reset'))
        return
      }
      const next = chunks[state.pulled]
      if (!next) {
        if (options.hang) return new Promise<void>(() => {})
        controller.close()
        return
      }
      state.pulled += 1
      controller.enqueue(next)
    },
    cancel() { state.cancelled = true },
  }, { highWaterMark: 0 })
  return { body, state }
}

const respond = (body: BodyInit | ReadableStream<Uint8Array>, headers: Record<string, string> = {}) =>
  async () => new Response(body as BodyInit, { headers: { 'content-type': 'application/json', ...headers } })

afterEach(() => { vi.useRealTimers() })

describe('readResumeFile', () => {
  it('rejects an oversized file without reading it', async () => {
    const file = new File(['{}'], 'big.json')
    Object.defineProperty(file, 'size', { value: MAX_IMPORT_BYTES + 1 })
    const text = vi.fn(async () => '{}')
    Object.defineProperty(file, 'text', { value: text })
    const result = await readResumeFile(file)
    expect(result).toMatchObject({ ok: false, messageKey: 'error.importLimit' })
    expect(text).not.toHaveBeenCalled()
  })

  it('accepts a file of exactly the limit', async () => {
    const result = await readResumeFile(new File([paddedJson(MAX_IMPORT_BYTES)], 'cv.json'))
    expect(result.ok).toBe(true)
  })
})

describe('fetchResumeJson reads a bounded body', () => {
  it('accepts a body of exactly the limit and rejects one byte more', async () => {
    expect((await fetchResumeJson('https://x.co/cv.json', respond(paddedJson(MAX_IMPORT_BYTES)))).ok).toBe(true)
    expect(await fetchResumeJson('https://x.co/cv.json', respond(paddedJson(MAX_IMPORT_BYTES + 1))))
      .toMatchObject({ ok: false, messageKey: 'error.importLimit' })
  })

  it('stops and cancels a chunked body without Content-Length as soon as it passes the limit', async () => {
    const chunk = new Uint8Array(400_000).fill(0x20)
    const { body, state } = streamed([chunk, chunk, chunk, chunk, chunk])
    const result = await fetchResumeJson('https://x.co/cv.json', respond(body))
    expect(result).toMatchObject({ ok: false, messageKey: 'error.importLimit' })
    expect(state.pulled).toBe(3)
    expect(state.cancelled).toBe(true)
  })

  it('ignores a dishonest Content-Length', async () => {
    const chunk = new Uint8Array(600_000).fill(0x20)
    const { body, state } = streamed([chunk, chunk])
    const result = await fetchResumeJson('https://x.co/cv.json', respond(body, { 'content-length': '12' }))
    expect(result).toMatchObject({ ok: false, messageKey: 'error.importLimit' })
    expect(state.cancelled).toBe(true)
  })

  it('counts bytes, not characters, and decodes characters split across chunks', async () => {
    const doc = emptyDocument()
    doc.profile.text.en.name = 'Śrī Ayu 日本'
    const bytes = encoder.encode(JSON.stringify(doc))
    const split = bytes.indexOf(0xe6) + 1 // inside the first byte sequence of 日
    const { body } = streamed([bytes.slice(0, split), bytes.slice(split)])
    const result = await fetchResumeJson('https://x.co/cv.json', respond(body))
    expect(result.ok && result.value.profile.text.en.name).toBe('Śrī Ayu 日本')

    const wide = 'é'.repeat(MAX_IMPORT_BYTES / 2 + 1) // fewer characters than the limit, more bytes
    expect(await fetchResumeJson('https://x.co/cv.json', respond(wide)))
      .toMatchObject({ ok: false, messageKey: 'error.importLimit' })
  })

  it('reports a stream that fails mid-body', async () => {
    const { body } = streamed([encoder.encode('{"schema')], { failAfter: 1 })
    expect(await fetchResumeJson('https://x.co/cv.json', respond(body)))
      .toMatchObject({ ok: false, messageKey: 'error.urlRead' })
  })

  it('times out a body that stops arriving and cancels it', async () => {
    vi.useFakeTimers()
    const { body, state } = streamed([encoder.encode('{')], { hang: true })
    const pending = fetchResumeJson('https://x.co/cv.json', respond(body))
    await vi.advanceTimersByTimeAsync(10_000)
    expect(await pending).toMatchObject({ ok: false, messageKey: 'error.urlTimeout' })
    expect(state.cancelled).toBe(true)
  })

  it('passes a caller signal to fetch and reports cancellation distinctly from a timeout', async () => {
    const caller = new AbortController()
    let seen: AbortSignal | undefined
    const pending = fetchResumeJson('https://x.co/cv.json', (_url, init) => {
      seen = init?.signal ?? undefined
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
      })
    }, caller.signal)
    caller.abort()
    expect(await pending).toMatchObject({ ok: false, messageKey: 'error.importCancelled' })
    expect(seen?.aborted).toBe(true)
  })

  it('cancels the body when the caller aborts while it is being read', async () => {
    const caller = new AbortController()
    const { body, state } = streamed([encoder.encode('{')], { hang: true })
    const pending = fetchResumeJson('https://x.co/cv.json', respond(body), caller.signal)
    await new Promise((resolve) => setTimeout(resolve, 0))
    caller.abort()
    expect(await pending).toMatchObject({ ok: false, messageKey: 'error.importCancelled' })
    expect(state.cancelled).toBe(true)
  })

  it('does not fetch at all when the caller has already aborted', async () => {
    const caller = new AbortController()
    caller.abort()
    const fetchImpl = vi.fn(respond('{}'))
    expect(await fetchResumeJson('https://x.co/cv.json', fetchImpl, caller.signal))
      .toMatchObject({ ok: false, messageKey: 'error.importCancelled' })
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})
