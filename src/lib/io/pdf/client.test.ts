import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { convertPdf, MAX_PDF_BYTES, type PdfStage } from './client'

const CONTRACT = resolve(__dirname, '../../../../services/pdf-import/tests/fixtures/contract/valid')
const completed = JSON.parse(readFileSync(resolve(CONTRACT, 'job_completed.json'), 'utf8'))
const processing = JSON.parse(readFileSync(resolve(CONTRACT, 'job_processing.json'), 'utf8'))
const failed = JSON.parse(readFileSync(resolve(CONTRACT, 'job_failed.json'), 'utf8'))
const ID = completed.id as string

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } })

type Handler = (method: string, url: string, init?: RequestInit) => Response | Promise<Response>

const server = (handler: Handler) => {
  const calls: string[] = []
  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    const url = String(input)
    calls.push(`${method} ${url}`)
    if (init?.signal?.aborted) throw new DOMException('aborted', 'AbortError')
    return handler(method, url, init)
  })
  return { fetch: fetch as unknown as typeof globalThis.fetch, calls }
}

const pdf = () => new File(['%PDF-1.7 test'], 'cv.pdf', { type: 'application/pdf' })

const run = (fetch: typeof globalThis.fetch, signal = new AbortController().signal) => {
  const stages: PdfStage[] = []
  const done = convertPdf(pdf(), { fetch, signal, pollMs: 0, onStage: (stage) => stages.push(stage) })
  return { done, stages }
}

describe('convertPdf', () => {
  it('uploads, polls, retrieves and then deletes the server result', async () => {
    let polls = 0
    const { fetch, calls } = server((method) => {
      if (method === 'POST') return json({ ...processing, stage: 'queued' }, 202)
      if (method === 'DELETE') return new Response(null, { status: 204 })
      polls += 1
      return json(polls < 2 ? processing : completed)
    })
    const { done, stages } = run(fetch)
    const result = await done
    expect(result.ok && result.value.blocks[0]!.text).toBe('Jane Doe')
    expect(stages).toEqual(['uploading', 'queued', 'extracting', 'reading'])
    expect(calls).toEqual([
      'POST /api/pdf-import/jobs',
      `GET /api/pdf-import/jobs/${ID}?progress=1`,
      `GET /api/pdf-import/jobs/${ID}?progress=1`,
      `DELETE /api/pdf-import/jobs/${ID}`,
    ])
  })

  it('reports a busy server as retryable', async () => {
    const { fetch } = server(() => json({ contract_version: 1, error: { code: 'busy', retryable: true } }, 429, { 'retry-after': '30' }))
    const result = await run(fetch).done
    expect(result).toMatchObject({ ok: false, messageKey: 'pdf.error.busy' })
  })

  it('reads a proxy 413 page as too large', async () => {
    const { fetch } = server(() => new Response('<html>413</html>', { status: 413 }))
    expect(await run(fetch).done).toMatchObject({ ok: false, messageKey: 'pdf.error.too_large' })
  })

  it.each([502, 503, 504])('reads %i as unavailable', async (status) => {
    const { fetch } = server(() => new Response('bad gateway', { status }))
    expect(await run(fetch).done).toMatchObject({ ok: false, messageKey: 'pdf.error.unavailable' })
  })

  it('reads a network failure as unavailable', async () => {
    const { fetch } = server(() => {
      throw new TypeError('Failed to fetch')
    })
    expect(await run(fetch).done).toMatchObject({ ok: false, messageKey: 'pdf.error.unavailable' })
  })

  it('reports a failed conversion with its code', async () => {
    const { fetch } = server((method) => (method === 'POST' ? json(processing, 202) : json(failed)))
    expect(await run(fetch).done).toMatchObject({ ok: false, messageKey: 'pdf.error.timeout' })
  })

  it('reports an expired job', async () => {
    const { fetch } = server((method) =>
      method === 'POST' ? json(processing, 202) : json({ contract_version: 1, error: { code: 'not_found', retryable: true } }, 404),
    )
    expect(await run(fetch).done).toMatchObject({ ok: false, messageKey: 'pdf.error.not_found' })
  })

  it('rejects a response that breaks the contract and still cleans up', async () => {
    const { fetch, calls } = server((method) => {
      if (method === 'POST') return json(processing, 202)
      if (method === 'DELETE') return new Response(null, { status: 204 })
      return json({ ...completed, contract_version: 2 })
    })
    expect(await run(fetch).done).toMatchObject({ ok: false, messageKey: 'pdf.error.contract' })
    expect(calls.at(-1)).toBe(`DELETE /api/pdf-import/jobs/${ID}`)
  })

  it('reports a polling failure as unavailable and asks the server to cancel', async () => {
    const { fetch, calls } = server((method) => {
      if (method === 'POST') return json(processing, 202)
      if (method === 'DELETE') return new Response(null, { status: 204 })
      throw new TypeError('Failed to fetch')
    })
    expect(await run(fetch).done).toMatchObject({ ok: false, messageKey: 'pdf.error.unavailable' })
    expect(calls.at(-1)).toBe(`DELETE /api/pdf-import/jobs/${ID}`)
  })

  it('stops polling and cancels on the server when aborted', async () => {
    const controller = new AbortController()
    const { fetch, calls } = server((method) => {
      if (method === 'POST') return json(processing, 202)
      if (method === 'DELETE') return new Response(null, { status: 204 })
      controller.abort()
      return json(processing)
    })
    const result = await run(fetch, controller.signal).done
    expect(result).toMatchObject({ ok: false, messageKey: 'pdf.error.cancelled' })
    const deletes = calls.filter((c) => c.startsWith('DELETE'))
    expect(deletes).toEqual([`DELETE /api/pdf-import/jobs/${ID}`])
    expect(calls.filter((c) => c.startsWith('GET'))).toHaveLength(1)
    const deleteInit = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.find(([, init]) => init?.method === 'DELETE')![1]
    expect(deleteInit.keepalive).toBe(true)
    expect(deleteInit.signal).toBeUndefined()
  })

  it('keeps polling through a transient rate limit instead of abandoning the job', async () => {
    let polls = 0
    const { fetch, calls } = server((method) => {
      if (method === 'POST') return json(processing, 202)
      if (method === 'DELETE') return new Response(null, { status: 204 })
      polls += 1
      if (polls === 1) return new Response('<html>429</html>', { status: 429 })
      return json(completed)
    })
    const result = await run(fetch).done
    expect(result.ok).toBe(true)
    expect(calls.filter((c) => c.startsWith('DELETE'))).toHaveLength(1)
    expect(calls.at(-1)).toBe(`DELETE /api/pdf-import/jobs/${ID}`)
  })

  it('reports cancellation when the user cancels while the result is being cleaned up', async () => {
    const controller = new AbortController()
    const { fetch } = server((method) => {
      if (method === 'POST') return json(processing, 202)
      if (method === 'DELETE') {
        controller.abort()
        return new Response(null, { status: 204 })
      }
      return json(completed)
    })
    const result = await convertPdf(pdf(), { fetch, signal: controller.signal, pollMs: 0, onStage: () => {} })
    expect(result).toMatchObject({ ok: false, messageKey: 'pdf.error.cancelled' })
  })

  it('rejects an oversized file before uploading', async () => {
    const { fetch, calls } = server(() => json(processing, 202))
    const big = new File(['x'], 'cv.pdf', { type: 'application/pdf' })
    Object.defineProperty(big, 'size', { value: MAX_PDF_BYTES + 1 })
    const result = await convertPdf(big, { fetch, signal: new AbortController().signal, pollMs: 0, onStage: () => {} })
    expect(result).toMatchObject({ ok: false, messageKey: 'pdf.error.too_large' })
    expect(calls).toEqual([])
  })
})

it('opts into progress, retains monotonic telemetry and supports legacy polls', async () => {
  const first = { phase: 'extracting', percent: 25, completed_pages: 1, total_pages: 5 }
  const final = { phase: 'done', percent: 100, completed_pages: 5, total_pages: 5 }
  const responses = [
    { ...processing, progress: first }, processing,
    { ...processing, progress: { ...first, percent: 12, completed_pages: 0 } },
    { ...completed, progress: final },
  ]
  const seen: unknown[] = []
  const { fetch, calls } = server((method) => method === 'POST' ? json(processing, 202) : method === 'DELETE' ? new Response(null, { status: 204 }) : json(responses.shift()))
  const result = await convertPdf(pdf(), { fetch, signal: new AbortController().signal, pollMs: 0, onStage: () => {}, onProgress: (p) => seen.push(p) })
  expect(result.ok).toBe(true)
  expect(seen).toEqual([null, first, first, first, final])
  expect(calls.filter((c) => c.startsWith('GET')).every((c) => c.endsWith('?progress=1'))).toBe(true)
})
