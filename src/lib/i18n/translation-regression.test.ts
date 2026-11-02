import { describe, expect, it } from 'vitest'
import { strings, t, translatedMessage } from './ui'
import { parseResumeJson } from '$lib/io/importJson'
import { migrate } from '$lib/model/migrate'
import { validateDocument } from '$lib/model/document'
import { fetchResumeJson } from '$lib/io/importUrl'
import { fileToAvatar } from '$lib/ui/avatar'
import { saveDocument } from '$lib/storage/persist'
import { emptyDocument } from '$lib/model/document'

describe('translation messages', () => {
  it('has identical keys and interpolation parameters in each dictionary', () => {
    expect(Object.keys(strings.id).sort()).toEqual(Object.keys(strings.en).sort())
    for (const key of Object.keys(strings.en) as (keyof typeof strings.en)[]) {
      expect(strings.id[key].match(/\{\w+\}/g)?.sort()).toEqual(strings.en[key].match(/\{\w+\}/g)?.sort())
    }
  })
  it('interpolates numeric and text parameters', () => {
    expect(t('id', 'app.fillUntranslated', { count: 3, language: 'EN' })).toBe('Isi 3 teks yang belum diterjemahkan dari EN')
  })
  it('translates error metadata while retaining legacy fallback messages', async () => {
    const errors = [parseResumeJson(''), parseResumeJson('{'), migrate(null), migrate({ schemaVersion: 99 }), validateDocument(null), await fetchResumeJson('invalid'), await fileToAvatar(new File(['x'], 'x.txt', { type: 'text/plain' }))]
    for (const error of errors) {
      expect(error.ok).toBe(false)
      if (!error.ok) {
        expect(error.messageKey).toBeTruthy()
        expect(translatedMessage('en', error, error.error)).toBe(error.error)
        expect(translatedMessage('id', error, error.error)).not.toBe(error.error)
      }
    }
    expect(translatedMessage('id', undefined, 'Legacy failure')).toBe('Legacy failure')
    const status = saveDocument(emptyDocument(), null)
    if (status.kind === 'error') expect(translatedMessage('id', status, status.message)).toBe('Penyimpanan lokal tidak tersedia di peramban ini.')
  })
})
