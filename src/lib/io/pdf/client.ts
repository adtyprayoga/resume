import type { UiStringKey } from '$lib/i18n/ui'
import { err, ok, type Result } from '$lib/model/result'
import type { ErrorCode, Extraction, JobStatus } from './types'
import { parseErrorBody, parseJobStatus } from './validate'

/**
 * Upload, polling and cancellation for the optional PDF extraction service.
 * Job IDs live only in this closure. Every exit path that knows a job ID asks
 * the server to delete it; the server's own timeout and TTL are the fallback.
 */

export const PDF_IMPORT_BASE = '/api/pdf-import'
export const MAX_PDF_MB = 10
export const MAX_PDF_BYTES = MAX_PDF_MB * 1024 * 1024
export const MAX_PDF_PAGES = 5

/** Build-time flag; the static-only deployment leaves it unset. */
export const PDF_IMPORT_ENABLED = import.meta.env.VITE_PDF_IMPORT === '1'

export type PdfStage = 'uploading' | 'queued' | 'extracting' | 'reading'
type Failure = ErrorCode | 'unavailable' | 'contract'

export interface ConvertOptions {
  signal: AbortSignal
  onStage: (stage: PdfStage) => void
  fetch?: typeof globalThis.fetch
  pollMs?: number
  base?: string
}

const ENGLISH: Record<Failure, string> = {
  invalid_file: 'That file is not a readable PDF.',
  too_large: `That PDF is too large (limit ${MAX_PDF_MB} MB).`,
  too_many_pages: `That PDF has more than ${MAX_PDF_PAGES} pages.`,
  encrypted: 'That PDF is password-protected.',
  empty_extraction: 'No text could be found in that PDF.',
  timeout: 'Converting that PDF took too long.',
  conversion_failed: 'That PDF could not be converted.',
  busy: 'Another PDF is being converted.',
  not_found: 'The conversion expired or the server restarted.',
  cancelled: 'Conversion cancelled.',
  unavailable: 'PDF conversion is unavailable right now.',
  contract: 'The PDF service sent an unexpected response.',
}

const failure = <T>(code: Failure): Result<T> =>
  err(ENGLISH[code], {
    messageKey: (code === 'contract' ? 'pdf.error.contract' : `pdf.error.${code}`) as UiStringKey,
    messageParams: { size: MAX_PDF_MB, pages: MAX_PDF_PAGES },
  })

class Stop extends Error {
  constructor(readonly code: Failure) {
    super(code)
  }
}

const isAbort = (error: unknown) => error instanceof DOMException && error.name === 'AbortError'

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal.aborted) return reject(new DOMException('aborted', 'AbortError'))
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    const onAbort = () => {
      clearTimeout(timer)
      reject(new DOMException('aborted', 'AbortError'))
    }
    signal.addEventListener('abort', onAbort, { once: true })
  })

const readJson = async (response: Response): Promise<unknown> => {
  try {
    return await response.json()
  } catch {
    return null
  }
}

/** A non-2xx response's code: the service's JSON body if present, else the status. */
const codeOf = async (response: Response): Promise<Failure> => {
  const body = parseErrorBody(await readJson(response))
  if (body) return body.code
  if (response.status === 413) return 'too_large'
  if (response.status === 429) return 'busy'
  if (response.status === 404) return 'unavailable'
  if (response.status >= 500) return 'unavailable'
  return 'conversion_failed'
}

const statusOf = (value: unknown): JobStatus => {
  const parsed = parseJobStatus(value)
  if (!parsed.ok) throw new Stop('contract')
  return parsed.value
}

export const convertPdf = async (file: File, options: ConvertOptions): Promise<Result<Extraction>> => {
  const { signal, onStage, pollMs = 1000, base = PDF_IMPORT_BASE } = options
  const fetch = options.fetch ?? globalThis.fetch.bind(globalThis)
  if (file.size > MAX_PDF_BYTES) return failure('too_large')

  let jobId: string | null = null
  const request = async (path: string, init: RequestInit = {}) => {
    try {
      return await fetch(`${base}${path}`, { ...init, signal, cache: 'no-store', credentials: 'same-origin' })
    } catch (error) {
      if (isAbort(error) || signal.aborted) throw error
      throw new Stop('unavailable')
    }
  }
  /** Not tied to `signal`, so it still goes out after a dismissal. */
  const forget = async () => {
    if (!jobId) return
    const id = jobId
    jobId = null
    try {
      await fetch(`${base}/jobs/${id}`, { method: 'DELETE', keepalive: true, cache: 'no-store', credentials: 'same-origin' })
    } catch {
      // The server's TTL removes it anyway.
    }
  }

  try {
    onStage('uploading')
    const form = new FormData()
    form.append('file', file, 'upload.pdf')
    const created = await request('/jobs', { method: 'POST', body: form })
    if (created.status !== 202) throw new Stop(await codeOf(created))
    let status = statusOf(await readJson(created))
    jobId = status.id

    while (status.status === 'processing') {
      onStage(status.stage === 'queued' ? 'queued' : 'extracting')
      await sleep(pollMs, signal)
      const polled = await request(`/jobs/${jobId}`)
      if (!polled.ok) throw new Stop(await codeOf(polled))
      status = statusOf(await readJson(polled))
    }

    if (status.status === 'failed') {
      jobId = null
      return failure(status.error.code)
    }
    onStage('reading')
    await forget()
    return ok(status.result)
  } catch (error) {
    await forget()
    if (isAbort(error) || signal.aborted) return failure('cancelled')
    if (error instanceof Stop) return failure(error.code)
    return failure('conversion_failed')
  }
}
