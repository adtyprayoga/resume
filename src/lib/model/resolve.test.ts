import { describe, expect, it } from 'vitest'
import { resolve } from './resolve'
import { SCHEMA_VERSION, type ResumeDocument } from './types'

const doc = (): ResumeDocument => ({
  schemaVersion: SCHEMA_VERSION,
  contact: {
    email: 'a@b.c',
    phone: '+62 811',
    website: 'https://ex.co',
    github: 'https://github.com/x',
    linkedin: '',
    avatar: '',
  },
  profile: {
    text: {
      id: { name: 'Budi', headline: 'Perekayasa Perangkat Lunak', location: 'Jakarta', summary: 'Ringkasan' },
      en: { name: 'Budi', headline: 'Software Engineer', location: 'Jakarta', summary: '' },
    },
  },
  sections: [
    { kind: 'experience', enabled: true },
    { kind: 'awards', enabled: false },
  ],
  content: {
    education: [],
    experience: [
      {
        id: 'e1',
        company: 'PT Contoh',
        dates: { start: '2023-01', end: null, current: true },
        text: {
          id: { role: 'Perekayasa', team: 'Platform', location: 'Jakarta', bullets: ['Satu'] },
          en: { role: 'Engineer', team: 'Platform', location: 'Jakarta', bullets: ['One'] },
        },
      },
    ],
    projects: [],
    skills: [],
    awards: [],
    certifications: [],
  },
})

describe('resolve', () => {
  it('flattens the requested locale onto the shared core', () => {
    const r = resolve(doc(), 'en')
    expect(r.profile.headline).toBe('Software Engineer')
    expect(r.experience[0]).toMatchObject({
      id: 'e1',
      company: 'PT Contoh',
      role: 'Engineer',
      bullets: ['One'],
    })
  })

  it('resolves certifications with per-field locale fallback and shared identity', () => {
    const d = doc()
    d.content.certifications = [{ id: 'crt_1', date: '2024-05', text: {
      en: { title: 'Cloud course', issuer: '', description: 'Practitioner' },
      id: { title: 'Kursus cloud', issuer: 'Dewan', description: '' },
    } }]
    expect(resolve(d, 'en').certifications[0]).toEqual({ id: 'crt_1', date: '2024-05', title: 'Cloud course', issuer: 'Dewan', description: 'Practitioner' })
    expect(resolve(d, 'id').certifications[0]).toEqual({ id: 'crt_1', date: '2024-05', title: 'Kursus cloud', issuer: 'Dewan', description: 'Practitioner' })
  })

  it('keeps shared fields identical across locales', () => {
    const id = resolve(doc(), 'id')
    const en = resolve(doc(), 'en')
    expect(id.contact).toEqual(en.contact)
    expect(id.experience[0]?.company).toBe(en.experience[0]?.company)
    expect(id.experience[0]?.dates).toEqual(en.experience[0]?.dates)
  })

  it('falls back to the other locale for an untranslated field', () => {
    const r = resolve(doc(), 'en')
    expect(r.profile.summary).toBe('Ringkasan')
  })

  it('returns an empty string when neither locale has the field', () => {
    const d = doc()
    d.profile.text.id.summary = ''
    d.profile.text.en.summary = ''
    expect(resolve(d, 'en').profile.summary).toBe('')
  })

  it('does not leak a text node into the resolved shape', () => {
    const r = resolve(doc(), 'en')
    expect('text' in r.experience[0]!).toBe(false)
    expect('text' in r.profile).toBe(false)
  })

  it('preserves section order and enabled flags', () => {
    expect(resolve(doc(), 'id').sections).toEqual([
      { kind: 'experience', enabled: true },
      { kind: 'awards', enabled: false },
    ])
  })

  it('falls back per array element for bullets', () => {
    const d = doc()
    d.content.experience[0]!.text.en.bullets = []
    expect(resolve(d, 'en').experience[0]?.bullets).toEqual(['Satu'])
  })
})
