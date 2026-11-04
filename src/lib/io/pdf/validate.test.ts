import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseErrorBody, parseExtraction, parseHealth, parseJobStatus } from './validate'
import { MAX_BLOCKS } from './types'

// Shared with services/pdf-import/tests/test_api.py::TestContractFixtures.
const CONTRACT = resolve(__dirname, '../../../../services/pdf-import/tests/fixtures/contract')
const load = (dir: string, name: string): unknown => JSON.parse(readFileSync(resolve(CONTRACT, dir, name), 'utf8'))
const files = (dir: string) => readdirSync(resolve(CONTRACT, dir)).filter((name) => name.endsWith('.json'))

describe('PDF import contract', () => {
  it('accepts every valid backend fixture', () => {
    for (const name of files('valid')) {
      const data = load('valid', name)
      const result = name.startsWith('health') ? parseHealth(data) : name.startsWith('extraction') ? parseExtraction(data) : parseJobStatus(data)
      expect(result.ok, name).toBe(true)
    }
  })

  it('rejects every invalid backend fixture', () => {
    const invalid = files('invalid')
    expect(invalid.length).toBeGreaterThan(0)
    for (const name of invalid) expect(parseJobStatus(load('invalid', name)).ok, name).toBe(false)
  })

  it('returns a typed completed job with its blocks', () => {
    const result = parseJobStatus(load('valid', 'job_completed.json'))
    expect(result.ok && result.value.status === 'completed' && result.value.result.blocks[0]!.text).toBe('Jane Doe')
  })

  it('rejects a completed job without a result and a failed job without an error', () => {
    const done = load('valid', 'job_completed.json') as Record<string, unknown>
    expect(parseJobStatus({ ...done, result: null }).ok).toBe(false)
    const failed = load('valid', 'job_failed.json') as Record<string, unknown>
    expect(parseJobStatus({ ...failed, error: null }).ok).toBe(false)
  })

  it('rejects duplicate block ids', () => {
    const done = structuredClone(load('valid', 'job_completed.json')) as { result: { blocks: { id: string }[] } }
    done.result.blocks[1]!.id = 'b1'
    expect(parseJobStatus(done).ok).toBe(false)
  })

  it('bounds the payload', () => {
    const done = structuredClone(load('valid', 'job_completed.json')) as { result: { blocks: unknown[] } }
    const block = done.result.blocks[0] as Record<string, unknown>
    done.result.blocks = Array.from({ length: MAX_BLOCKS + 1 }, (_, i) => ({ ...block, id: `b${i + 1}` }))
    expect(parseJobStatus(done).ok).toBe(false)
    const long = structuredClone(load('valid', 'job_completed.json')) as { result: { blocks: { text: string }[] } }
    long.result.blocks[0]!.text = 'x'.repeat(20_001)
    expect(parseJobStatus(long).ok).toBe(false)
  })

  it('reads error bodies and ignores anything else', () => {
    expect(parseErrorBody({ contract_version: 1, error: { code: 'busy', retryable: true } })).toEqual({ code: 'busy', retryable: true })
    expect(parseErrorBody({ error: { code: 'other', retryable: true } })).toBeNull()
    expect(parseErrorBody('nope')).toBeNull()
  })
})

it('accepts valid optional progress and ignores malformed telemetry independently', () => {
  const job = load('valid', 'job_completed.json') as Record<string, unknown>
  const progress = { phase: 'done', percent: 100, completed_pages: 1, total_pages: 1 }
  const parsed = parseJobStatus({ ...job, progress })
  expect(parsed.ok && parsed.value.progress).toEqual(progress)
  for (const bad of [{ ...progress, percent: 101 }, { ...progress, completed_pages: 2 }, { ...progress, phase: 'unknown' }, { ...progress, percent: 0.5 }, { ...progress, total_pages: '1' }]) {
    const result = parseJobStatus({ ...job, progress: bad })
    expect(result.ok).toBe(true)
    expect(result.ok && result.value.progress).toBeNull()
  }
  expect(parseJobStatus({ ...job, progress, result: null }).ok).toBe(false)
})
