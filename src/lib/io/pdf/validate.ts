import { isRecord } from '$lib/model/coerce'
import { err, ok, type Result } from '$lib/model/result'
import {
  CONTRACT_VERSION,
  ERROR_CODES,
  MAX_BLOCK_TEXT,
  MAX_BLOCKS,
  type BBox,
  type ErrorCode,
  type Extraction,
  type Health,
  type JobError,
  type JobStatus,
  type SourceBlock,
  type Stage,
} from './types'

/**
 * Strict runtime checks of backend responses. Unlike document import (which
 * coerces leniently), a malformed extraction response is rejected whole: it
 * means the backend and this build disagree on the contract.
 */

class Invalid extends Error {}

const fail = (what: string): never => {
  throw new Invalid(what)
}

const keys = (value: Record<string, unknown>, allowed: readonly string[], what: string) => {
  for (const key of Object.keys(value)) if (!allowed.includes(key)) fail(`${what}: unexpected ${key}`)
}

const record = (value: unknown, what: string): Record<string, unknown> =>
  isRecord(value) ? value : fail(`${what}: not an object`)

const num = (value: unknown, what: string): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fail(`${what}: not a number`)

const int = (value: unknown, what: string, min: number): number => {
  const n = num(value, what)
  return Number.isInteger(n) && n >= min ? n : fail(`${what}: out of range`)
}

const bool = (value: unknown, what: string): boolean => (typeof value === 'boolean' ? value : fail(`${what}: not a boolean`))

const version = (value: Record<string, unknown>) => {
  if (value.contract_version !== CONTRACT_VERSION) fail('unsupported contract version')
}

const bbox = (value: unknown): BBox | null => {
  if (value === null || value === undefined) return null
  const raw = record(value, 'bbox')
  keys(raw, ['l', 't', 'r', 'b'], 'bbox')
  return { l: num(raw.l, 'bbox.l'), t: num(raw.t, 'bbox.t'), r: num(raw.r, 'bbox.r'), b: num(raw.b, 'bbox.b') }
}

const block = (value: unknown): SourceBlock => {
  const raw = record(value, 'block')
  keys(raw, ['id', 'page', 'label', 'group', 'text', 'bbox'], 'block')
  const { id, label, group, text } = raw
  if (typeof id !== 'string' || !/^b[1-9][0-9]*$/.test(id)) fail('block.id')
  if (typeof label !== 'string' || label.length > 64) fail('block.label')
  if (group !== null && group !== undefined && (typeof group !== 'string' || !/^g[1-9][0-9]*$/.test(group))) fail('block.group')
  if (typeof text !== 'string' || text.length === 0 || text.length > MAX_BLOCK_TEXT) fail('block.text')
  return {
    id: id as string,
    page: int(raw.page, 'block.page', 1),
    label: label as string,
    group: (group as string | null | undefined) ?? null,
    text: text as string,
    bbox: bbox(raw.bbox),
  }
}

const extraction = (value: unknown): Extraction => {
  const raw = record(value, 'result')
  keys(raw, ['contract_version', 'pages', 'blocks'], 'result')
  version(raw)
  if (!Array.isArray(raw.blocks) || raw.blocks.length > MAX_BLOCKS) fail('result.blocks')
  const blocks = (raw.blocks as unknown[]).map(block)
  const ids = new Set(blocks.map((b) => b.id))
  if (ids.size !== blocks.length) fail('duplicate block id')
  const pages = int(raw.pages, 'result.pages', 1)
  if (blocks.some((b) => b.page > pages)) fail('block.page beyond pages')
  return { contract_version: CONTRACT_VERSION, pages, blocks }
}

const isErrorCode = (value: unknown): value is ErrorCode => (ERROR_CODES as readonly unknown[]).includes(value)

const jobError = (value: unknown): JobError => {
  const raw = record(value, 'error')
  keys(raw, ['code', 'retryable'], 'error')
  if (!isErrorCode(raw.code)) fail('error.code')
  return { code: raw.code as ErrorCode, retryable: bool(raw.retryable, 'error.retryable') }
}

const STAGES: readonly (Stage | null)[] = ['queued', 'extracting', 'done', null]

const guard = <T>(parse: () => T): Result<T> => {
  try {
    return ok(parse())
  } catch (error) {
    if (error instanceof Invalid) return err(`Unexpected response from the PDF service (${error.message}).`, { messageKey: 'pdf.error.contract' })
    throw error
  }
}

export const parseJobStatus = (value: unknown): Result<JobStatus> =>
  guard(() => {
    const raw = record(value, 'job')
    keys(raw, ['contract_version', 'id', 'status', 'stage', 'result', 'error'], 'job')
    version(raw)
    const id = typeof raw.id === 'string' && /^[A-Za-z0-9_-]{43}$/.test(raw.id) ? raw.id : fail('job.id')
    const stage = (raw.stage ?? null) as Stage | null
    if (!STAGES.includes(stage)) fail('job.stage')
    switch (raw.status) {
      case 'processing':
        return { id, status: 'processing', stage }
      case 'completed':
        return { id, status: 'completed', stage, result: extraction(raw.result) }
      case 'failed':
        return { id, status: 'failed', stage, error: jobError(raw.error) }
      default:
        return fail('job.status')
    }
  })

export const parseHealth = (value: unknown): Result<Health> =>
  guard(() => {
    const raw = record(value, 'health')
    keys(raw, ['contract_version', 'ready', 'busy', 'limits'], 'health')
    version(raw)
    const limits = record(raw.limits, 'limits')
    keys(limits, ['max_bytes', 'max_pages', 'timeout_seconds'], 'limits')
    return {
      ready: bool(raw.ready, 'ready'),
      busy: bool(raw.busy, 'busy'),
      limits: {
        max_bytes: int(limits.max_bytes, 'max_bytes', 1),
        max_pages: int(limits.max_pages, 'max_pages', 1),
        timeout_seconds: int(limits.timeout_seconds, 'timeout_seconds', 1),
      },
    }
  })

/** The `{ error: { code, retryable } }` body of a non-2xx response, or null. */
export const parseErrorBody = (value: unknown): JobError | null => {
  try {
    return jobError(record(value, 'body').error)
  } catch (error) {
    if (error instanceof Invalid) return null
    throw error
  }
}
