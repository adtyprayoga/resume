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
    expect(loadDocument(storage)).toEqual(doc)
  })

  it('reports a quota failure with actionable advice instead of failing silently', () => {
    storage.failWith = new DOMException('full', 'QuotaExceededError')
    const status = saveDocument(emptyDocument(), storage)
    expect(status.kind).toBe('error')
    if (status.kind === 'error') {
      expect(status.message).toMatch(/storage/i)
      expect(status.message).toMatch(/avatar/i)
    }
  })

  it('reports other write failures as an error too', () => {
    storage.failWith = new DOMException('nope', 'SecurityError')
    expect(saveDocument(emptyDocument(), storage).kind).toBe('error')
  })

  it('returns null when nothing is stored', () => {
    expect(loadDocument(storage)).toBeNull()
  })

  it('returns null for corrupt stored JSON rather than throwing', () => {
    storage.setItem(DOCUMENT_KEY, '{not json')
    expect(loadDocument(storage)).toBeNull()
  })

  it('returns null for a stored document from a newer schema version', () => {
    storage.setItem(DOCUMENT_KEY, JSON.stringify({ schemaVersion: 99 }))
    expect(loadDocument(storage)).toBeNull()
  })

  it('repairs a partially valid stored document instead of discarding it', () => {
    storage.setItem(
      DOCUMENT_KEY,
      JSON.stringify({ schemaVersion: 1, content: { experience: 'nope' } }),
    )
    expect(loadDocument(storage)?.content.experience).toEqual([])
  })

  it('clears the stored document', () => {
    saveDocument(emptyDocument(), storage)
    clearDocument(storage)
    expect(loadDocument(storage)).toBeNull()
  })

  it('reports an error when there is no storage at all', () => {
    expect(saveDocument(emptyDocument(), null).kind).toBe('error')
    expect(loadDocument(null)).toBeNull()
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
