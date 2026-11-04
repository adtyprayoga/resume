/**
 * Extraction API contract (services/pdf-import/app/models.py). Not the CV schema:
 * mapper.ts turns these blocks into a ResumeDocument. Types alone prove nothing
 * about a response; validate.ts checks every field at runtime.
 */

export const CONTRACT_VERSION = 1
export const MAX_BLOCKS = 5000
export const MAX_BLOCK_TEXT = 20_000

export interface BBox {
  l: number
  t: number
  r: number
  b: number
}

export interface SourceBlock {
  /** `b1`, `b2`, … in reading order. */
  id: string
  page: number
  /** Docling layout label: `title`, `section_header`, `text`, `list_item`, `table`, … */
  label: string
  /** Shared by blocks Docling grouped together (a bullet list), else null. */
  group: string | null
  text: string
  bbox: BBox | null
}

export interface Extraction {
  contract_version: typeof CONTRACT_VERSION
  pages: number
  blocks: SourceBlock[]
}

export const ERROR_CODES = [
  'invalid_file',
  'too_large',
  'too_many_pages',
  'encrypted',
  'empty_extraction',
  'timeout',
  'conversion_failed',
  'busy',
  'not_found',
  'cancelled',
] as const
export type ErrorCode = (typeof ERROR_CODES)[number]

export interface JobError {
  code: ErrorCode
  retryable: boolean
}

export type Stage = 'queued' | 'extracting' | 'done'

export type JobStatus =
  | { id: string; status: 'processing'; stage: Stage | null }
  | { id: string; status: 'completed'; stage: Stage | null; result: Extraction }
  | { id: string; status: 'failed'; stage: Stage | null; error: JobError }

export interface Health {
  ready: boolean
  busy: boolean
  limits: { max_bytes: number; max_pages: number; timeout_seconds: number }
}
