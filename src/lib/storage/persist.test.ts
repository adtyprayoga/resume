import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearDocument,
  DOCUMENT_KEY,
  loadDocument,
  loadPreferences,
  saveDocument,
  savePreferences,
} from './persist'
import { emptyDocument } from '$lib/model/document'
import { sampleDocument } from '../../data/sample'

class FakeStorage implements Storage {
  private map = new Map<string, string>()
  failWith: DOMException | null = null

  get length() {
    return this.map.size
  }
  clear() {
    this.map.clear()
  }
  getItem(key: string) {
    return this.map.get(key) ?? null
  }
  key(index: number) {
    return [...this.map.keys()][index] ?? null
  }
  removeItem(key: string) {
    this.map.delete(key)
  }
  setItem(key: string, value: string) {
    if (this.failWith) throw this.failWith
    this.map.set(key, value)
  }
}

let storage: FakeStorage

beforeEach(() => {
  storage = new FakeStorage()
})

describe('saveDocument / loadDocument', () => {
  it('round-trips a document unchanged', () => {
    const doc = sampleDocument()
    expect(saveDocument(doc, storage).kind).toBe('saved')
    expect(loadDocument(storage)).toEqual({ kind: 'loaded', document: doc })
  })

  it('reports a quota failure with actionable advice instead of failing silently', () => {
    storage.failWith = new DOMException('full', 'QuotaExceededError')
    const status = saveDocument(emptyDocument(), storage)
    expect(status.kind).toBe('error')
    if (status.kind === 'error') {
      expect(status.message).toMatch(/storage/i)
      expect(status.message).toMatch(/remove or resize your photo/i)
      expect(status.message).toMatch(/export your JSON/i)
      expect(status.message).not.toMatch(/image URL/i)
      expect(status.messageKey).toBe('error.storageQuota')
    }
  })

  it('reports other write failures as an error too', () => {
    storage.failWith = new DOMException('nope', 'SecurityError')
    expect(saveDocument(emptyDocument(), storage).kind).toBe('error')
  })

  it('is empty only when the key is absent', () => {
    expect(loadDocument(storage)).toEqual({ kind: 'empty' })
  })

  it.each([
    ['an empty string', '', 'error.storedEmpty'],
    ['corrupt JSON', '{not json', 'error.storedJson'],
    ['a newer schema', JSON.stringify({ schemaVersion: 99 }), 'error.newerSchema'],
    ['a non-document value', '[1,2]', 'error.notResume'],
  ])('enters recovery for %s and keeps the original string', (_label, raw, messageKey) => {
    storage.setItem(DOCUMENT_KEY, raw)
    const result = loadDocument(storage)
    expect(result).toMatchObject({ kind: 'recovery', raw, messageKey })
    if (result.kind === 'recovery') expect(result.error).toBeTruthy()
    expect(storage.getItem(DOCUMENT_KEY)).toBe(raw)
  })

  it('repairs a partially valid stored document instead of discarding it', () => {
    storage.setItem(
      DOCUMENT_KEY,
      JSON.stringify({ schemaVersion: 1, content: { experience: 'nope' } }),
    )
    const result = loadDocument(storage)
    expect(result.kind === 'loaded' && result.document.content.experience).toEqual([])
  })

  it('clears the stored document', () => {
    saveDocument(emptyDocument(), storage)
    clearDocument(storage)
    expect(loadDocument(storage)).toEqual({ kind: 'empty' })
  })

  it('reports unavailable, not empty, when storage is missing or blocked', () => {
    expect(saveDocument(emptyDocument(), null).kind).toBe('error')
    expect(loadDocument(null)).toMatchObject({ kind: 'unavailable', messageKey: 'error.storageUnavailable' })
    const blocked = new FakeStorage()
    blocked.getItem = () => { throw new DOMException('denied', 'SecurityError') }
    expect(loadDocument(blocked)).toMatchObject({ kind: 'unavailable' })
  })

  it('treats an omitted argument as this browser, not as missing storage', () => {
    expect(saveDocument(emptyDocument()).kind).toBe('saved')
  })
})

describe('preferences', () => {
  it('round-trips preferences', () => {
    savePreferences({ themeKey: 'minimal', documentLocale: 'id' }, storage)
    expect(loadPreferences(storage)).toEqual({ themeKey: 'minimal', documentLocale: 'id' })
  })

  it('returns null for absent or non-object preferences', () => {
    expect(loadPreferences(storage)).toBeNull()
    savePreferences([1, 2], storage)
    expect(loadPreferences(storage)).toBeNull()
  })

  it('never throws when storage rejects the write', () => {
    storage.failWith = new DOMException('full', 'QuotaExceededError')
    expect(() => savePreferences({ a: 1 }, storage)).not.toThrow()
  })
})
