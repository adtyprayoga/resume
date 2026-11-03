import { describe, expect, it } from 'vitest'
import { MAX_IMPORT_BYTES, parseResumeJson } from './importJson'
import { fetchResumeJson } from './importUrl'
import { resumeFileName, serializeResume } from './exportJson'
import { emptyDocument } from '$lib/model/document'

describe('parseResumeJson', () => {
  it('rejects blank input', () => {
    expect(parseResumeJson('   ').ok).toBe(false)
  })

  it('rejects unparseable JSON with a readable error', () => {
    const result = parseResumeJson('{not json')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/could not be read|not valid/i)
  })

  it('enforces the size cap before parsing', () => {
    const huge = `{"padding":"${'x'.repeat(MAX_IMPORT_BYTES + 10)}"}`
    const result = parseResumeJson(huge)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/too large/i)
  })

  it('refuses a document from a newer schema version', () => {
    const result = parseResumeJson(JSON.stringify({ schemaVersion: 99 }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/newer/i)
  })

  it('accepts a round-tripped export', () => {
    const doc = emptyDocument()
    const result = parseResumeJson(serializeResume(doc))
    expect(result.ok && result.value).toEqual(doc)
  })

  it('rejects a JSON array', () => {
    expect(parseResumeJson('[]').ok).toBe(false)
  })
})

const jsonResponse = (body: unknown, type = 'application/json') =>
  new Response(JSON.stringify(body), { headers: { 'content-type': type } })

describe('fetchResumeJson', () => {
  it('rejects a non-https URL', async () => {
    const result = await fetchResumeJson('http://example.com/cv.json', () => {
      throw new Error('must not be called')
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/https/i)
  })

  it('rejects a malformed URL', async () => {
    const result = await fetchResumeJson('not a url', () => {
      throw new Error('must not be called')
    })
    expect(result.ok).toBe(false)
  })

  it('rejects a non-JSON content type', async () => {
    const result = await fetchResumeJson('https://x.co/cv.json', async () =>
      jsonResponse({ schemaVersion: 1 }, 'text/html'),
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/not JSON|content type/i)
  })

  it('surfaces a failed request status', async () => {
    const result = await fetchResumeJson('https://x.co/cv.json', async () =>
      new Response('nope', { status: 404 }),
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/404/)
  })

  it('loads and validates a well-formed remote document', async () => {
    const doc = emptyDocument()
    const result = await fetchResumeJson('https://x.co/cv.json', async () => jsonResponse(doc))
    expect(result.ok && result.value).toEqual(doc)
  })

  it('reports a network failure instead of throwing', async () => {
    const result = await fetchResumeJson('https://x.co/cv.json', async () => {
      throw new TypeError('offline')
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/could not be reached|offline/i)
  })
})

describe('resumeFileName', () => {
  it('builds a slug from the resolved name and locale', () => {
    expect(resumeFileName('Aditya Prayoga', 'en')).toBe('aditya-prayoga-resume-en')
  })

  it('falls back when the name is blank', () => {
    expect(resumeFileName('   ', 'id')).toBe('resume-id')
  })

  it('strips characters that are unsafe in a filename', () => {
    expect(resumeFileName('A/B:C*?"<>|D', 'en')).toBe('a-b-c-d-resume-en')
  })
})
